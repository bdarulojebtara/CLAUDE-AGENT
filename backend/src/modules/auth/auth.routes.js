import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import db from '../../lib/db.js';
import env from '../../lib/env.js';
import { funcionarios, logs_seguranca } from '../../../drizzle/schema.js';
import { eq, and } from 'drizzle-orm';
import { loginRateLimiter } from '../../middleware/rateLimiter.js';
import { authenticate } from '../../middleware/auth.js';
import { calcularPermissoes } from '../../lib/permissions.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
//  SCHEMAS DE VALIDAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(1, 'Senha obrigatória')
});

const trocarSenhaSchema = z.object({
  senha_atual: z.string().min(1, 'Senha atual obrigatória'),
  senha_nova: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  senha_confirmacao: z.string().min(1, 'Confirmação de senha obrigatória')
}).refine(data => data.senha_nova === data.senha_confirmacao, {
  message: 'Senhas não conferem',
  path: ['senha_confirmacao']
});

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /api/v1/auth/login
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/login', loginRateLimiter, async (req, res, next) => {
  try {
    const { email, senha } = loginSchema.parse(req.body);

    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Buscar funcionário por email
    const [funcionario] = await db
      .select()
      .from(funcionarios)
      .where(eq(funcionarios.email, email))
      .limit(1);

    // Se não encontrou ou está inativo
    if (!funcionario || !funcionario.ativo) {
      // Registrar tentativa de login falhada
      await db.insert(logs_seguranca).values({
        empresa_id: funcionario?.empresa_id || null,
        funcionario_id: funcionario?.id || null,
        evento: 'LOGIN_FALHOU',
        ip,
        user_agent: userAgent,
        tentativas: 1,
        bloqueado: false
      });

      return res.status(401).json({
        success: false,
        message: 'Email ou senha incorretos'
      });
    }

    // Verificar senha
    const senhaValida = await bcrypt.compare(senha, funcionario.senha_hash);

    if (!senhaValida) {
      // Registrar tentativa de login falhada
      await db.insert(logs_seguranca).values({
        empresa_id: funcionario.empresa_id,
        funcionario_id: funcionario.id,
        evento: 'LOGIN_FALHOU',
        ip,
        user_agent: userAgent,
        tentativas: 1,
        bloqueado: false
      });

      return res.status(401).json({
        success: false,
        message: 'Email ou senha incorretos'
      });
    }

    // Calcular permissões finais do funcionário
    const permissoes = calcularPermissoes(
      funcionario.perfil_base,
      funcionario.permissoes_extras,
      funcionario.permissoes_removidas
    );

    // Atualizar último login
    await db
      .update(funcionarios)
      .set({
        ultimo_login: new Date(),
        ultimo_login_ip: ip
      })
      .where(eq(funcionarios.id, funcionario.id));

    // Registrar login bem-sucedido
    await db.insert(logs_seguranca).values({
      empresa_id: funcionario.empresa_id,
      funcionario_id: funcionario.id,
      evento: 'LOGIN_SUCESSO',
      ip,
      user_agent: userAgent,
      tentativas: 1,
      bloqueado: false
    });

    // Gerar JWT
    const token = jwt.sign(
      {
        userId: funcionario.id,
        empresaId: funcionario.empresa_id,
        email: funcionario.email,
        perfil: funcionario.perfil_base,
        permissoes
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    // Gerar refresh token
    const refreshToken = jwt.sign(
      {
        userId: funcionario.id,
        empresaId: funcionario.empresa_id,
        type: 'refresh'
      },
      env.JWT_SECRET,
      { expiresIn: env.REFRESH_TOKEN_EXPIRES_IN }
    );

    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      data: {
        token,
        refreshToken,
        user: {
          id: funcionario.id,
          nome: funcionario.nome,
          email: funcionario.email,
          cargo: funcionario.cargo,
          setor: funcionario.setor,
          perfil: funcionario.perfil_base,
          permissoes,
          primeiro_acesso: funcionario.primeiro_acesso,
          empresa_id: funcionario.empresa_id
        },
        demo_mode: env.DEMO_MODE
      }
    });

  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /api/v1/auth/refresh
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token não fornecido'
      });
    }

    // Verificar refresh token
    const decoded = jwt.verify(refreshToken, env.JWT_SECRET);

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    // Buscar funcionário
    const [funcionario] = await db
      .select()
      .from(funcionarios)
      .where(eq(funcionarios.id, decoded.userId))
      .limit(1);

    if (!funcionario || !funcionario.ativo) {
      return res.status(401).json({
        success: false,
        message: 'Usuário inativo ou não encontrado'
      });
    }

    // Calcular permissões finais
    const permissoes = calcularPermissoes(
      funcionario.perfil_base,
      funcionario.permissoes_extras,
      funcionario.permissoes_removidas
    );

    // Gerar novo JWT
    const newToken = jwt.sign(
      {
        userId: funcionario.id,
        empresaId: funcionario.empresa_id,
        email: funcionario.email,
        perfil: funcionario.perfil_base,
        permissoes
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      data: {
        token: newToken
      }
    });

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Refresh token expirado. Faça login novamente.',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Refresh token inválido'
      });
    }

    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /api/v1/auth/logout
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/logout', authenticate, async (req, res, next) => {
  try {
    // Registrar logout
    await db.insert(logs_seguranca).values({
      empresa_id: req.user.empresaId,
      funcionario_id: req.user.userId,
      evento: 'LOGOUT',
      ip: req.ip || req.connection.remoteAddress,
      user_agent: req.headers['user-agent'],
      tentativas: 1,
      bloqueado: false
    });

    res.json({
      success: true,
      message: 'Logout realizado com sucesso'
    });

  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PUT /api/v1/auth/trocar-senha
// ═══════════════════════════════════════════════════════════════════════════════

router.put('/trocar-senha', authenticate, async (req, res, next) => {
  try {
    const { senha_atual, senha_nova } = trocarSenhaSchema.parse(req.body);

    // Buscar funcionário
    const [funcionario] = await db
      .select()
      .from(funcionarios)
      .where(eq(funcionarios.id, req.user.userId))
      .limit(1);

    if (!funcionario) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Verificar senha atual
    const senhaValida = await bcrypt.compare(senha_atual, funcionario.senha_hash);

    if (!senhaValida) {
      return res.status(401).json({
        success: false,
        message: 'Senha atual incorreta'
      });
    }

    // Hash da nova senha
    const novaSenhaHash = await bcrypt.hash(senha_nova, env.BCRYPT_ROUNDS);

    // Atualizar senha
    await db
      .update(funcionarios)
      .set({
        senha_hash: novaSenhaHash,
        primeiro_acesso: false
      })
      .where(eq(funcionarios.id, req.user.userId));

    // Registrar troca de senha
    await db.insert(logs_seguranca).values({
      empresa_id: req.user.empresaId,
      funcionario_id: req.user.userId,
      evento: 'SENHA_ALTERADA',
      ip: req.ip || req.connection.remoteAddress,
      user_agent: req.headers['user-agent'],
      tentativas: 1,
      bloqueado: false
    });

    res.json({
      success: true,
      message: 'Senha alterada com sucesso'
    });

  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/auth/me
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const [funcionario] = await db
      .select({
        id: funcionarios.id,
        nome: funcionarios.nome,
        email: funcionarios.email,
        cargo: funcionarios.cargo,
        setor: funcionarios.setor,
        perfil_base: funcionarios.perfil_base,
        permissoes: funcionarios.permissoes,
        primeiro_acesso: funcionarios.primeiro_acesso,
        empresa_id: funcionarios.empresa_id
      })
      .from(funcionarios)
      .where(eq(funcionarios.id, req.user.userId))
      .limit(1);

    if (!funcionario) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        user: funcionario,
        demo_mode: env.DEMO_MODE
      }
    });

  } catch (error) {
    next(error);
  }
});

export default router;

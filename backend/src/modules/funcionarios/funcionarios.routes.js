import express from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import db from '../../lib/db.js';
import env from '../../lib/env.js';
import { funcionarios } from '../../../drizzle/schema.js';
import { eq, and } from 'drizzle-orm';
import { authenticate } from '../../middleware/auth.js';
import { requirePermissions } from '../../middleware/rbac.js';
import { auditLog } from '../../middleware/audit.js';
import { PERMISSOES, PERFIS, calcularPermissoes } from '../../lib/permissions.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
//  SCHEMAS DE VALIDAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

const funcionarioSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  email: z.string().email('Email inválido'),
  cargo: z.string().optional(),
  setor: z.string().optional(),
  cpf: z.string().optional(),
  telefone: z.string().optional(),
  perfil_base: z.enum([
    PERFIS.ADMIN,
    PERFIS.VENDEDOR,
    PERFIS.ALMOXARIFE,
    PERFIS.OPERADOR_FABRICA,
    PERFIS.EXPEDIDOR,
    PERFIS.FINANCEIRO
  ]),
  permissoes_extras: z.array(z.string()).optional(),
  permissoes_removidas: z.array(z.string()).optional(),
  comissao_percentual: z.number().min(0).max(100).default(0),
  salario_base: z.number().min(0).optional(),
  senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').optional()
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/funcionarios - Listar funcionários
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/', authenticate, requirePermissions(PERMISSOES.PERM_FUNCIONARIO_LISTAR), async (req, res, next) => {
  try {
    const funcionariosList = await db
      .select({
        id: funcionarios.id,
        nome: funcionarios.nome,
        email: funcionarios.email,
        cargo: funcionarios.cargo,
        setor: funcionarios.setor,
        cpf: funcionarios.cpf,
        telefone: funcionarios.telefone,
        perfil_base: funcionarios.perfil_base,
        comissao_percentual: funcionarios.comissao_percentual,
        ativo: funcionarios.ativo,
        primeiro_acesso: funcionarios.primeiro_acesso,
        ultimo_login: funcionarios.ultimo_login,
        permissoes_extras: funcionarios.permissoes_extras,
        permissoes_removidas: funcionarios.permissoes_removidas
      })
      .from(funcionarios)
      .where(eq(funcionarios.empresa_id, req.user.empresaId));

    // Calcular permissões finais para cada funcionário
    const funcionariosComPermissoes = funcionariosList.map(func => ({
      ...func,
      permissoes: calcularPermissoes(
        func.perfil_base,
        func.permissoes_extras,
        func.permissoes_removidas
      )
    }));

    res.json({
      success: true,
      data: funcionariosComPermissoes
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/funcionarios/:id - Buscar funcionário por ID
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/:id', authenticate, requirePermissions(PERMISSOES.PERM_FUNCIONARIO_LISTAR), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    const [funcionario] = await db
      .select({
        id: funcionarios.id,
        nome: funcionarios.nome,
        email: funcionarios.email,
        cargo: funcionarios.cargo,
        setor: funcionarios.setor,
        cpf: funcionarios.cpf,
        telefone: funcionarios.telefone,
        perfil_base: funcionarios.perfil_base,
        comissao_percentual: funcionarios.comissao_percentual,
        salario_base: funcionarios.salario_base,
        ativo: funcionarios.ativo,
        primeiro_acesso: funcionarios.primeiro_acesso,
        ultimo_login: funcionarios.ultimo_login,
        ultimo_login_ip: funcionarios.ultimo_login_ip,
        permissoes_extras: funcionarios.permissoes_extras,
        permissoes_removidas: funcionarios.permissoes_removidas
      })
      .from(funcionarios)
      .where(and(
        eq(funcionarios.id, id),
        eq(funcionarios.empresa_id, req.user.empresaId)
      ))
      .limit(1);

    if (!funcionario) {
      return res.status(404).json({
        success: false,
        message: 'Funcionário não encontrado'
      });
    }

    // Calcular permissões finais
    const permissoes = calcularPermissoes(
      funcionario.perfil_base,
      funcionario.permissoes_extras,
      funcionario.permissoes_removidas
    );

    res.json({
      success: true,
      data: {
        ...funcionario,
        permissoes
      }
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /api/v1/funcionarios - Criar funcionário
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/',
  authenticate,
  requirePermissions(PERMISSOES.PERM_FUNCIONARIO_CRIAR),
  auditLog('FUNCIONARIOS', 'CRIAR'),
  async (req, res, next) => {
    try {
      const data = funcionarioSchema.parse(req.body);

      // Verificar se email já existe
      const [emailExistente] = await db
        .select()
        .from(funcionarios)
        .where(and(
          eq(funcionarios.email, data.email),
          eq(funcionarios.empresa_id, req.user.empresaId)
        ))
        .limit(1);

      if (emailExistente) {
        return res.status(400).json({
          success: false,
          message: 'Email já cadastrado'
        });
      }

      // Gerar senha padrão se não fornecida
      const senha = data.senha || 'vidrato123';
      const senhaHash = await bcrypt.hash(senha, env.BCRYPT_ROUNDS);

      const [novoFuncionario] = await db
        .insert(funcionarios)
        .values({
          nome: data.nome,
          email: data.email,
          cargo: data.cargo,
          setor: data.setor,
          cpf: data.cpf,
          telefone: data.telefone,
          perfil_base: data.perfil_base,
          permissoes_extras: data.permissoes_extras || [],
          permissoes_removidas: data.permissoes_removidas || [],
          comissao_percentual: data.comissao_percentual,
          salario_base: data.salario_base,
          senha_hash: senhaHash,
          primeiro_acesso: true,
          empresa_id: req.user.empresaId
        })
        .$returningId();

      res.status(201).json({
        success: true,
        message: 'Funcionário criado com sucesso',
        data: {
          id: novoFuncionario.id,
          senha_temporaria: data.senha ? undefined : senha
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  PUT /api/v1/funcionarios/:id - Atualizar funcionário
// ═══════════════════════════════════════════════════════════════════════════════

router.put('/:id',
  authenticate,
  requirePermissions(PERMISSOES.PERM_FUNCIONARIO_EDITAR),
  auditLog('FUNCIONARIOS', 'ATUALIZAR'),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const data = funcionarioSchema.partial().parse(req.body);

      const [funcionario] = await db
        .select()
        .from(funcionarios)
        .where(and(
          eq(funcionarios.id, id),
          eq(funcionarios.empresa_id, req.user.empresaId)
        ))
        .limit(1);

      if (!funcionario) {
        return res.status(404).json({
          success: false,
          message: 'Funcionário não encontrado'
        });
      }

      // Se email foi alterado, verificar duplicidade
      if (data.email && data.email !== funcionario.email) {
        const [emailExistente] = await db
          .select()
          .from(funcionarios)
          .where(and(
            eq(funcionarios.email, data.email),
            eq(funcionarios.empresa_id, req.user.empresaId)
          ))
          .limit(1);

        if (emailExistente) {
          return res.status(400).json({
            success: false,
            message: 'Email já cadastrado'
          });
        }
      }

      // Preparar dados para atualização
      const updateData = { ...data };

      // Se senha foi fornecida, fazer hash
      if (data.senha) {
        updateData.senha_hash = await bcrypt.hash(data.senha, env.BCRYPT_ROUNDS);
        delete updateData.senha;
      }

      await db
        .update(funcionarios)
        .set(updateData)
        .where(eq(funcionarios.id, id));

      res.json({
        success: true,
        message: 'Funcionário atualizado com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  DELETE /api/v1/funcionarios/:id - Desativar funcionário
// ═══════════════════════════════════════════════════════════════════════════════

router.delete('/:id',
  authenticate,
  requirePermissions(PERMISSOES.PERM_FUNCIONARIO_EDITAR),
  auditLog('FUNCIONARIOS', 'DESATIVAR'),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);

      // Não permitir desativar a si mesmo
      if (id === req.user.userId) {
        return res.status(400).json({
          success: false,
          message: 'Não é possível desativar seu próprio usuário'
        });
      }

      const [funcionario] = await db
        .select()
        .from(funcionarios)
        .where(and(
          eq(funcionarios.id, id),
          eq(funcionarios.empresa_id, req.user.empresaId)
        ))
        .limit(1);

      if (!funcionario) {
        return res.status(404).json({
          success: false,
          message: 'Funcionário não encontrado'
        });
      }

      // Soft delete
      await db
        .update(funcionarios)
        .set({ ativo: false })
        .where(eq(funcionarios.id, id));

      res.json({
        success: true,
        message: 'Funcionário desativado com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /api/v1/funcionarios/:id/resetar-senha - Resetar senha
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:id/resetar-senha',
  authenticate,
  requirePermissions(PERMISSOES.PERM_FUNCIONARIO_EDITAR),
  auditLog('FUNCIONARIOS', 'RESETAR_SENHA'),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);

      const [funcionario] = await db
        .select()
        .from(funcionarios)
        .where(and(
          eq(funcionarios.id, id),
          eq(funcionarios.empresa_id, req.user.empresaId)
        ))
        .limit(1);

      if (!funcionario) {
        return res.status(404).json({
          success: false,
          message: 'Funcionário não encontrado'
        });
      }

      // Gerar nova senha temporária
      const novaSenha = 'vidrato123';
      const senhaHash = await bcrypt.hash(novaSenha, env.BCRYPT_ROUNDS);

      await db
        .update(funcionarios)
        .set({
          senha_hash: senhaHash,
          primeiro_acesso: true
        })
        .where(eq(funcionarios.id, id));

      res.json({
        success: true,
        message: 'Senha resetada com sucesso',
        data: {
          senha_temporaria: novaSenha
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

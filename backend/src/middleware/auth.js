import jwt from 'jsonwebtoken';
import env from '../lib/env.js';
import db from '../lib/db.js';
import { funcionarios } from '../../drizzle/schema.js';
import { eq } from 'drizzle-orm';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token de autenticação não fornecido'
      });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);

      // Verificar se o funcionário ainda existe e está ativo
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

      // Anexar informações do usuário ao request
      req.user = {
        userId: decoded.userId,
        empresaId: decoded.empresaId,
        email: decoded.email,
        perfil: decoded.perfil,
        permissoes: decoded.permissoes || []
      };

      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expirado',
          code: 'TOKEN_EXPIRED'
        });
      }

      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Token inválido'
        });
      }

      throw error;
    }
  } catch (error) {
    console.error('Erro no middleware de autenticação:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao validar autenticação'
    });
  }
}

export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  return authenticate(req, res, next);
}

export default { authenticate, optionalAuth };

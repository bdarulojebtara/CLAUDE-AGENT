import express from 'express';
import db from '../../lib/db.js';
import { logs_auditoria, funcionarios } from '../../../drizzle/schema.js';
import { eq, and, gte, lte } from 'drizzle-orm';
import { authenticate } from '../../middleware/auth.js';
import { requirePermissions } from '../../middleware/rbac.js';
import { PERMISSOES } from '../../lib/permissions.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/auditoria - Listar logs de auditoria
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/', authenticate, requirePermissions(PERMISSOES.PERM_AUDITORIA_VER), async (req, res, next) => {
  try {
    const { modulo, acao, funcionario_id, data_inicio, data_fim, limit = 100 } = req.query;

    let query = db
      .select({
        log: logs_auditoria,
        funcionario: {
          id: funcionarios.id,
          nome: funcionarios.nome
        }
      })
      .from(logs_auditoria)
      .leftJoin(funcionarios, eq(logs_auditoria.funcionario_id, funcionarios.id))
      .where(eq(logs_auditoria.empresa_id, req.user.empresaId))
      .orderBy(sql`${logs_auditoria.criado_em} DESC`)
      .limit(parseInt(limit));

    if (modulo) {
      query = query.where(eq(logs_auditoria.modulo, modulo));
    }

    if (acao) {
      query = query.where(eq(logs_auditoria.acao, acao));
    }

    if (funcionario_id) {
      query = query.where(eq(logs_auditoria.funcionario_id, parseInt(funcionario_id)));
    }

    if (data_inicio) {
      query = query.where(gte(logs_auditoria.criado_em, new Date(data_inicio)));
    }

    if (data_fim) {
      query = query.where(lte(logs_auditoria.criado_em, new Date(data_fim)));
    }

    const logs = await query;

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/auditoria/:id - Buscar log específico
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/:id', authenticate, requirePermissions(PERMISSOES.PERM_AUDITORIA_VER), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    const [log] = await db
      .select({
        log: logs_auditoria,
        funcionario: funcionarios
      })
      .from(logs_auditoria)
      .leftJoin(funcionarios, eq(logs_auditoria.funcionario_id, funcionarios.id))
      .where(and(
        eq(logs_auditoria.id, id),
        eq(logs_auditoria.empresa_id, req.user.empresaId)
      ))
      .limit(1);

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Log não encontrado'
      });
    }

    res.json({
      success: true,
      data: log
    });
  } catch (error) {
    next(error);
  }
});

export default router;

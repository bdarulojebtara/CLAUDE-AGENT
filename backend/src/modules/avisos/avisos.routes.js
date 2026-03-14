import express from 'express';
import { z } from 'zod';
import db from '../../lib/db.js';
import { avisos, funcionarios } from '../../../drizzle/schema.js';
import { eq, and, gte } from 'drizzle-orm';
import { authenticate } from '../../middleware/auth.js';
import { requirePermissions } from '../../middleware/rbac.js';
import { auditLog } from '../../middleware/audit.js';
import { PERMISSOES } from '../../lib/permissions.js';
import { emitToCompany } from '../../lib/socket.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
//  SCHEMAS DE VALIDAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

const avisoSchema = z.object({
  titulo: z.string().min(1, 'Título obrigatório'),
  mensagem: z.string().min(1, 'Mensagem obrigatória'),
  tipo: z.enum(['INFO', 'ALERTA', 'URGENTE']).default('INFO'),
  validade_dias: z.number().default(7)
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/avisos - Listar avisos ativos
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { tipo } = req.query;

    let query = db
      .select({
        aviso: avisos,
        criador: {
          id: funcionarios.id,
          nome: funcionarios.nome
        }
      })
      .from(avisos)
      .leftJoin(funcionarios, eq(avisos.criado_por, funcionarios.id))
      .where(and(
        eq(avisos.empresa_id, req.user.empresaId),
        eq(avisos.ativo, true),
        gte(avisos.valido_ate, new Date())
      ));

    if (tipo) {
      query = query.where(eq(avisos.tipo, tipo));
    }

    const avisosList = await query;

    res.json({
      success: true,
      data: avisosList
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /api/v1/avisos - Criar aviso
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/',
  authenticate,
  requirePermissions(PERMISSOES.PERM_AVISO_CRIAR),
  auditLog('AVISOS', 'CRIAR'),
  async (req, res, next) => {
    try {
      const data = avisoSchema.parse(req.body);

      // Calcular validade
      const validoAte = new Date();
      validoAte.setDate(validoAte.getDate() + data.validade_dias);

      const [novoAviso] = await db
        .insert(avisos)
        .values({
          empresa_id: req.user.empresaId,
          titulo: data.titulo,
          mensagem: data.mensagem,
          tipo: data.tipo,
          criado_por: req.user.userId,
          valido_ate: validoAte,
          ativo: true
        })
        .$returningId();

      // Buscar aviso completo para enviar via WebSocket
      const [avisoCompleto] = await db
        .select({
          aviso: avisos,
          criador: {
            id: funcionarios.id,
            nome: funcionarios.nome
          }
        })
        .from(avisos)
        .leftJoin(funcionarios, eq(avisos.criado_por, funcionarios.id))
        .where(eq(avisos.id, novoAviso.id))
        .limit(1);

      // Emitir via WebSocket para todos os usuários da empresa
      emitToCompany(req.user.empresaId, 'novo-aviso', avisoCompleto);

      res.status(201).json({
        success: true,
        message: 'Aviso criado com sucesso',
        data: avisoCompleto
      });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  DELETE /api/v1/avisos/:id - Desativar aviso
// ═══════════════════════════════════════════════════════════════════════════════

router.delete('/:id',
  authenticate,
  requirePermissions(PERMISSOES.PERM_AVISO_CRIAR),
  auditLog('AVISOS', 'DESATIVAR'),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);

      const [aviso] = await db
        .select()
        .from(avisos)
        .where(and(
          eq(avisos.id, id),
          eq(avisos.empresa_id, req.user.empresaId)
        ))
        .limit(1);

      if (!aviso) {
        return res.status(404).json({
          success: false,
          message: 'Aviso não encontrado'
        });
      }

      await db
        .update(avisos)
        .set({ ativo: false })
        .where(eq(avisos.id, id));

      // Emitir via WebSocket
      emitToCompany(req.user.empresaId, 'aviso-removido', { id });

      res.json({
        success: true,
        message: 'Aviso desativado com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

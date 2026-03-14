import express from 'express';
import { z } from 'zod';
import db from '../../lib/db.js';
import { fornecedores } from '../../../drizzle/schema.js';
import { eq, and, like, or } from 'drizzle-orm';
import { authenticate } from '../../middleware/auth.js';
import { requirePermissions } from '../../middleware/rbac.js';
import { auditLog } from '../../middleware/audit.js';
import { PERMISSOES } from '../../lib/permissions.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
//  SCHEMAS DE VALIDAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

const fornecedorSchema = z.object({
  tipo: z.enum(['PF', 'PJ']),
  nome: z.string().min(1, 'Nome obrigatório'),
  cpf_cnpj: z.string().optional(),
  telefone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  endereco: z.string().optional(),
  cep: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  categoria: z.enum(['ALUMINIO', 'VIDRO', 'FERRAGENS', 'SERVICOS', 'OUTROS']).default('OUTROS'),
  prazo_entrega_dias: z.number().default(0),
  condicoes_pagamento: z.string().optional(),
  observacoes: z.string().optional()
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/fornecedores - Listar fornecedores
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/', authenticate, requirePermissions(PERMISSOES.PERM_FORNECEDOR_LISTAR), async (req, res, next) => {
  try {
    const { busca, categoria } = req.query;

    let query = db.select().from(fornecedores).where(eq(fornecedores.empresa_id, req.user.empresaId));

    if (busca) {
      query = query.where(
        or(
          like(fornecedores.nome, `%${busca}%`),
          like(fornecedores.cpf_cnpj, `%${busca}%`),
          like(fornecedores.telefone, `%${busca}%`)
        )
      );
    }

    if (categoria) {
      query = query.where(eq(fornecedores.categoria, categoria));
    }

    const fornecedoresList = await query;

    res.json({
      success: true,
      data: fornecedoresList
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/fornecedores/:id - Buscar fornecedor por ID
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/:id', authenticate, requirePermissions(PERMISSOES.PERM_FORNECEDOR_LISTAR), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    const [fornecedor] = await db
      .select()
      .from(fornecedores)
      .where(and(
        eq(fornecedores.id, id),
        eq(fornecedores.empresa_id, req.user.empresaId)
      ))
      .limit(1);

    if (!fornecedor) {
      return res.status(404).json({
        success: false,
        message: 'Fornecedor não encontrado'
      });
    }

    res.json({
      success: true,
      data: fornecedor
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /api/v1/fornecedores - Criar fornecedor
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/',
  authenticate,
  requirePermissions(PERMISSOES.PERM_FORNECEDOR_CRIAR),
  auditLog('FORNECEDORES', 'CRIAR'),
  async (req, res, next) => {
    try {
      const data = fornecedorSchema.parse(req.body);

      const [novoFornecedor] = await db
        .insert(fornecedores)
        .values({
          ...data,
          empresa_id: req.user.empresaId
        })
        .$returningId();

      res.status(201).json({
        success: true,
        message: 'Fornecedor criado com sucesso',
        data: { id: novoFornecedor.id }
      });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  PUT /api/v1/fornecedores/:id - Atualizar fornecedor
// ═══════════════════════════════════════════════════════════════════════════════

router.put('/:id',
  authenticate,
  requirePermissions(PERMISSOES.PERM_FORNECEDOR_CRIAR),
  auditLog('FORNECEDORES', 'ATUALIZAR'),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const data = fornecedorSchema.partial().parse(req.body);

      const [fornecedor] = await db
        .select()
        .from(fornecedores)
        .where(and(
          eq(fornecedores.id, id),
          eq(fornecedores.empresa_id, req.user.empresaId)
        ))
        .limit(1);

      if (!fornecedor) {
        return res.status(404).json({
          success: false,
          message: 'Fornecedor não encontrado'
        });
      }

      await db
        .update(fornecedores)
        .set(data)
        .where(eq(fornecedores.id, id));

      res.json({
        success: true,
        message: 'Fornecedor atualizado com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  DELETE /api/v1/fornecedores/:id - Deletar fornecedor
// ═══════════════════════════════════════════════════════════════════════════════

router.delete('/:id',
  authenticate,
  requirePermissions(PERMISSOES.PERM_FORNECEDOR_CRIAR),
  auditLog('FORNECEDORES', 'DELETAR'),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);

      const [fornecedor] = await db
        .select()
        .from(fornecedores)
        .where(and(
          eq(fornecedores.id, id),
          eq(fornecedores.empresa_id, req.user.empresaId)
        ))
        .limit(1);

      if (!fornecedor) {
        return res.status(404).json({
          success: false,
          message: 'Fornecedor não encontrado'
        });
      }

      // Soft delete
      await db
        .update(fornecedores)
        .set({ ativo: false })
        .where(eq(fornecedores.id, id));

      res.json({
        success: true,
        message: 'Fornecedor deletado com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

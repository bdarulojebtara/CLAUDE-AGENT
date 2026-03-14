import express from 'express';
import { z } from 'zod';
import db from '../../lib/db.js';
import {
  orcamentos,
  itens_orcamento,
  clientes,
  funcionarios,
  produtos
} from '../../../drizzle/schema.js';
import { eq, and, gte, lte } from 'drizzle-orm';
import { authenticate } from '../../middleware/auth.js';
import { requirePermissions } from '../../middleware/rbac.js';
import { auditLog } from '../../middleware/audit.js';
import { PERMISSOES } from '../../lib/permissions.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
//  SCHEMAS DE VALIDAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

const itemOrcamentoSchema = z.object({
  produto_id: z.number(),
  quantidade: z.number().positive(),
  preco_unitario: z.number().positive(),
  desconto_pct: z.number().min(0).max(100).default(0)
});

const orcamentoSchema = z.object({
  cliente_id: z.number(),
  validade_dias: z.number().default(30),
  desconto_global_pct: z.number().min(0).max(100).default(0),
  itens: z.array(itemOrcamentoSchema).min(1, 'O orçamento deve conter pelo menos 1 item'),
  observacoes: z.string().optional()
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/orcamentos - Listar orçamentos
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/', authenticate, requirePermissions(PERMISSOES.PERM_ORCAMENTO_CRIAR), async (req, res, next) => {
  try {
    const { data_inicio, data_fim, status } = req.query;

    let query = db
      .select({
        orcamento: orcamentos,
        cliente: {
          id: clientes.id,
          nome: clientes.nome,
          cpf_cnpj: clientes.cpf_cnpj
        },
        vendedor: {
          id: funcionarios.id,
          nome: funcionarios.nome
        }
      })
      .from(orcamentos)
      .leftJoin(clientes, eq(orcamentos.cliente_id, clientes.id))
      .leftJoin(funcionarios, eq(orcamentos.vendedor_id, funcionarios.id))
      .where(eq(orcamentos.empresa_id, req.user.empresaId));

    if (data_inicio) {
      query = query.where(gte(orcamentos.criado_em, new Date(data_inicio)));
    }

    if (data_fim) {
      query = query.where(lte(orcamentos.criado_em, new Date(data_fim)));
    }

    if (status) {
      query = query.where(eq(orcamentos.status, status));
    }

    const orcamentosList = await query;

    res.json({
      success: true,
      data: orcamentosList
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/orcamentos/:id - Buscar orçamento por ID
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/:id', authenticate, requirePermissions(PERMISSOES.PERM_ORCAMENTO_CRIAR), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    const [orcamento] = await db
      .select({
        orcamento: orcamentos,
        cliente: clientes,
        vendedor: {
          id: funcionarios.id,
          nome: funcionarios.nome
        }
      })
      .from(orcamentos)
      .leftJoin(clientes, eq(orcamentos.cliente_id, clientes.id))
      .leftJoin(funcionarios, eq(orcamentos.vendedor_id, funcionarios.id))
      .where(and(
        eq(orcamentos.id, id),
        eq(orcamentos.empresa_id, req.user.empresaId)
      ))
      .limit(1);

    if (!orcamento) {
      return res.status(404).json({
        success: false,
        message: 'Orçamento não encontrado'
      });
    }

    // Buscar itens
    const itens = await db
      .select({
        item: itens_orcamento,
        produto: {
          id: produtos.id,
          codigo: produtos.codigo,
          nome: produtos.nome,
          unidade: produtos.unidade
        }
      })
      .from(itens_orcamento)
      .leftJoin(produtos, eq(itens_orcamento.produto_id, produtos.id))
      .where(eq(itens_orcamento.orcamento_id, id));

    res.json({
      success: true,
      data: {
        ...orcamento.orcamento,
        cliente: orcamento.cliente,
        vendedor: orcamento.vendedor,
        itens
      }
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /api/v1/orcamentos - Criar orçamento
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/',
  authenticate,
  requirePermissions(PERMISSOES.PERM_ORCAMENTO_CRIAR),
  auditLog('ORCAMENTOS', 'CRIAR'),
  async (req, res, next) => {
    try {
      const data = orcamentoSchema.parse(req.body);

      // Calcular totais
      const totalItens = data.itens.reduce((sum, item) => {
        const subtotal = item.quantidade * item.preco_unitario;
        const desconto = subtotal * (item.desconto_pct / 100);
        return sum + (subtotal - desconto);
      }, 0);

      const descontoGlobal = totalItens * (data.desconto_global_pct / 100);
      const valorTotal = totalItens - descontoGlobal;

      // Calcular validade
      const validadeAte = new Date();
      validadeAte.setDate(validadeAte.getDate() + data.validade_dias);

      // TRANSACTION
      await db.transaction(async (tx) => {
        // 1. Criar orçamento
        const [novoOrcamento] = await tx
          .insert(orcamentos)
          .values({
            empresa_id: req.user.empresaId,
            cliente_id: data.cliente_id,
            vendedor_id: req.user.userId,
            status: 'PENDENTE',
            valor_total: valorTotal,
            desconto_pct: data.desconto_global_pct,
            validade_ate: validadeAte,
            observacoes: data.observacoes
          })
          .$returningId();

        const orcamentoId = novoOrcamento.id;

        // 2. Criar itens
        for (const item of data.itens) {
          const subtotal = item.quantidade * item.preco_unitario;
          const desconto = subtotal * (item.desconto_pct / 100);
          const total = subtotal - desconto;

          await tx.insert(itens_orcamento).values({
            orcamento_id: orcamentoId,
            produto_id: item.produto_id,
            quantidade: item.quantidade,
            preco_unit: item.preco_unitario,
            desconto_pct: item.desconto_pct,
            total
          });
        }
      });

      res.status(201).json({
        success: true,
        message: 'Orçamento criado com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  PUT /api/v1/orcamentos/:id/aprovar - Aprovar orçamento
// ═══════════════════════════════════════════════════════════════════════════════

router.put('/:id/aprovar',
  authenticate,
  requirePermissions(PERMISSOES.PERM_ORCAMENTO_APROVAR),
  auditLog('ORCAMENTOS', 'APROVAR'),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);

      const [orcamento] = await db
        .select()
        .from(orcamentos)
        .where(and(
          eq(orcamentos.id, id),
          eq(orcamentos.empresa_id, req.user.empresaId)
        ))
        .limit(1);

      if (!orcamento) {
        return res.status(404).json({
          success: false,
          message: 'Orçamento não encontrado'
        });
      }

      if (orcamento.status !== 'PENDENTE') {
        return res.status(400).json({
          success: false,
          message: 'Orçamento já foi processado'
        });
      }

      // Verificar validade
      if (new Date() > new Date(orcamento.validade_ate)) {
        return res.status(400).json({
          success: false,
          message: 'Orçamento vencido'
        });
      }

      await db
        .update(orcamentos)
        .set({
          status: 'APROVADO',
          aprovado_por: req.user.userId,
          aprovado_em: new Date()
        })
        .where(eq(orcamentos.id, id));

      res.json({
        success: true,
        message: 'Orçamento aprovado com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  PUT /api/v1/orcamentos/:id/recusar - Recusar orçamento
// ═══════════════════════════════════════════════════════════════════════════════

router.put('/:id/recusar',
  authenticate,
  requirePermissions(PERMISSOES.PERM_ORCAMENTO_APROVAR),
  auditLog('ORCAMENTOS', 'RECUSAR'),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);

      const [orcamento] = await db
        .select()
        .from(orcamentos)
        .where(and(
          eq(orcamentos.id, id),
          eq(orcamentos.empresa_id, req.user.empresaId)
        ))
        .limit(1);

      if (!orcamento) {
        return res.status(404).json({
          success: false,
          message: 'Orçamento não encontrado'
        });
      }

      if (orcamento.status !== 'PENDENTE') {
        return res.status(400).json({
          success: false,
          message: 'Orçamento já foi processado'
        });
      }

      await db
        .update(orcamentos)
        .set({ status: 'RECUSADO' })
        .where(eq(orcamentos.id, id));

      res.json({
        success: true,
        message: 'Orçamento recusado com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

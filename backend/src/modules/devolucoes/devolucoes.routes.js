import express from 'express';
import { z } from 'zod';
import db from '../../lib/db.js';
import {
  devolucoes,
  itens_devolucao,
  vendas,
  clientes,
  funcionarios,
  produtos,
  movimentacoes_estoque
} from '../../../drizzle/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { authenticate } from '../../middleware/auth.js';
import { requirePermissions } from '../../middleware/rbac.js';
import { auditLog } from '../../middleware/audit.js';
import { PERMISSOES } from '../../lib/permissions.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
//  SCHEMAS DE VALIDAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

const itemDevolucaoSchema = z.object({
  produto_id: z.number(),
  quantidade: z.number().positive(),
  preco_unit: z.number().positive(),
  destino_estoque: z.enum(['DISPONIVEL', 'DEFEITUOSO', 'DESCARTE']).default('DISPONIVEL')
});

const devolucaoSchema = z.object({
  venda_id: z.number(),
  tipo: z.enum(['DEVOLUCAO', 'TROCA']).default('DEVOLUCAO'),
  motivo: z.string().min(1, 'Motivo obrigatório'),
  itens: z.array(itemDevolucaoSchema).min(1, 'A devolução deve conter pelo menos 1 item'),
  observacoes: z.string().optional()
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/devolucoes - Listar devoluções
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/', authenticate, requirePermissions(PERMISSOES.PERM_DEVOLUCAO_CRIAR), async (req, res, next) => {
  try {
    const { status } = req.query;

    let query = db
      .select({
        devolucao: devolucoes,
        venda: {
          id: vendas.id,
          criado_em: vendas.criado_em
        },
        cliente: {
          id: clientes.id,
          nome: clientes.nome
        },
        solicitante: {
          id: funcionarios.id,
          nome: funcionarios.nome
        }
      })
      .from(devolucoes)
      .leftJoin(vendas, eq(devolucoes.venda_id, vendas.id))
      .leftJoin(clientes, eq(devolucoes.cliente_id, clientes.id))
      .leftJoin(funcionarios, eq(devolucoes.solicitante_id, funcionarios.id))
      .where(eq(devolucoes.empresa_id, req.user.empresaId));

    if (status) {
      query = query.where(eq(devolucoes.status, status));
    }

    const devolucoesList = await query;

    res.json({
      success: true,
      data: devolucoesList
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/devolucoes/:id - Buscar devolução por ID
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/:id', authenticate, requirePermissions(PERMISSOES.PERM_DEVOLUCAO_CRIAR), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    const [devolucao] = await db
      .select({
        devolucao: devolucoes,
        venda: vendas,
        cliente: clientes,
        solicitante: {
          id: funcionarios.id,
          nome: funcionarios.nome
        }
      })
      .from(devolucoes)
      .leftJoin(vendas, eq(devolucoes.venda_id, vendas.id))
      .leftJoin(clientes, eq(devolucoes.cliente_id, clientes.id))
      .leftJoin(funcionarios, eq(devolucoes.solicitante_id, funcionarios.id))
      .where(and(
        eq(devolucoes.id, id),
        eq(devolucoes.empresa_id, req.user.empresaId)
      ))
      .limit(1);

    if (!devolucao) {
      return res.status(404).json({
        success: false,
        message: 'Devolução não encontrada'
      });
    }

    // Buscar itens
    const itens = await db
      .select({
        item: itens_devolucao,
        produto: {
          id: produtos.id,
          codigo: produtos.codigo,
          nome: produtos.nome,
          unidade: produtos.unidade
        }
      })
      .from(itens_devolucao)
      .leftJoin(produtos, eq(itens_devolucao.produto_id, produtos.id))
      .where(eq(itens_devolucao.devolucao_id, id));

    res.json({
      success: true,
      data: {
        ...devolucao.devolucao,
        venda: devolucao.venda,
        cliente: devolucao.cliente,
        solicitante: devolucao.solicitante,
        itens
      }
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /api/v1/devolucoes - Criar devolução
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/',
  authenticate,
  requirePermissions(PERMISSOES.PERM_DEVOLUCAO_CRIAR),
  auditLog('DEVOLUCOES', 'CRIAR'),
  async (req, res, next) => {
    try {
      const data = devolucaoSchema.parse(req.body);

      // Verificar se venda existe
      const [venda] = await db
        .select()
        .from(vendas)
        .where(and(
          eq(vendas.id, data.venda_id),
          eq(vendas.empresa_id, req.user.empresaId)
        ))
        .limit(1);

      if (!venda) {
        return res.status(404).json({
          success: false,
          message: 'Venda não encontrada'
        });
      }

      if (venda.status === 'CANCELADO') {
        return res.status(400).json({
          success: false,
          message: 'Não é possível devolver itens de venda cancelada'
        });
      }

      // TRANSACTION
      await db.transaction(async (tx) => {
        // 1. Criar devolução
        const [novaDevolucao] = await tx
          .insert(devolucoes)
          .values({
            empresa_id: req.user.empresaId,
            venda_id: data.venda_id,
            cliente_id: venda.cliente_id,
            solicitante_id: req.user.userId,
            tipo: data.tipo,
            status: 'ABERTA',
            motivo: data.motivo,
            observacoes: data.observacoes
          })
          .$returningId();

        const devolucaoId = novaDevolucao.id;

        // 2. Criar itens
        for (const item of data.itens) {
          await tx.insert(itens_devolucao).values({
            devolucao_id: devolucaoId,
            produto_id: item.produto_id,
            quantidade: item.quantidade,
            preco_unit: item.preco_unit,
            destino_estoque: item.destino_estoque
          });
        }
      });

      res.status(201).json({
        success: true,
        message: 'Devolução criada com sucesso. Aguardando aprovação.'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  PUT /api/v1/devolucoes/:id/aprovar - Aprovar devolução
// ═══════════════════════════════════════════════════════════════════════════════

router.put('/:id/aprovar',
  authenticate,
  requirePermissions(PERMISSOES.PERM_DEVOLUCAO_APROVAR),
  auditLog('DEVOLUCOES', 'APROVAR'),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);

      const [devolucao] = await db
        .select()
        .from(devolucoes)
        .where(and(
          eq(devolucoes.id, id),
          eq(devolucoes.empresa_id, req.user.empresaId)
        ))
        .limit(1);

      if (!devolucao) {
        return res.status(404).json({
          success: false,
          message: 'Devolução não encontrada'
        });
      }

      if (devolucao.status !== 'ABERTA') {
        return res.status(400).json({
          success: false,
          message: 'Devolução já foi processada'
        });
      }

      // TRANSACTION: Aprovar e devolver ao estoque
      await db.transaction(async (tx) => {
        // 1. Atualizar status
        await tx
          .update(devolucoes)
          .set({
            status: 'APROVADA',
            aprovado_por: req.user.userId
          })
          .where(eq(devolucoes.id, id));

        // 2. Devolver itens ao estoque
        const itens = await tx
          .select()
          .from(itens_devolucao)
          .where(eq(itens_devolucao.devolucao_id, id));

        for (const item of itens) {
          // Só retorna ao estoque se destino for DISPONIVEL
          if (item.destino_estoque === 'DISPONIVEL') {
            await tx
              .update(produtos)
              .set({
                estoque_atual: sql`${produtos.estoque_atual} + ${item.quantidade}`
              })
              .where(eq(produtos.id, item.produto_id));

            // Registrar movimentação
            await tx.insert(movimentacoes_estoque).values({
              empresa_id: req.user.empresaId,
              produto_id: item.produto_id,
              tipo: 'ENTRADA',
              origem: 'DEVOLUCAO',
              quantidade: item.quantidade,
              saldo_anterior: sql`(SELECT estoque_atual FROM produtos WHERE id = ${item.produto_id}) - ${item.quantidade}`,
              saldo_posterior: sql`(SELECT estoque_atual FROM produtos WHERE id = ${item.produto_id})`,
              venda_id: devolucao.venda_id,
              funcionario_id: req.user.userId,
              observacoes: `Devolução #${id} - ${devolucao.motivo}`
            });
          }
        }
      });

      res.json({
        success: true,
        message: 'Devolução aprovada com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  PUT /api/v1/devolucoes/:id/rejeitar - Rejeitar devolução
// ═══════════════════════════════════════════════════════════════════════════════

router.put('/:id/rejeitar',
  authenticate,
  requirePermissions(PERMISSOES.PERM_DEVOLUCAO_APROVAR),
  auditLog('DEVOLUCOES', 'REJEITAR'),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const { motivo_rejeicao } = req.body;

      const [devolucao] = await db
        .select()
        .from(devolucoes)
        .where(and(
          eq(devolucoes.id, id),
          eq(devolucoes.empresa_id, req.user.empresaId)
        ))
        .limit(1);

      if (!devolucao) {
        return res.status(404).json({
          success: false,
          message: 'Devolução não encontrada'
        });
      }

      if (devolucao.status !== 'ABERTA') {
        return res.status(400).json({
          success: false,
          message: 'Devolução já foi processada'
        });
      }

      await db
        .update(devolucoes)
        .set({
          status: 'REJEITADA',
          observacoes: motivo_rejeicao
        })
        .where(eq(devolucoes.id, id));

      res.json({
        success: true,
        message: 'Devolução rejeitada'
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

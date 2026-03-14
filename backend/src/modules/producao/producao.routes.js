import express from 'express';
import { z } from 'zod';
import db from '../../lib/db.js';
import {
  ordens_producao,
  itens_op,
  etapas_op,
  produtos,
  clientes,
  vendas,
  funcionarios,
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

const itemOpSchema = z.object({
  produto_id: z.number(),
  quantidade_plan: z.number().positive()
});

const ordemProducaoSchema = z.object({
  tipo_produto: z.enum(['PORTA', 'PORTAO', 'JANELA', 'VENEZIANA', 'GRADE', 'OUTRO']),
  descricao: z.string().min(1, 'Descrição obrigatória'),
  largura_cm: z.number().optional(),
  altura_cm: z.number().optional(),
  cliente_id: z.number().optional(),
  venda_id: z.number().optional(),
  prioridade: z.enum(['BAIXA', 'NORMAL', 'ALTA', 'URGENTE']).default('NORMAL'),
  prazo_entrega: z.string().optional(),
  itens: z.array(itemOpSchema).min(1, 'A OP deve conter pelo menos 1 item'),
  observacoes: z.string().optional()
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/producao - Listar ordens de produção
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/', authenticate, requirePermissions(PERMISSOES.PERM_OP_LISTAR), async (req, res, next) => {
  try {
    const { status, prioridade } = req.query;

    let query = db
      .select({
        op: ordens_producao,
        cliente: {
          id: clientes.id,
          nome: clientes.nome
        },
        operador: {
          id: funcionarios.id,
          nome: funcionarios.nome
        }
      })
      .from(ordens_producao)
      .leftJoin(clientes, eq(ordens_producao.cliente_id, clientes.id))
      .leftJoin(funcionarios, eq(ordens_producao.operador_id, funcionarios.id))
      .where(eq(ordens_producao.empresa_id, req.user.empresaId));

    if (status) {
      query = query.where(eq(ordens_producao.status, status));
    }

    if (prioridade) {
      query = query.where(eq(ordens_producao.prioridade, prioridade));
    }

    const opsList = await query;

    res.json({
      success: true,
      data: opsList
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/producao/:id - Buscar OP por ID
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/:id', authenticate, requirePermissions(PERMISSOES.PERM_OP_LISTAR), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    const [op] = await db
      .select({
        op: ordens_producao,
        cliente: clientes,
        venda: vendas,
        operador: {
          id: funcionarios.id,
          nome: funcionarios.nome
        }
      })
      .from(ordens_producao)
      .leftJoin(clientes, eq(ordens_producao.cliente_id, clientes.id))
      .leftJoin(vendas, eq(ordens_producao.venda_id, vendas.id))
      .leftJoin(funcionarios, eq(ordens_producao.operador_id, funcionarios.id))
      .where(and(
        eq(ordens_producao.id, id),
        eq(ordens_producao.empresa_id, req.user.empresaId)
      ))
      .limit(1);

    if (!op) {
      return res.status(404).json({
        success: false,
        message: 'Ordem de produção não encontrada'
      });
    }

    // Buscar itens
    const itens = await db
      .select({
        item: itens_op,
        produto: {
          id: produtos.id,
          codigo: produtos.codigo,
          nome: produtos.nome,
          unidade: produtos.unidade
        }
      })
      .from(itens_op)
      .leftJoin(produtos, eq(itens_op.produto_id, produtos.id))
      .where(eq(itens_op.op_id, id));

    // Buscar etapas
    const etapas = await db
      .select({
        etapa: etapas_op,
        operador: {
          id: funcionarios.id,
          nome: funcionarios.nome
        }
      })
      .from(etapas_op)
      .leftJoin(funcionarios, eq(etapas_op.operador_id, funcionarios.id))
      .where(eq(etapas_op.op_id, id));

    res.json({
      success: true,
      data: {
        ...op.op,
        cliente: op.cliente,
        venda: op.venda,
        operador: op.operador,
        itens,
        etapas
      }
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /api/v1/producao - Criar ordem de produção
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/',
  authenticate,
  requirePermissions(PERMISSOES.PERM_OP_CRIAR),
  auditLog('PRODUCAO', 'CRIAR'),
  async (req, res, next) => {
    try {
      const data = ordemProducaoSchema.parse(req.body);

      // Gerar número sequencial da OP
      const [lastOp] = await db
        .select({ numero: ordens_producao.numero })
        .from(ordens_producao)
        .where(eq(ordens_producao.empresa_id, req.user.empresaId))
        .orderBy(sql`id DESC`)
        .limit(1);

      const nextNumber = lastOp ? parseInt(lastOp.numero.split('-')[1]) + 1 : 1;
      const numero = `OP-${String(nextNumber).padStart(6, '0')}`;

      // Verificar disponibilidade de estoque
      for (const item of data.itens) {
        const [produto] = await db
          .select()
          .from(produtos)
          .where(and(
            eq(produtos.id, item.produto_id),
            eq(produtos.empresa_id, req.user.empresaId)
          ))
          .limit(1);

        if (!produto) {
          return res.status(404).json({
            success: false,
            message: `Produto ID ${item.produto_id} não encontrado`
          });
        }

        if (produto.estoque_atual < item.quantidade_plan) {
          return res.status(400).json({
            success: false,
            message: `Estoque insuficiente para ${produto.nome}. Disponível: ${produto.estoque_atual}`
          });
        }
      }

      // TRANSACTION
      await db.transaction(async (tx) => {
        // 1. Criar OP
        const [novaOp] = await tx
          .insert(ordens_producao)
          .values({
            empresa_id: req.user.empresaId,
            numero,
            tipo_produto: data.tipo_produto,
            descricao: data.descricao,
            largura_cm: data.largura_cm,
            altura_cm: data.altura_cm,
            cliente_id: data.cliente_id,
            venda_id: data.venda_id,
            status: 'PLANEJADA',
            prioridade: data.prioridade,
            prazo_entrega: data.prazo_entrega ? new Date(data.prazo_entrega) : null,
            observacoes: data.observacoes
          })
          .$returningId();

        const opId = novaOp.id;

        // 2. Criar itens e reservar estoque
        for (const item of data.itens) {
          await tx.insert(itens_op).values({
            op_id: opId,
            produto_id: item.produto_id,
            quantidade_plan: item.quantidade_plan,
            status: 'RESERVADO'
          });

          // Reservar estoque
          await tx
            .update(produtos)
            .set({
              estoque_reservado: sql`${produtos.estoque_reservado} + ${item.quantidade_plan}`
            })
            .where(eq(produtos.id, item.produto_id));

          // Registrar movimentação
          await tx.insert(movimentacoes_estoque).values({
            empresa_id: req.user.empresaId,
            produto_id: item.produto_id,
            tipo: 'SAIDA',
            origem: 'PRODUCAO_RESERVA',
            quantidade: item.quantidade_plan,
            funcionario_id: req.user.userId,
            observacoes: `Reserva para ${numero}`
          });
        }

        // 3. Criar etapas padrão
        const etapasPadrao = ['CORTE', 'MONTAGEM', 'ACABAMENTO'];
        for (const nomeEtapa of etapasPadrao) {
          await tx.insert(etapas_op).values({
            op_id: opId,
            nome: nomeEtapa,
            status: 'PENDENTE'
          });
        }
      });

      res.status(201).json({
        success: true,
        message: `Ordem de produção ${numero} criada com sucesso`,
        data: { numero }
      });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  PUT /api/v1/producao/:id/iniciar - Iniciar OP
// ═══════════════════════════════════════════════════════════════════════════════

router.put('/:id/iniciar',
  authenticate,
  requirePermissions(PERMISSOES.PERM_OP_ATUALIZAR_STATUS),
  auditLog('PRODUCAO', 'INICIAR'),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);

      const [op] = await db
        .select()
        .from(ordens_producao)
        .where(and(
          eq(ordens_producao.id, id),
          eq(ordens_producao.empresa_id, req.user.empresaId)
        ))
        .limit(1);

      if (!op) {
        return res.status(404).json({
          success: false,
          message: 'OP não encontrada'
        });
      }

      if (op.status !== 'PLANEJADA' && op.status !== 'LIBERADA') {
        return res.status(400).json({
          success: false,
          message: 'OP não pode ser iniciada neste status'
        });
      }

      await db
        .update(ordens_producao)
        .set({
          status: 'EM_PRODUCAO',
          operador_id: req.user.userId,
          iniciada_em: new Date()
        })
        .where(eq(ordens_producao.id, id));

      res.json({
        success: true,
        message: 'OP iniciada com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  PUT /api/v1/producao/:id/concluir - Concluir OP
// ═══════════════════════════════════════════════════════════════════════════════

router.put('/:id/concluir',
  authenticate,
  requirePermissions(PERMISSOES.PERM_OP_CONCLUIR),
  auditLog('PRODUCAO', 'CONCLUIR'),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);

      const [op] = await db
        .select()
        .from(ordens_producao)
        .where(and(
          eq(ordens_producao.id, id),
          eq(ordens_producao.empresa_id, req.user.empresaId)
        ))
        .limit(1);

      if (!op) {
        return res.status(404).json({
          success: false,
          message: 'OP não encontrada'
        });
      }

      if (op.status !== 'EM_PRODUCAO') {
        return res.status(400).json({
          success: false,
          message: 'OP não está em produção'
        });
      }

      // Calcular tempo total
      const tempoTotalMin = op.iniciada_em
        ? Math.floor((new Date() - new Date(op.iniciada_em)) / 60000)
        : 0;

      await db
        .update(ordens_producao)
        .set({
          status: 'CONCLUIDA',
          concluida_em: new Date(),
          tempo_total_min: tempoTotalMin
        })
        .where(eq(ordens_producao.id, id));

      // Liberar estoque reservado
      const itens = await db
        .select()
        .from(itens_op)
        .where(eq(itens_op.op_id, id));

      for (const item of itens) {
        await db
          .update(produtos)
          .set({
            estoque_reservado: sql`${produtos.estoque_reservado} - ${item.quantidade_plan}`
          })
          .where(eq(produtos.id, item.produto_id));
      }

      res.json({
        success: true,
        message: 'OP concluída com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /api/v1/producao/:id/refugo - Registrar refugo
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:id/refugo',
  authenticate,
  requirePermissions(PERMISSOES.PERM_OP_REGISTRAR_REFUGO),
  auditLog('PRODUCAO', 'REFUGO'),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const { produto_id, quantidade, motivo } = req.body;

      const [op] = await db
        .select()
        .from(ordens_producao)
        .where(and(
          eq(ordens_producao.id, id),
          eq(ordens_producao.empresa_id, req.user.empresaId)
        ))
        .limit(1);

      if (!op) {
        return res.status(404).json({
          success: false,
          message: 'OP não encontrada'
        });
      }

      // Atualizar refugo no item
      await db
        .update(itens_op)
        .set({
          quantidade_refu: sql`${itens_op.quantidade_refu} + ${quantidade}`
        })
        .where(and(
          eq(itens_op.op_id, id),
          eq(itens_op.produto_id, produto_id)
        ));

      // Registrar movimentação
      await db.insert(movimentacoes_estoque).values({
        empresa_id: req.user.empresaId,
        produto_id,
        tipo: 'SAIDA',
        origem: 'REFUGO',
        quantidade,
        funcionario_id: req.user.userId,
        observacoes: `Refugo ${op.numero} - ${motivo}`
      });

      res.json({
        success: true,
        message: 'Refugo registrado com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

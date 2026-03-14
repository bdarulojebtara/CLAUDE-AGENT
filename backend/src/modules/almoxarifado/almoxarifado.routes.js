import express from 'express';
import { z } from 'zod';
import db from '../../lib/db.js';
import {
  produtos,
  movimentacoes_estoque,
  ferramentas,
  saidas_ferramenta,
  funcionarios
} from '../../../drizzle/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { authenticate } from '../../middleware/auth.js';
import { requirePermissions } from '../../middleware/rbac.js';
import { auditLog } from '../../middleware/audit.js';
import { PERMISSOES } from '../../lib/permissions.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
//  MOVIMENTAÇÕES DE ESTOQUE
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/movimentacoes', authenticate, requirePermissions(PERMISSOES.PERM_PRODUTO_VER_ESTOQUE), async (req, res, next) => {
  try {
    const { produto_id, tipo, origem } = req.query;

    let query = db
      .select({
        movimentacao: movimentacoes_estoque,
        produto: {
          id: produtos.id,
          codigo: produtos.codigo,
          nome: produtos.nome
        },
        funcionario: {
          id: funcionarios.id,
          nome: funcionarios.nome
        }
      })
      .from(movimentacoes_estoque)
      .leftJoin(produtos, eq(movimentacoes_estoque.produto_id, produtos.id))
      .leftJoin(funcionarios, eq(movimentacoes_estoque.funcionario_id, funcionarios.id))
      .where(eq(movimentacoes_estoque.empresa_id, req.user.empresaId));

    if (produto_id) {
      query = query.where(eq(movimentacoes_estoque.produto_id, parseInt(produto_id)));
    }

    if (tipo) {
      query = query.where(eq(movimentacoes_estoque.tipo, tipo));
    }

    if (origem) {
      query = query.where(eq(movimentacoes_estoque.origem, origem));
    }

    const movimentacoes = await query;

    res.json({
      success: true,
      data: movimentacoes
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /api/v1/almoxarifado/entrada - Entrada de mercadoria
// ═══════════════════════════════════════════════════════════════════════════════

const entradaMercadoriaSchema = z.object({
  produto_id: z.number(),
  quantidade: z.number().positive(),
  origem: z.enum(['COMPRA', 'DEVOLUCAO', 'AJUSTE', 'PRODUCAO', 'OUTRO']),
  observacoes: z.string().optional()
});

router.post('/entrada',
  authenticate,
  requirePermissions(PERMISSOES.PERM_ALMOX_ENTRADA_MERCADORIA),
  auditLog('ALMOXARIFADO', 'ENTRADA'),
  async (req, res, next) => {
    try {
      const data = entradaMercadoriaSchema.parse(req.body);

      const [produto] = await db
        .select()
        .from(produtos)
        .where(and(
          eq(produtos.id, data.produto_id),
          eq(produtos.empresa_id, req.user.empresaId)
        ))
        .limit(1);

      if (!produto) {
        return res.status(404).json({
          success: false,
          message: 'Produto não encontrado'
        });
      }

      const saldoAnterior = produto.estoque_atual;

      // Atualizar estoque
      await db
        .update(produtos)
        .set({
          estoque_atual: sql`${produtos.estoque_atual} + ${data.quantidade}`
        })
        .where(eq(produtos.id, data.produto_id));

      // Registrar movimentação
      await db.insert(movimentacoes_estoque).values({
        empresa_id: req.user.empresaId,
        produto_id: data.produto_id,
        tipo: 'ENTRADA',
        origem: data.origem,
        quantidade: data.quantidade,
        saldo_anterior: saldoAnterior,
        saldo_posterior: saldoAnterior + data.quantidade,
        funcionario_id: req.user.userId,
        observacoes: data.observacoes
      });

      res.json({
        success: true,
        message: 'Entrada de mercadoria registrada com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  FERRAMENTAS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/ferramentas', authenticate, requirePermissions(PERMISSOES.PERM_FERRAMENTA_LISTAR), async (req, res, next) => {
  try {
    const ferramentasList = await db
      .select()
      .from(ferramentas)
      .where(eq(ferramentas.empresa_id, req.user.empresaId));

    res.json({
      success: true,
      data: ferramentasList
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /api/v1/almoxarifado/ferramentas/saida - Saída de ferramenta
// ═══════════════════════════════════════════════════════════════════════════════

const saidaFerramentaSchema = z.object({
  ferramenta_id: z.number(),
  funcionario_id: z.number(),
  observacoes: z.string().optional()
});

router.post('/ferramentas/saida',
  authenticate,
  requirePermissions(PERMISSOES.PERM_FERRAMENTA_SAIDA),
  auditLog('ALMOXARIFADO', 'SAIDA_FERRAMENTA'),
  async (req, res, next) => {
    try {
      const data = saidaFerramentaSchema.parse(req.body);

      const [ferramenta] = await db
        .select()
        .from(ferramentas)
        .where(and(
          eq(ferramentas.id, data.ferramenta_id),
          eq(ferramentas.empresa_id, req.user.empresaId)
        ))
        .limit(1);

      if (!ferramenta) {
        return res.status(404).json({
          success: false,
          message: 'Ferramenta não encontrada'
        });
      }

      if (ferramenta.status !== 'DISPONIVEL') {
        return res.status(400).json({
          success: false,
          message: 'Ferramenta não está disponível'
        });
      }

      // Registrar saída
      await db.insert(saidas_ferramenta).values({
        empresa_id: req.user.empresaId,
        ferramenta_id: data.ferramenta_id,
        funcionario_id: data.funcionario_id,
        data_saida: new Date(),
        responsavel_saida: req.user.userId,
        observacoes: data.observacoes
      });

      // Atualizar status
      await db
        .update(ferramentas)
        .set({ status: 'EM_USO' })
        .where(eq(ferramentas.id, data.ferramenta_id));

      res.json({
        success: true,
        message: 'Saída de ferramenta registrada com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  PUT /api/v1/almoxarifado/ferramentas/:id/devolver - Devolução de ferramenta
// ═══════════════════════════════════════════════════════════════════════════════

router.put('/ferramentas/:id/devolver',
  authenticate,
  requirePermissions(PERMISSOES.PERM_FERRAMENTA_DEVOLUCAO),
  auditLog('ALMOXARIFADO', 'DEVOLUCAO_FERRAMENTA'),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const { estado } = req.body; // 'BOM', 'MANUTENCAO', 'QUEBRADO'

      // Buscar saída ativa
      const [saida] = await db
        .select()
        .from(saidas_ferramenta)
        .where(and(
          eq(saidas_ferramenta.ferramenta_id, id),
          eq(saidas_ferramenta.empresa_id, req.user.empresaId),
          sql`${saidas_ferramenta.data_devolucao} IS NULL`
        ))
        .limit(1);

      if (!saida) {
        return res.status(404).json({
          success: false,
          message: 'Ferramenta não está emprestada'
        });
      }

      // Registrar devolução
      await db
        .update(saidas_ferramenta)
        .set({
          data_devolucao: new Date(),
          responsavel_devolucao: req.user.userId
        })
        .where(eq(saidas_ferramenta.id, saida.id));

      // Atualizar status da ferramenta
      const novoStatus = estado === 'BOM' ? 'DISPONIVEL' : estado === 'MANUTENCAO' ? 'MANUTENCAO' : 'QUEBRADO';

      await db
        .update(ferramentas)
        .set({ status: novoStatus })
        .where(eq(ferramentas.id, id));

      res.json({
        success: true,
        message: 'Devolução de ferramenta registrada com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/almoxarifado/separacao - Itens para separação (vendas pendentes)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/separacao', authenticate, requirePermissions(PERMISSOES.PERM_ALMOX_SEPARACAO), async (req, res, next) => {
  try {
    // Buscar vendas que precisam de separação
    // Esta rota pode ser expandida conforme necessidade de separação de pedidos
    res.json({
      success: true,
      data: [],
      message: 'Funcionalidade de separação será expandida conforme necessidade'
    });
  } catch (error) {
    next(error);
  }
});

export default router;

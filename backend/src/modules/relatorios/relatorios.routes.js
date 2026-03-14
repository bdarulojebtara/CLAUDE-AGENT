import express from 'express';
import db from '../../lib/db.js';
import {
  vendas,
  itens_venda,
  produtos,
  clientes,
  funcionarios,
  contas_receber,
  contas_pagar,
  movimentacoes_estoque
} from '../../../drizzle/schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { authenticate } from '../../middleware/auth.js';
import { requirePermissions } from '../../middleware/rbac.js';
import { PERMISSOES } from '../../lib/permissions.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/relatorios/vendas - Relatório de vendas
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/vendas', authenticate, requirePermissions(PERMISSOES.PERM_RELATORIO_FINANCEIRO), async (req, res, next) => {
  try {
    const { data_inicio, data_fim, vendedor_id } = req.query;

    if (!data_inicio || !data_fim) {
      return res.status(400).json({
        success: false,
        message: 'data_inicio e data_fim são obrigatórios'
      });
    }

    let query = db
      .select({
        venda: vendas,
        vendedor: {
          id: funcionarios.id,
          nome: funcionarios.nome
        },
        cliente: {
          id: clientes.id,
          nome: clientes.nome
        }
      })
      .from(vendas)
      .leftJoin(funcionarios, eq(vendas.vendedor_id, funcionarios.id))
      .leftJoin(clientes, eq(vendas.cliente_id, clientes.id))
      .where(and(
        eq(vendas.empresa_id, req.user.empresaId),
        gte(vendas.criado_em, new Date(data_inicio)),
        lte(vendas.criado_em, new Date(data_fim))
      ));

    if (vendedor_id) {
      query = query.where(eq(vendas.vendedor_id, parseInt(vendedor_id)));
    }

    const vendasList = await query;

    // Calcular totalizadores
    const totais = vendasList.reduce((acc, { venda }) => {
      acc.quantidade++;
      acc.valor_total += parseFloat(venda.valor_total);
      acc.custo_total += parseFloat(venda.custo_total || 0);
      acc.lucro_bruto += parseFloat(venda.lucro_bruto || 0);
      acc.comissoes_devidas += parseFloat(venda.comissao_devida || 0);
      return acc;
    }, {
      quantidade: 0,
      valor_total: 0,
      custo_total: 0,
      lucro_bruto: 0,
      comissoes_devidas: 0
    });

    totais.margem_media = totais.valor_total > 0
      ? (totais.lucro_bruto / totais.valor_total) * 100
      : 0;

    res.json({
      success: true,
      data: {
        vendas: vendasList,
        totais
      }
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/relatorios/produtos-mais-vendidos - Top produtos
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/produtos-mais-vendidos', authenticate, requirePermissions(PERMISSOES.PERM_RELATORIO_FINANCEIRO), async (req, res, next) => {
  try {
    const { data_inicio, data_fim, limit = 10 } = req.query;

    if (!data_inicio || !data_fim) {
      return res.status(400).json({
        success: false,
        message: 'data_inicio e data_fim são obrigatórios'
      });
    }

    const topProdutos = await db
      .select({
        produto_id: itens_venda.produto_id,
        produto_nome: produtos.nome,
        produto_codigo: produtos.codigo,
        quantidade_vendida: sql`SUM(${itens_venda.quantidade})`,
        valor_total: sql`SUM(${itens_venda.total})`
      })
      .from(itens_venda)
      .leftJoin(vendas, eq(itens_venda.venda_id, vendas.id))
      .leftJoin(produtos, eq(itens_venda.produto_id, produtos.id))
      .where(and(
        eq(vendas.empresa_id, req.user.empresaId),
        gte(vendas.criado_em, new Date(data_inicio)),
        lte(vendas.criado_em, new Date(data_fim))
      ))
      .groupBy(itens_venda.produto_id, produtos.nome, produtos.codigo)
      .orderBy(sql`SUM(${itens_venda.total}) DESC`)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: topProdutos
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/relatorios/estoque - Relatório de estoque
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/estoque', authenticate, requirePermissions(PERMISSOES.PERM_PRODUTO_VER_ESTOQUE), async (req, res, next) => {
  try {
    const { categoria, somente_baixo } = req.query;

    let query = db
      .select()
      .from(produtos)
      .where(eq(produtos.empresa_id, req.user.empresaId));

    if (categoria) {
      query = query.where(eq(produtos.categoria, categoria));
    }

    const produtosList = await query;

    // Filtrar produtos com estoque baixo se solicitado
    let produtosFiltrados = produtosList;
    if (somente_baixo === 'true') {
      produtosFiltrados = produtosList.filter(p =>
        p.estoque_atual <= p.estoque_minimo
      );
    }

    // Calcular totalizadores
    const totais = {
      total_produtos: produtosFiltrados.length,
      produtos_estoque_baixo: produtosFiltrados.filter(p => p.estoque_atual <= p.estoque_minimo).length,
      produtos_sem_estoque: produtosFiltrados.filter(p => p.estoque_atual === 0).length,
      valor_total_estoque: produtosFiltrados.reduce((sum, p) =>
        sum + (parseFloat(p.preco_venda) * parseFloat(p.estoque_atual)), 0
      )
    };

    res.json({
      success: true,
      data: {
        produtos: produtosFiltrados,
        totais
      }
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/relatorios/financeiro - Resumo financeiro
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/financeiro', authenticate, requirePermissions(PERMISSOES.PERM_RELATORIO_FINANCEIRO), async (req, res, next) => {
  try {
    const { data_inicio, data_fim } = req.query;

    if (!data_inicio || !data_fim) {
      return res.status(400).json({
        success: false,
        message: 'data_inicio e data_fim são obrigatórios'
      });
    }

    // Vendas do período
    const [vendasPeriodo] = await db
      .select({
        total: sql`SUM(${vendas.valor_total})`,
        quantidade: sql`COUNT(${vendas.id})`
      })
      .from(vendas)
      .where(and(
        eq(vendas.empresa_id, req.user.empresaId),
        gte(vendas.criado_em, new Date(data_inicio)),
        lte(vendas.criado_em, new Date(data_fim)),
        eq(vendas.status, 'PAGO')
      ));

    // Contas a receber
    const [receber] = await db
      .select({
        total_pendente: sql`SUM(CASE WHEN ${contas_receber.status} = 'PENDENTE' THEN ${contas_receber.valor} ELSE 0 END)`,
        total_recebido: sql`SUM(CASE WHEN ${contas_receber.status} = 'RECEBIDO' THEN ${contas_receber.valor} ELSE 0 END)`,
        total_atrasado: sql`SUM(CASE WHEN ${contas_receber.status} = 'ATRASADO' THEN ${contas_receber.valor} ELSE 0 END)`
      })
      .from(contas_receber)
      .where(eq(contas_receber.empresa_id, req.user.empresaId));

    // Contas a pagar
    const [pagar] = await db
      .select({
        total_pendente: sql`SUM(CASE WHEN ${contas_pagar.status} = 'PENDENTE' THEN ${contas_pagar.valor} ELSE 0 END)`,
        total_pago: sql`SUM(CASE WHEN ${contas_pagar.status} = 'PAGO' THEN ${contas_pagar.valor} ELSE 0 END)`,
        total_atrasado: sql`SUM(CASE WHEN ${contas_pagar.status} = 'ATRASADO' THEN ${contas_pagar.valor} ELSE 0 END)`
      })
      .from(contas_pagar)
      .where(eq(contas_pagar.empresa_id, req.user.empresaId));

    res.json({
      success: true,
      data: {
        vendas: {
          total: vendasPeriodo.total || 0,
          quantidade: vendasPeriodo.quantidade || 0
        },
        contas_receber: {
          pendente: receber.total_pendente || 0,
          recebido: receber.total_recebido || 0,
          atrasado: receber.total_atrasado || 0
        },
        contas_pagar: {
          pendente: pagar.total_pendente || 0,
          pago: pagar.total_pago || 0,
          atrasado: pagar.total_atrasado || 0
        },
        saldo_projetado: (receber.total_pendente || 0) - (pagar.total_pendente || 0)
      }
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/relatorios/comissoes - Relatório de comissões
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/comissoes', authenticate, requirePermissions(PERMISSOES.PERM_COMISSAO_VER), async (req, res, next) => {
  try {
    const { data_inicio, data_fim, vendedor_id, status_pagamento } = req.query;

    if (!data_inicio || !data_fim) {
      return res.status(400).json({
        success: false,
        message: 'data_inicio e data_fim são obrigatórios'
      });
    }

    let query = db
      .select({
        vendedor_id: funcionarios.id,
        vendedor_nome: funcionarios.nome,
        total_vendas: sql`COUNT(${vendas.id})`,
        valor_total_vendido: sql`SUM(${vendas.valor_total})`,
        comissao_total: sql`SUM(${vendas.comissao_devida})`,
        comissao_paga: sql`SUM(CASE WHEN ${vendas.comissao_paga} = true THEN ${vendas.comissao_devida} ELSE 0 END)`,
        comissao_pendente: sql`SUM(CASE WHEN ${vendas.comissao_paga} = false THEN ${vendas.comissao_devida} ELSE 0 END)`
      })
      .from(vendas)
      .leftJoin(funcionarios, eq(vendas.vendedor_id, funcionarios.id))
      .where(and(
        eq(vendas.empresa_id, req.user.empresaId),
        gte(vendas.criado_em, new Date(data_inicio)),
        lte(vendas.criado_em, new Date(data_fim)),
        eq(vendas.status, 'PAGO')
      ))
      .groupBy(funcionarios.id, funcionarios.nome);

    if (vendedor_id) {
      query = query.where(eq(vendas.vendedor_id, parseInt(vendedor_id)));
    }

    const comissoes = await query;

    res.json({
      success: true,
      data: comissoes
    });
  } catch (error) {
    next(error);
  }
});

export default router;

import express from 'express';
import { z } from 'zod';
import db from '../../lib/db.js';
import {
  contas_receber,
  contas_pagar,
  caixas,
  movimentacoes_caixa,
  clientes,
  fornecedores,
  funcionarios,
  vendas
} from '../../../drizzle/schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { authenticate } from '../../middleware/auth.js';
import { requirePermissions } from '../../middleware/rbac.js';
import { auditLog } from '../../middleware/audit.js';
import { PERMISSOES } from '../../lib/permissions.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
//  CONTAS A RECEBER
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/contas-receber', authenticate, requirePermissions(PERMISSOES.PERM_FINANCEIRO_VER), async (req, res, next) => {
  try {
    const { status, data_inicio, data_fim } = req.query;

    let query = db
      .select({
        conta: contas_receber,
        cliente: {
          id: clientes.id,
          nome: clientes.nome
        }
      })
      .from(contas_receber)
      .leftJoin(clientes, eq(contas_receber.cliente_id, clientes.id))
      .where(eq(contas_receber.empresa_id, req.user.empresaId));

    if (status) {
      query = query.where(eq(contas_receber.status, status));
    }

    if (data_inicio) {
      query = query.where(gte(contas_receber.vencimento, new Date(data_inicio)));
    }

    if (data_fim) {
      query = query.where(lte(contas_receber.vencimento, new Date(data_fim)));
    }

    const contas = await query;

    res.json({
      success: true,
      data: contas
    });
  } catch (error) {
    next(error);
  }
});

router.put('/contas-receber/:id/receber',
  authenticate,
  requirePermissions(PERMISSOES.PERM_CONTAS_PAGAR),
  auditLog('FINANCEIRO', 'RECEBER_CONTA'),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const { forma_pgto } = req.body;

      const [conta] = await db
        .select()
        .from(contas_receber)
        .where(and(
          eq(contas_receber.id, id),
          eq(contas_receber.empresa_id, req.user.empresaId)
        ))
        .limit(1);

      if (!conta) {
        return res.status(404).json({
          success: false,
          message: 'Conta não encontrada'
        });
      }

      if (conta.status === 'RECEBIDO') {
        return res.status(400).json({
          success: false,
          message: 'Conta já foi recebida'
        });
      }

      await db
        .update(contas_receber)
        .set({
          status: 'RECEBIDO',
          recebido_em: new Date(),
          forma_pgto
        })
        .where(eq(contas_receber.id, id));

      res.json({
        success: true,
        message: 'Conta marcada como recebida'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  CONTAS A PAGAR
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/contas-pagar', authenticate, requirePermissions(PERMISSOES.PERM_FINANCEIRO_VER), async (req, res, next) => {
  try {
    const { status, data_inicio, data_fim } = req.query;

    let query = db
      .select({
        conta: contas_pagar,
        fornecedor: {
          id: fornecedores.id,
          nome: fornecedores.nome
        }
      })
      .from(contas_pagar)
      .leftJoin(fornecedores, eq(contas_pagar.fornecedor_id, fornecedores.id))
      .where(eq(contas_pagar.empresa_id, req.user.empresaId));

    if (status) {
      query = query.where(eq(contas_pagar.status, status));
    }

    if (data_inicio) {
      query = query.where(gte(contas_pagar.vencimento, new Date(data_inicio)));
    }

    if (data_fim) {
      query = query.where(lte(contas_pagar.vencimento, new Date(data_fim)));
    }

    const contas = await query;

    res.json({
      success: true,
      data: contas
    });
  } catch (error) {
    next(error);
  }
});

router.put('/contas-pagar/:id/pagar',
  authenticate,
  requirePermissions(PERMISSOES.PERM_CONTAS_PAGAR),
  auditLog('FINANCEIRO', 'PAGAR_CONTA'),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const { forma_pgto } = req.body;

      const [conta] = await db
        .select()
        .from(contas_pagar)
        .where(and(
          eq(contas_pagar.id, id),
          eq(contas_pagar.empresa_id, req.user.empresaId)
        ))
        .limit(1);

      if (!conta) {
        return res.status(404).json({
          success: false,
          message: 'Conta não encontrada'
        });
      }

      if (conta.status === 'PAGO') {
        return res.status(400).json({
          success: false,
          message: 'Conta já foi paga'
        });
      }

      await db
        .update(contas_pagar)
        .set({
          status: 'PAGO',
          pago_em: new Date(),
          forma_pgto
        })
        .where(eq(contas_pagar.id, id));

      res.json({
        success: true,
        message: 'Conta marcada como paga'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  CAIXA
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/caixa', authenticate, requirePermissions(PERMISSOES.PERM_FINANCEIRO_VER), async (req, res, next) => {
  try {
    const [caixaAberto] = await db
      .select({
        caixa: caixas,
        funcionario: {
          id: funcionarios.id,
          nome: funcionarios.nome
        }
      })
      .from(caixas)
      .leftJoin(funcionarios, eq(caixas.aberto_por, funcionarios.id))
      .where(and(
        eq(caixas.empresa_id, req.user.empresaId),
        eq(caixas.status, 'ABERTO')
      ))
      .limit(1);

    res.json({
      success: true,
      data: caixaAberto || null
    });
  } catch (error) {
    next(error);
  }
});

router.post('/caixa/abrir',
  authenticate,
  requirePermissions(PERMISSOES.PERM_CAIXA_ABRIR),
  auditLog('FINANCEIRO', 'ABRIR_CAIXA'),
  async (req, res, next) => {
    try {
      const { saldo_inicial } = req.body;

      // Verificar se já existe caixa aberto
      const [caixaAberto] = await db
        .select()
        .from(caixas)
        .where(and(
          eq(caixas.empresa_id, req.user.empresaId),
          eq(caixas.status, 'ABERTO')
        ))
        .limit(1);

      if (caixaAberto) {
        return res.status(400).json({
          success: false,
          message: 'Já existe um caixa aberto'
        });
      }

      await db.insert(caixas).values({
        empresa_id: req.user.empresaId,
        aberto_por: req.user.userId,
        status: 'ABERTO',
        saldo_inicial: saldo_inicial || 0,
        saldo_atual: saldo_inicial || 0,
        data_abertura: new Date()
      });

      res.status(201).json({
        success: true,
        message: 'Caixa aberto com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
);

router.put('/caixa/fechar',
  authenticate,
  requirePermissions(PERMISSOES.PERM_CAIXA_FECHAR),
  auditLog('FINANCEIRO', 'FECHAR_CAIXA'),
  async (req, res, next) => {
    try {
      const { saldo_informado, observacoes } = req.body;

      const [caixaAberto] = await db
        .select()
        .from(caixas)
        .where(and(
          eq(caixas.empresa_id, req.user.empresaId),
          eq(caixas.status, 'ABERTO')
        ))
        .limit(1);

      if (!caixaAberto) {
        return res.status(404).json({
          success: false,
          message: 'Não há caixa aberto'
        });
      }

      const diferencaCaixa = saldo_informado - caixaAberto.saldo_atual;

      await db
        .update(caixas)
        .set({
          status: 'FECHADO',
          data_fechamento: new Date(),
          fechado_por: req.user.userId,
          saldo_final: saldo_informado,
          diferenca: diferencaCaixa,
          observacoes
        })
        .where(eq(caixas.id, caixaAberto.id));

      res.json({
        success: true,
        message: 'Caixa fechado com sucesso',
        data: {
          saldo_sistema: caixaAberto.saldo_atual,
          saldo_informado,
          diferenca: diferencaCaixa
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  RELATÓRIOS FINANCEIROS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/relatorio-financeiro', authenticate, requirePermissions(PERMISSOES.PERM_RELATORIO_FINANCEIRO), async (req, res, next) => {
  try {
    const { data_inicio, data_fim } = req.query;

    // Total de vendas no período
    const [vendas_periodo] = await db
      .select({
        total: sql`SUM(${vendas.valor_total})`,
        quantidade: sql`COUNT(${vendas.id})`
      })
      .from(vendas)
      .where(and(
        eq(vendas.empresa_id, req.user.empresaId),
        gte(vendas.criado_em, new Date(data_inicio)),
        lte(vendas.criado_em, new Date(data_fim))
      ));

    // Contas a receber pendentes
    const [receber_pendente] = await db
      .select({
        total: sql`SUM(${contas_receber.valor})`
      })
      .from(contas_receber)
      .where(and(
        eq(contas_receber.empresa_id, req.user.empresaId),
        eq(contas_receber.status, 'PENDENTE')
      ));

    // Contas a pagar pendentes
    const [pagar_pendente] = await db
      .select({
        total: sql`SUM(${contas_pagar.valor})`
      })
      .from(contas_pagar)
      .where(and(
        eq(contas_pagar.empresa_id, req.user.empresaId),
        eq(contas_pagar.status, 'PENDENTE')
      ));

    res.json({
      success: true,
      data: {
        vendas: {
          total: vendas_periodo.total || 0,
          quantidade: vendas_periodo.quantidade || 0
        },
        contas_receber_pendentes: receber_pendente.total || 0,
        contas_pagar_pendentes: pagar_pendente.total || 0
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;

import express from 'express';
import { z } from 'zod';
import db from '../../lib/db.js';
import {
  vendas,
  itens_venda,
  pagamentos_venda,
  garantias,
  produtos,
  clientes,
  funcionarios,
  movimentacoes_estoque
} from '../../../drizzle/schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { authenticate } from '../../middleware/auth.js';
import { requirePermissions } from '../../middleware/rbac.js';
import { auditLog } from '../../middleware/audit.js';
import { PERMISSOES, temPermissao } from '../../lib/permissions.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
//  SCHEMAS DE VALIDAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

const itemVendaSchema = z.object({
  produto_id: z.number(),
  quantidade: z.number().positive(),
  preco_unitario: z.number().positive(),
  desconto_pct: z.number().min(0).max(100).default(0)
});

const pagamentoSchema = z.object({
  forma: z.enum(['DINHEIRO', 'PIX', 'CARTAO_DEBITO', 'CARTAO_CREDITO', 'CHEQUE', 'APRAZO']),
  valor: z.number().positive(),
  nsu: z.string().optional()
});

const vendaSchema = z.object({
  cliente_id: z.number(),
  tipo: z.enum(['VENDA', 'PEDIDO']).default('VENDA'),
  desconto_global_pct: z.number().min(0).max(100).default(0),
  itens: z.array(itemVendaSchema).min(1, 'A venda deve conter pelo menos 1 item'),
  pagamentos: z.array(pagamentoSchema).min(1, 'A venda deve conter pelo menos 1 pagamento'),
  garantia_meses: z.number().min(0).default(0),
  observacoes: z.string().optional()
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/vendas - Listar vendas
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { data_inicio, data_fim, status } = req.query;

    // Vendedor só vê suas próprias vendas, admin vê todas
    const podeVerTodas = temPermissao(req.user.permissoes, PERMISSOES.PERM_VENDA_LISTAR_TODAS);

    let query = db
      .select({
        venda: vendas,
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
      .from(vendas)
      .leftJoin(clientes, eq(vendas.cliente_id, clientes.id))
      .leftJoin(funcionarios, eq(vendas.vendedor_id, funcionarios.id))
      .where(eq(vendas.empresa_id, req.user.empresaId));

    // Se não pode ver todas, filtrar por vendedor
    if (!podeVerTodas) {
      query = query.where(eq(vendas.vendedor_id, req.user.userId));
    }

    if (data_inicio) {
      query = query.where(gte(vendas.criado_em, new Date(data_inicio)));
    }

    if (data_fim) {
      query = query.where(lte(vendas.criado_em, new Date(data_fim)));
    }

    if (status) {
      query = query.where(eq(vendas.status, status));
    }

    const vendasList = await query;

    // Serializar custo se não tiver permissão
    const podeVerCusto = temPermissao(req.user.permissoes, PERMISSOES.PERM_VENDA_VER_CUSTO);

    const vendasSerializadas = vendasList.map(({ venda, cliente, vendedor }) => ({
      ...venda,
      custo_total: podeVerCusto ? venda.custo_total : undefined,
      lucro_bruto: podeVerCusto ? venda.lucro_bruto : undefined,
      margem_pct: podeVerCusto ? venda.margem_pct : undefined,
      cliente,
      vendedor
    }));

    res.json({
      success: true,
      data: vendasSerializadas
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/vendas/:id - Buscar venda por ID
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    const [venda] = await db
      .select({
        venda: vendas,
        cliente: clientes,
        vendedor: {
          id: funcionarios.id,
          nome: funcionarios.nome
        }
      })
      .from(vendas)
      .leftJoin(clientes, eq(vendas.cliente_id, clientes.id))
      .leftJoin(funcionarios, eq(vendas.vendedor_id, funcionarios.id))
      .where(and(
        eq(vendas.id, id),
        eq(vendas.empresa_id, req.user.empresaId)
      ))
      .limit(1);

    if (!venda) {
      return res.status(404).json({
        success: false,
        message: 'Venda não encontrada'
      });
    }

    // Buscar itens da venda
    const itens = await db
      .select({
        item: itens_venda,
        produto: {
          id: produtos.id,
          codigo: produtos.codigo,
          nome: produtos.nome,
          unidade: produtos.unidade
        }
      })
      .from(itens_venda)
      .leftJoin(produtos, eq(itens_venda.produto_id, produtos.id))
      .where(eq(itens_venda.venda_id, id));

    // Buscar pagamentos
    const pagamentos = await db
      .select()
      .from(pagamentos_venda)
      .where(eq(pagamentos_venda.venda_id, id));

    // Buscar garantia se existir
    const [garantia] = await db
      .select()
      .from(garantias)
      .where(eq(garantias.venda_id, id))
      .limit(1);

    // Serializar custo
    const podeVerCusto = temPermissao(req.user.permissoes, PERMISSOES.PERM_VENDA_VER_CUSTO);

    res.json({
      success: true,
      data: {
        ...venda.venda,
        custo_total: podeVerCusto ? venda.venda.custo_total : undefined,
        lucro_bruto: podeVerCusto ? venda.venda.lucro_bruto : undefined,
        margem_pct: podeVerCusto ? venda.venda.margem_pct : undefined,
        cliente: venda.cliente,
        vendedor: venda.vendedor,
        itens,
        pagamentos,
        garantia
      }
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /api/v1/vendas - Criar venda (PDV)
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/',
  authenticate,
  requirePermissions(PERMISSOES.PERM_VENDA_CRIAR),
  auditLog('VENDAS', 'CRIAR'),
  async (req, res, next) => {
    try {
      const data = vendaSchema.parse(req.body);

      // Verificar desconto
      const limiteDescontoVendedor = 10; // 10%
      const podeDescontoIlimitado = temPermissao(req.user.permissoes, PERMISSOES.PERM_VENDA_DESCONTO_ILIMITADO);

      if (!podeDescontoIlimitado && data.desconto_global_pct > limiteDescontoVendedor) {
        return res.status(403).json({
          success: false,
          message: `Desconto máximo permitido: ${limiteDescontoVendedor}%`
        });
      }

      // Validar itens e verificar estoque
      for (const item of data.itens) {
        if (!podeDescontoIlimitado && item.desconto_pct > limiteDescontoVendedor) {
          return res.status(403).json({
            success: false,
            message: `Desconto máximo permitido: ${limiteDescontoVendedor}%`
          });
        }

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

        if (produto.estoque_atual < item.quantidade) {
          return res.status(400).json({
            success: false,
            message: `Estoque insuficiente para ${produto.nome}. Disponível: ${produto.estoque_atual}`
          });
        }
      }

      // Validar pagamentos
      const totalPagamentos = data.pagamentos.reduce((sum, p) => sum + p.valor, 0);
      const totalItens = data.itens.reduce((sum, item) => {
        const subtotal = item.quantidade * item.preco_unitario;
        const desconto = subtotal * (item.desconto_pct / 100);
        return sum + (subtotal - desconto);
      }, 0);

      const descontoGlobal = totalItens * (data.desconto_global_pct / 100);
      const totalVenda = totalItens - descontoGlobal;

      if (Math.abs(totalPagamentos - totalVenda) > 0.01) {
        return res.status(400).json({
          success: false,
          message: `Total de pagamentos (${totalPagamentos.toFixed(2)}) diferente do total da venda (${totalVenda.toFixed(2)})`
        });
      }

      // Calcular custo total e comissão
      let custoTotal = 0;
      for (const item of data.itens) {
        const [produto] = await db
          .select()
          .from(produtos)
          .where(eq(produtos.id, item.produto_id))
          .limit(1);

        custoTotal += produto.preco_custo * item.quantidade;
      }

      const lucroBruto = totalVenda - custoTotal;
      const margemPct = totalVenda > 0 ? (lucroBruto / totalVenda) * 100 : 0;

      // Buscar % de comissão do vendedor
      const [vendedor] = await db
        .select()
        .from(funcionarios)
        .where(eq(funcionarios.id, req.user.userId))
        .limit(1);

      const valorComissao = lucroBruto * (vendedor.comissao_percentual / 100);

      // TRANSACTION: Criar venda + itens + pagamentos + movimentações de estoque
      await db.transaction(async (tx) => {
        // 1. Criar venda
        const [novaVenda] = await tx
          .insert(vendas)
          .values({
            empresa_id: req.user.empresaId,
            cliente_id: data.cliente_id,
            vendedor_id: req.user.userId,
            tipo: data.tipo,
            status: 'PAGO',
            valor_total: totalVenda,
            custo_total: custoTotal,
            lucro_bruto: lucroBruto,
            margem_pct: margemPct,
            desconto_pct: data.desconto_global_pct,
            comissao_devida: valorComissao,
            observacoes: data.observacoes
          })
          .$returningId();

        const vendaId = novaVenda.id;

        // 2. Criar itens
        for (const item of data.itens) {
          const subtotal = item.quantidade * item.preco_unitario;
          const desconto = subtotal * (item.desconto_pct / 100);
          const total = subtotal - desconto;

          await tx.insert(itens_venda).values({
            venda_id: vendaId,
            produto_id: item.produto_id,
            quantidade: item.quantidade,
            preco_unit: item.preco_unitario,
            desconto_pct: item.desconto_pct,
            total
          });

          // 3. Baixar estoque
          await tx
            .update(produtos)
            .set({
              estoque_atual: sql`${produtos.estoque_atual} - ${item.quantidade}`
            })
            .where(eq(produtos.id, item.produto_id));

          // 4. Registrar movimentação
          await tx.insert(movimentacoes_estoque).values({
            empresa_id: req.user.empresaId,
            produto_id: item.produto_id,
            tipo: 'SAIDA',
            origem: 'VENDA',
            quantidade: item.quantidade,
            saldo_anterior: sql`(SELECT estoque_atual FROM produtos WHERE id = ${item.produto_id}) + ${item.quantidade}`,
            saldo_posterior: sql`(SELECT estoque_atual FROM produtos WHERE id = ${item.produto_id})`,
            venda_id: vendaId,
            funcionario_id: req.user.userId
          });
        }

        // 5. Criar pagamentos
        for (const pagamento of data.pagamentos) {
          await tx.insert(pagamentos_venda).values({
            venda_id: vendaId,
            forma: pagamento.forma,
            valor: pagamento.valor,
            nsu: pagamento.nsu
          });
        }

        // 6. Criar garantia se fornecida
        if (data.garantia_meses > 0) {
          const dataInicio = new Date();
          const dataFim = new Date();
          dataFim.setMonth(dataFim.getMonth() + data.garantia_meses);

          await tx.insert(garantias).values({
            empresa_id: req.user.empresaId,
            venda_id: vendaId,
            cliente_id: data.cliente_id,
            tipo: 'FABRICACAO',
            duracao_meses: data.garantia_meses,
            valida_ate: dataFim,
            ativa: true
          });
        }
      });

      res.status(201).json({
        success: true,
        message: 'Venda criada com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  PUT /api/v1/vendas/:id/cancelar - Cancelar venda
// ═══════════════════════════════════════════════════════════════════════════════

router.put('/:id/cancelar',
  authenticate,
  requirePermissions(PERMISSOES.PERM_VENDA_CANCELAR),
  auditLog('VENDAS', 'CANCELAR'),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const { motivo } = req.body;

      const [venda] = await db
        .select()
        .from(vendas)
        .where(and(
          eq(vendas.id, id),
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
          message: 'Venda já cancelada'
        });
      }

      // TRANSACTION: Cancelar venda e devolver estoque
      await db.transaction(async (tx) => {
        // 1. Atualizar status da venda
        await tx
          .update(vendas)
          .set({ status: 'CANCELADO', observacoes: motivo })
          .where(eq(vendas.id, id));

        // 2. Devolver estoque
        const itens = await tx
          .select()
          .from(itens_venda)
          .where(eq(itens_venda.venda_id, id));

        for (const item of itens) {
          await tx
            .update(produtos)
            .set({
              estoque_atual: sql`${produtos.estoque_atual} + ${item.quantidade}`
            })
            .where(eq(produtos.id, item.produto_id));

          // Registrar movimentação de devolução
          await tx.insert(movimentacoes_estoque).values({
            empresa_id: req.user.empresaId,
            produto_id: item.produto_id,
            tipo: 'ENTRADA',
            origem: 'CANCELAMENTO_VENDA',
            quantidade: item.quantidade,
            saldo_anterior: sql`(SELECT estoque_atual FROM produtos WHERE id = ${item.produto_id}) - ${item.quantidade}`,
            saldo_posterior: sql`(SELECT estoque_atual FROM produtos WHERE id = ${item.produto_id})`,
            venda_id: id,
            funcionario_id: req.user.userId,
            observacoes: `Cancelamento de venda - ${motivo}`
          });
        }

        // 3. Desativar garantia se existir
        await tx
          .update(garantias)
          .set({ ativa: false })
          .where(eq(garantias.venda_id, id));
      });

      res.json({
        success: true,
        message: 'Venda cancelada com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

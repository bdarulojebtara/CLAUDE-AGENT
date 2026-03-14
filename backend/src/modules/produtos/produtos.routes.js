import express from 'express';
import { z } from 'zod';
import db from '../../lib/db.js';
import { produtos, historico_precos, movimentacoes_estoque, categorias_produto } from '../../../drizzle/schema.js';
import { eq, and, sql, like, or } from 'drizzle-orm';
import { authenticate } from '../../middleware/auth.js';
import { requirePermissions } from '../../middleware/rbac.js';
import { auditLog } from '../../middleware/audit.js';
import { PERMISSOES } from '../../lib/permissions.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
//  SCHEMAS DE VALIDAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

const produtoSchema = z.object({
  codigo: z.string().min(1, 'Código obrigatório'),
  nome: z.string().min(1, 'Nome obrigatório'),
  descricao: z.string().optional(),
  categoria_id: z.number().optional(),
  unidade: z.enum(['UN', 'ML', 'M2', 'KG', 'PCT', 'KIT', 'M3', 'M']),
  preco_custo: z.number().min(0, 'Preço de custo deve ser positivo'),
  preco_venda: z.number().min(0, 'Preço de venda deve ser positivo'),
  estoque_minimo: z.number().default(0),
  estoque_maximo: z.number().default(9999),
  fornecedor_id: z.number().optional(),
  localizacao_galpao: z.string().optional(),
  localizacao_corredor: z.string().optional(),
  localizacao_prateleira: z.string().optional(),
  localizacao_posicao: z.string().optional(),
  foto_url: z.string().optional()
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/produtos - Listar produtos
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/', authenticate, requirePermissions(PERMISSOES.PERM_PRODUTO_LISTAR), async (req, res, next) => {
  try {
    const { busca, categoria_id } = req.query;

    let query = db.select().from(produtos).where(eq(produtos.empresa_id, req.user.empresaId));

    if (busca) {
      query = query.where(
        or(
          like(produtos.nome, `%${busca}%`),
          like(produtos.codigo, `%${busca}%`)
        )
      );
    }

    if (categoria_id) {
      query = query.where(eq(produtos.categoria_id, parseInt(categoria_id)));
    }

    const produtosList = await query;

    // Serializar: remover preco_custo se usuário não tem permissão
    const temPermissaoCusto = req.user.permissoes.includes(PERMISSOES.PERM_PRODUTO_VER_CUSTO);

    const produtosSerializados = produtosList.map(p => {
      const produto = { ...p };
      if (!temPermissaoCusto) {
        delete produto.preco_custo;
      }
      return produto;
    });

    res.json({
      success: true,
      data: produtosSerializados
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/produtos/:id - Buscar produto por ID
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/:id', authenticate, requirePermissions(PERMISSOES.PERM_PRODUTO_LISTAR), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    const [produto] = await db
      .select()
      .from(produtos)
      .where(and(
        eq(produtos.id, id),
        eq(produtos.empresa_id, req.user.empresaId)
      ))
      .limit(1);

    if (!produto) {
      return res.status(404).json({
        success: false,
        message: 'Produto não encontrado'
      });
    }

    // Serializar custo se necessário
    const temPermissaoCusto = req.user.permissoes.includes(PERMISSOES.PERM_PRODUTO_VER_CUSTO);
    if (!temPermissaoCusto) {
      delete produto.preco_custo;
    }

    res.json({
      success: true,
      data: produto
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /api/v1/produtos - Criar produto
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/',
  authenticate,
  requirePermissions(PERMISSOES.PERM_PRODUTO_CRIAR),
  auditLog('PRODUTOS', 'CRIAR'),
  async (req, res, next) => {
    try {
      const data = produtoSchema.parse(req.body);

      // Calcular localizacao_display
      const localizacao_display = [
        data.localizacao_galpao,
        data.localizacao_corredor,
        data.localizacao_prateleira,
        data.localizacao_posicao
      ].filter(Boolean).join('-') || null;

      const [novoProduto] = await db
        .insert(produtos)
        .values({
          ...data,
          empresa_id: req.user.empresaId,
          localizacao_display,
          estoque_atual: 0
        })
        .$returningId();

      // Criar histórico de preços inicial
      await db.insert(historico_precos).values({
        produto_id: novoProduto.id,
        preco_custo: data.preco_custo,
        preco_venda: data.preco_venda,
        alterado_por: req.user.userId,
        motivo: 'Cadastro inicial do produto'
      });

      res.status(201).json({
        success: true,
        message: 'Produto criado com sucesso',
        data: { id: novoProduto.id }
      });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  PUT /api/v1/produtos/:id - Atualizar produto
// ═══════════════════════════════════════════════════════════════════════════════

router.put('/:id',
  authenticate,
  requirePermissions(PERMISSOES.PERM_PRODUTO_EDITAR),
  auditLog('PRODUTOS', 'ATUALIZAR'),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const data = produtoSchema.partial().parse(req.body);

      // Verificar se produto existe e pertence à empresa
      const [produtoExistente] = await db
        .select()
        .from(produtos)
        .where(and(
          eq(produtos.id, id),
          eq(produtos.empresa_id, req.user.empresaId)
        ))
        .limit(1);

      if (!produtoExistente) {
        return res.status(404).json({
          success: false,
          message: 'Produto não encontrado'
        });
      }

      // Verificar se preços mudaram para criar histórico
      const precosAlterados = (
        (data.preco_custo && data.preco_custo !== produtoExistente.preco_custo) ||
        (data.preco_venda && data.preco_venda !== produtoExistente.preco_venda)
      );

      // Recalcular localizacao_display se necessário
      if (data.localizacao_galpao || data.localizacao_corredor ||
          data.localizacao_prateleira || data.localizacao_posicao) {
        data.localizacao_display = [
          data.localizacao_galpao || produtoExistente.localizacao_galpao,
          data.localizacao_corredor || produtoExistente.localizacao_corredor,
          data.localizacao_prateleira || produtoExistente.localizacao_prateleira,
          data.localizacao_posicao || produtoExistente.localizacao_posicao
        ].filter(Boolean).join('-') || null;
      }

      // Atualizar produto
      await db
        .update(produtos)
        .set(data)
        .where(eq(produtos.id, id));

      // Criar histórico de preços se alterado
      if (precosAlterados) {
        await db.insert(historico_precos).values({
          produto_id: id,
          preco_custo: data.preco_custo || produtoExistente.preco_custo,
          preco_venda: data.preco_venda || produtoExistente.preco_venda,
          alterado_por: req.user.userId,
          motivo: req.body.motivo_alteracao_preco || 'Alteração manual'
        });
      }

      res.json({
        success: true,
        message: 'Produto atualizado com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  DELETE /api/v1/produtos/:id - Deletar produto
// ═══════════════════════════════════════════════════════════════════════════════

router.delete('/:id',
  authenticate,
  requirePermissions(PERMISSOES.PERM_PRODUTO_DELETAR),
  auditLog('PRODUTOS', 'DELETAR'),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);

      const [produto] = await db
        .select()
        .from(produtos)
        .where(and(
          eq(produtos.id, id),
          eq(produtos.empresa_id, req.user.empresaId)
        ))
        .limit(1);

      if (!produto) {
        return res.status(404).json({
          success: false,
          message: 'Produto não encontrado'
        });
      }

      // Soft delete - marcar como inativo
      await db
        .update(produtos)
        .set({ ativo: false })
        .where(eq(produtos.id, id));

      res.json({
        success: true,
        message: 'Produto deletado com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /api/v1/produtos/:id/ajustar-estoque - Ajustar estoque manualmente
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:id/ajustar-estoque',
  authenticate,
  requirePermissions(PERMISSOES.PERM_PRODUTO_AJUSTAR_ESTOQUE),
  auditLog('PRODUTOS', 'AJUSTAR_ESTOQUE'),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const { quantidade, observacoes } = req.body;

      if (!quantidade || isNaN(quantidade)) {
        return res.status(400).json({
          success: false,
          message: 'Quantidade inválida'
        });
      }

      const [produto] = await db
        .select()
        .from(produtos)
        .where(and(
          eq(produtos.id, id),
          eq(produtos.empresa_id, req.user.empresaId)
        ))
        .limit(1);

      if (!produto) {
        return res.status(404).json({
          success: false,
          message: 'Produto não encontrado'
        });
      }

      const novoEstoque = Number(produto.estoque_atual) + Number(quantidade);

      // Atualizar estoque
      await db
        .update(produtos)
        .set({ estoque_atual: novoEstoque })
        .where(eq(produtos.id, id));

      // Registrar movimentação
      await db.insert(movimentacoes_estoque).values({
        empresa_id: req.user.empresaId,
        produto_id: id,
        tipo: 'AJUSTE_ADMIN',
        quantidade: quantidade,
        estoque_antes: produto.estoque_atual,
        estoque_depois: novoEstoque,
        funcionario_id: req.user.userId,
        status_material: 'EM_ESTOQUE',
        observacoes: observacoes || 'Ajuste manual de estoque'
      });

      res.json({
        success: true,
        message: 'Estoque ajustado com sucesso',
        data: {
          estoque_anterior: produto.estoque_atual,
          estoque_novo: novoEstoque
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/produtos/:id/historico-precos - Histórico de preços
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/:id/historico-precos',
  authenticate,
  requirePermissions(PERMISSOES.PERM_PRODUTO_VER_CUSTO),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);

      const historico = await db
        .select()
        .from(historico_precos)
        .where(eq(historico_precos.produto_id, id))
        .orderBy(sql`${historico_precos.criado_em} DESC`);

      res.json({
        success: true,
        data: historico
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

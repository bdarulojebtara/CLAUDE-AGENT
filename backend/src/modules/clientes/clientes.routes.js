import express from 'express';
import { z } from 'zod';
import db from '../../lib/db.js';
import { clientes, creditos_cliente } from '../../../drizzle/schema.js';
import { eq, and, like, or } from 'drizzle-orm';
import { authenticate } from '../../middleware/auth.js';
import { requirePermissions } from '../../middleware/rbac.js';
import { auditLog } from '../../middleware/audit.js';
import { PERMISSOES } from '../../lib/permissions.js';
import fetch from 'node-fetch';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
//  SCHEMAS DE VALIDAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

const clienteSchema = z.object({
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
  classificacao: z.enum(['VIP', 'REGULAR', 'OCASIONAL', 'CONSTRUTORA', 'INSTALADOR', 'INTERNO']).default('REGULAR'),
  tabela_preco_id: z.number().optional(),
  limite_credito: z.number().default(0),
  data_nascimento: z.string().optional(),
  observacoes: z.string().optional()
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/clientes - Listar clientes
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/', authenticate, requirePermissions(PERMISSOES.PERM_CLIENTE_LISTAR), async (req, res, next) => {
  try {
    const { busca } = req.query;

    let query = db.select().from(clientes).where(eq(clientes.empresa_id, req.user.empresaId));

    if (busca) {
      query = query.where(
        or(
          like(clientes.nome, `%${busca}%`),
          like(clientes.cpf_cnpj, `%${busca}%`),
          like(clientes.telefone, `%${busca}%`)
        )
      );
    }

    const clientesList = await query;

    res.json({
      success: true,
      data: clientesList
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/clientes/:id - Buscar cliente por ID
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/:id', authenticate, requirePermissions(PERMISSOES.PERM_CLIENTE_LISTAR), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    const [cliente] = await db
      .select()
      .from(clientes)
      .where(and(
        eq(clientes.id, id),
        eq(clientes.empresa_id, req.user.empresaId)
      ))
      .limit(1);

    if (!cliente) {
      return res.status(404).json({
        success: false,
        message: 'Cliente não encontrado'
      });
    }

    res.json({
      success: true,
      data: cliente
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /api/v1/clientes - Criar cliente
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/',
  authenticate,
  requirePermissions(PERMISSOES.PERM_CLIENTE_CRIAR),
  auditLog('CLIENTES', 'CRIAR'),
  async (req, res, next) => {
    try {
      const data = clienteSchema.parse(req.body);

      const [novoCliente] = await db
        .insert(clientes)
        .values({
          ...data,
          empresa_id: req.user.empresaId,
          data_nascimento: data.data_nascimento ? new Date(data.data_nascimento) : null
        })
        .$returningId();

      res.status(201).json({
        success: true,
        message: 'Cliente criado com sucesso',
        data: { id: novoCliente.id }
      });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  PUT /api/v1/clientes/:id - Atualizar cliente
// ═══════════════════════════════════════════════════════════════════════════════

router.put('/:id',
  authenticate,
  requirePermissions(PERMISSOES.PERM_CLIENTE_EDITAR),
  auditLog('CLIENTES', 'ATUALIZAR'),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const data = clienteSchema.partial().parse(req.body);

      const [cliente] = await db
        .select()
        .from(clientes)
        .where(and(
          eq(clientes.id, id),
          eq(clientes.empresa_id, req.user.empresaId)
        ))
        .limit(1);

      if (!cliente) {
        return res.status(404).json({
          success: false,
          message: 'Cliente não encontrado'
        });
      }

      await db
        .update(clientes)
        .set({
          ...data,
          data_nascimento: data.data_nascimento ? new Date(data.data_nascimento) : undefined
        })
        .where(eq(clientes.id, id));

      res.json({
        success: true,
        message: 'Cliente atualizado com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  DELETE /api/v1/clientes/:id - Deletar cliente
// ═══════════════════════════════════════════════════════════════════════════════

router.delete('/:id',
  authenticate,
  requirePermissions(PERMISSOES.PERM_CLIENTE_EDITAR),
  auditLog('CLIENTES', 'DELETAR'),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);

      const [cliente] = await db
        .select()
        .from(clientes)
        .where(and(
          eq(clientes.id, id),
          eq(clientes.empresa_id, req.user.empresaId)
        ))
        .limit(1);

      if (!cliente) {
        return res.status(404).json({
          success: false,
          message: 'Cliente não encontrado'
        });
      }

      // Soft delete
      await db
        .update(clientes)
        .set({ ativo: false })
        .where(eq(clientes.id, id));

      res.json({
        success: true,
        message: 'Cliente deletado com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/clientes/cep/:cep - Buscar endereço por CEP (ViaCEP)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/cep/:cep', authenticate, async (req, res, next) => {
  try {
    const cep = req.params.cep.replace(/\D/g, '');

    if (cep.length !== 8) {
      return res.status(400).json({
        success: false,
        message: 'CEP inválido'
      });
    }

    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await response.json();

    if (data.erro) {
      return res.status(404).json({
        success: false,
        message: 'CEP não encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        cep: data.cep,
        endereco: data.logradouro,
        bairro: data.bairro,
        cidade: data.localidade,
        estado: data.uf,
        complemento: data.complemento
      }
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/clientes/:id/creditos - Listar créditos do cliente
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/:id/creditos', authenticate, requirePermissions(PERMISSOES.PERM_CLIENTE_LISTAR), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    const creditos = await db
      .select()
      .from(creditos_cliente)
      .where(and(
        eq(creditos_cliente.cliente_id, id),
        eq(creditos_cliente.empresa_id, req.user.empresaId)
      ));

    res.json({
      success: true,
      data: creditos
    });
  } catch (error) {
    next(error);
  }
});

export default router;

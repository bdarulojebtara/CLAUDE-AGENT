import express from 'express';
import { z } from 'zod';
import db from '../../lib/db.js';
import { configuracoes, empresas } from '../../../drizzle/schema.js';
import { eq, and } from 'drizzle-orm';
import { authenticate } from '../../middleware/auth.js';
import { requirePermissions } from '../../middleware/rbac.js';
import { auditLog } from '../../middleware/audit.js';
import { PERMISSOES } from '../../lib/permissions.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/v1/configuracoes - Buscar configurações da empresa
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/', authenticate, async (req, res, next) => {
  try {
    // Buscar empresa
    const [empresa] = await db
      .select()
      .from(empresas)
      .where(eq(empresas.id, req.user.empresaId))
      .limit(1);

    if (!empresa) {
      return res.status(404).json({
        success: false,
        message: 'Empresa não encontrada'
      });
    }

    // Buscar configurações
    const [config] = await db
      .select()
      .from(configuracoes)
      .where(eq(configuracoes.empresa_id, req.user.empresaId))
      .limit(1);

    res.json({
      success: true,
      data: {
        empresa,
        configuracoes: config || {}
      }
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PUT /api/v1/configuracoes/empresa - Atualizar dados da empresa
// ═══════════════════════════════════════════════════════════════════════════════

const empresaSchema = z.object({
  nome_fantasia: z.string().min(1).optional(),
  razao_social: z.string().optional(),
  cnpj: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().email().optional(),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  cep: z.string().optional(),
  logo_url: z.string().optional()
});

router.put('/empresa',
  authenticate,
  requirePermissions(PERMISSOES.PERM_CONFIGURACOES_EDITAR),
  auditLog('CONFIGURACOES', 'ATUALIZAR_EMPRESA'),
  async (req, res, next) => {
    try {
      const data = empresaSchema.parse(req.body);

      await db
        .update(empresas)
        .set(data)
        .where(eq(empresas.id, req.user.empresaId));

      res.json({
        success: true,
        message: 'Dados da empresa atualizados com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  PUT /api/v1/configuracoes/sistema - Atualizar configurações do sistema
// ═══════════════════════════════════════════════════════════════════════════════

const configuracoesSchema = z.object({
  estoque_minimo_global: z.number().optional(),
  margem_lucro_padrao: z.number().optional(),
  prazo_garantia_padrao: z.number().optional(),
  email_smtp_host: z.string().optional(),
  email_smtp_port: z.number().optional(),
  email_smtp_user: z.string().optional(),
  email_smtp_pass: z.string().optional(),
  nfe_ambiente: z.enum(['PRODUCAO', 'HOMOLOGACAO']).optional(),
  nfe_certificado_path: z.string().optional(),
  nfe_serie_nfe: z.number().optional(),
  backup_automatico: z.boolean().optional(),
  backup_horario: z.string().optional(),
  notificar_estoque_baixo: z.boolean().optional(),
  notificar_contas_vencer: z.boolean().optional()
});

router.put('/sistema',
  authenticate,
  requirePermissions(PERMISSOES.PERM_CONFIGURACOES_EDITAR),
  auditLog('CONFIGURACOES', 'ATUALIZAR_SISTEMA'),
  async (req, res, next) => {
    try {
      const data = configuracoesSchema.parse(req.body);

      // Verificar se já existe configuração
      const [configExistente] = await db
        .select()
        .from(configuracoes)
        .where(eq(configuracoes.empresa_id, req.user.empresaId))
        .limit(1);

      if (configExistente) {
        // Atualizar
        await db
          .update(configuracoes)
          .set(data)
          .where(eq(configuracoes.empresa_id, req.user.empresaId));
      } else {
        // Criar
        await db
          .insert(configuracoes)
          .values({
            empresa_id: req.user.empresaId,
            ...data
          });
      }

      res.json({
        success: true,
        message: 'Configurações atualizadas com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

import express from 'express';
import cors from 'cors';
import env from './lib/env.js';
import { authenticate, optionalAuth } from './middleware/auth.js';
import { performanceMonitor } from './middleware/performance.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { installGuard } from './middleware/installGuard.js';

const app = express();

// ═══════════════════════════════════════════════════════════════════════════════
//  MIDDLEWARES GLOBAIS
// ═══════════════════════════════════════════════════════════════════════════════

// CORS
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Performance monitoring
app.use(performanceMonitor);

// Rate limiting global (100 requests por 15 minutos por IP)
app.use(rateLimiter(env.RATE_LIMIT_MAX, 15));

// ═══════════════════════════════════════════════════════════════════════════════
//  ROTAS PÚBLICAS (sem autenticação)
// ═══════════════════════════════════════════════════════════════════════════════

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: env.NODE_ENV,
    demo_mode: env.DEMO_MODE
  });
});

// Servir arquivos de upload
app.use('/uploads', express.static(env.UPLOAD_DIR));

// ═══════════════════════════════════════════════════════════════════════════════
//  INSTALL GUARD - Bloquear se sistema não está configurado
// ═══════════════════════════════════════════════════════════════════════════════

// Se não está em modo demo e não foi instalado, redirecionar para /install
// (exceto nas rotas de instalação)
if (!env.DEMO_MODE) {
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api/v1/install') && !req.path.startsWith('/api/v1/auth')) {
      return installGuard(req, res, next);
    }
    next();
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  IMPORTAR E REGISTRAR ROTAS DOS MÓDULOS
// ═══════════════════════════════════════════════════════════════════════════════

// TODO: Importar rotas aqui conforme forem criadas
// import authRoutes from './modules/auth/auth.routes.js';
// import produtosRoutes from './modules/produtos/produtos.routes.js';
// etc.

// Rotas de autenticação (públicas)
// app.use('/api/v1/auth', authRoutes);

// Rotas de instalação (públicas com guard específico)
// app.use('/api/v1/install', installRoutes);

// Rotas protegidas (requerem autenticação)
// app.use('/api/v1/produtos', authenticate, produtosRoutes);
// app.use('/api/v1/vendas', authenticate, vendasRoutes);
// app.use('/api/v1/orcamentos', authenticate, orcamentosRoutes);
// app.use('/api/v1/devolucoes', authenticate, devolucoesRoutes);
// app.use('/api/v1/nfe', authenticate, nfeRoutes);
// app.use('/api/v1/producao', authenticate, producaoRoutes);
// app.use('/api/v1/almoxarifado', authenticate, almoxarifadoRoutes);
// app.use('/api/v1/financeiro', authenticate, financeiroRoutes);
// app.use('/api/v1/relatorios', authenticate, relatoriosRoutes);
// app.use('/api/v1/alertas', authenticate, alertasRoutes);
// app.use('/api/v1/auditoria', authenticate, auditoriaRoutes);
// app.use('/api/v1/configuracoes', authenticate, configuracoesRoutes);
// app.use('/api/v1/ia', authenticate, iaRoutes);
// app.use('/api/v1/clientes', authenticate, clientesRoutes);
// app.use('/api/v1/fornecedores', authenticate, fornecedoresRoutes);
// app.use('/api/v1/funcionarios', authenticate, funcionariosRoutes);
// app.use('/api/v1/avisos', authenticate, avisosRoutes);

// Busca global
// app.get('/api/v1/busca', authenticate, buscaGlobalHandler);

// Portal do cliente (público com token)
// app.get('/api/v1/portal/:token', portalClienteHandler);

// ═══════════════════════════════════════════════════════════════════════════════
//  TRATAMENTO DE ERROS
// ═══════════════════════════════════════════════════════════════════════════════

// Rota não encontrada
app.use(notFound);

// Error handler global
app.use(errorHandler);

export default app;

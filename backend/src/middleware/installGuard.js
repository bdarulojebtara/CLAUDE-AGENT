import env from '../lib/env.js';

// Middleware que bloqueia acesso ao sistema quando setup não está completo
// E não está em modo demo
export function installGuard(req, res, next) {
  // Se está em modo demo, permitir acesso
  if (env.DEMO_MODE) {
    return next();
  }

  // Se setup já foi completo, permitir acesso
  if (env.SETUP_COMPLETED) {
    return next();
  }

  // Se está tentando acessar a rota de instalação, permitir
  if (req.path.startsWith('/api/v1/install') || req.path === '/install') {
    return next();
  }

  // Bloquear qualquer outra rota e redirecionar para instalação
  return res.status(503).json({
    success: false,
    message: 'Sistema não configurado. Execute o wizard de instalação.',
    redirect: '/install'
  });
}

// Middleware que bloqueia acesso ao wizard de instalação quando setup já foi completo
export function blockInstallIfCompleted(req, res, next) {
  if (env.SETUP_COMPLETED && !env.DEMO_MODE) {
    return res.status(403).json({
      success: false,
      message: 'O sistema já foi instalado. A rota de instalação está bloqueada.'
    });
  }

  next();
}

export default { installGuard, blockInstallIfCompleted };

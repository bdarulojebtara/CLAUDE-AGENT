// Middleware RBAC - Role-Based Access Control
// Verifica se o usuário tem as permissões necessárias para acessar uma rota

export function requirePermissions(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Autenticação necessária'
      });
    }

    const userPermissions = req.user.permissoes || [];

    // Verificar se o usuário tem TODAS as permissões requeridas
    const hasAllPermissions = requiredPermissions.every(perm =>
      userPermissions.includes(perm)
    );

    if (!hasAllPermissions) {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para realizar esta ação',
        required: requiredPermissions,
        yours: userPermissions
      });
    }

    next();
  };
}

export function requireAnyPermission(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Autenticação necessária'
      });
    }

    const userPermissions = req.user.permissoes || [];

    // Verificar se o usuário tem PELO MENOS UMA das permissões requeridas
    const hasAnyPermission = requiredPermissions.some(perm =>
      userPermissions.includes(perm)
    );

    if (!hasAnyPermission) {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para realizar esta ação',
        required: requiredPermissions
      });
    }

    next();
  };
}

export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Autenticação necessária'
    });
  }

  if (req.user.perfil !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Apenas administradores podem acessar este recurso'
    });
  }

  next();
}

export default { requirePermissions, requireAnyPermission, requireAdmin };

import env from '../lib/env.js';

export function errorHandler(err, req, res, next) {
  console.error('❌ Erro capturado:', err);

  // Erro de validação Zod
  if (err.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      message: 'Erro de validação',
      errors: err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }))
    });
  }

  // Erro de JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token inválido'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expirado',
      code: 'TOKEN_EXPIRED'
    });
  }

  // Erro de banco de dados
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      message: 'Registro duplicado. Este valor já existe no sistema.'
    });
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      success: false,
      message: 'Referência inválida. O registro relacionado não existe.'
    });
  }

  // Erro de conexão com banco
  if (err.code === 'ECONNREFUSED' || err.code === 'PROTOCOL_CONNECTION_LOST') {
    return res.status(503).json({
      success: false,
      message: 'Erro de conexão com o banco de dados'
    });
  }

  // Erro de arquivo não encontrado
  if (err.code === 'ENOENT') {
    return res.status(404).json({
      success: false,
      message: 'Arquivo não encontrado'
    });
  }

  // Erro de arquivo muito grande
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: `Arquivo muito grande. Tamanho máximo: ${env.MAX_FILE_SIZE_MB}MB`
    });
  }

  // Erro genérico
  const statusCode = err.statusCode || err.status || 500;
  const message = env.NODE_ENV === 'production'
    ? 'Erro interno do servidor'
    : err.message;

  res.status(statusCode).json({
    success: false,
    message,
    ...(env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err
    })
  });
}

export function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: 'Rota não encontrada',
    path: req.originalUrl
  });
}

export default { errorHandler, notFound };

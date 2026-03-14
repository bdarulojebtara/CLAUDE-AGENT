import db from '../lib/db.js';
import { logs_auditoria } from '../../drizzle/schema.js';

export function auditLog(moduloNome, acao) {
  return async (req, res, next) => {
    // Guardar o método original de resposta
    const originalJson = res.json.bind(res);

    // Sobrescrever res.json para capturar a resposta
    res.json = function(body) {
      // Registrar auditoria apenas em caso de sucesso
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        const auditData = {
          empresa_id: req.user.empresaId,
          funcionario_id: req.user.userId,
          acao: acao || req.method,
          modulo: moduloNome,
          item_tipo: req.params.id ? 'ID' : null,
          item_id: req.params.id ? parseInt(req.params.id) : null,
          valor_antes: req.auditBefore || null,
          valor_depois: req.auditAfter || body,
          ip: req.ip || req.connection.remoteAddress,
          user_agent: req.headers['user-agent'] || null
        };

        // Registrar de forma assíncrona sem bloquear a resposta
        db.insert(logs_auditoria)
          .values(auditData)
          .catch(err => {
            console.error('Erro ao registrar auditoria:', err);
          });
      }

      return originalJson(body);
    };

    next();
  };
}

export async function setAuditBefore(req, res, next) {
  // Middleware auxiliar para capturar o estado "antes" de uma operação
  // Use em rotas de UPDATE/DELETE antes do handler principal
  if (req.params.id && req.user) {
    try {
      // Aqui você pode buscar o registro original
      // Exemplo genérico - adapte conforme necessário
      req.auditBefore = {
        id: req.params.id,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Erro ao capturar estado anterior:', error);
    }
  }
  next();
}

export default { auditLog, setAuditBefore };

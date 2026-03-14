import db from '../lib/db.js';
import { logs_seguranca } from '../../drizzle/schema.js';
import { eq, and, gte } from 'drizzle-orm';

const requestCounts = new Map();
const blockedIPs = new Map();

export function rateLimiter(maxRequests = 100, windowMinutes = 15) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;

    // Verificar se IP está bloqueado
    if (blockedIPs.has(ip)) {
      const blockedUntil = blockedIPs.get(ip);
      if (now < blockedUntil) {
        return res.status(429).json({
          success: false,
          message: 'Muitas requisições. Tente novamente mais tarde.',
          retryAfter: Math.ceil((blockedUntil - now) / 1000)
        });
      } else {
        blockedIPs.delete(ip);
      }
    }

    // Obter histórico de requisições do IP
    if (!requestCounts.has(ip)) {
      requestCounts.set(ip, []);
    }

    const requests = requestCounts.get(ip);

    // Remover requisições antigas
    const validRequests = requests.filter(timestamp => now - timestamp < windowMs);
    requestCounts.set(ip, validRequests);

    // Verificar limite
    if (validRequests.length >= maxRequests) {
      const blockUntil = now + (30 * 60 * 1000); // Bloquear por 30 minutos
      blockedIPs.set(ip, blockUntil);

      return res.status(429).json({
        success: false,
        message: 'Limite de requisições excedido. Tente novamente em 30 minutos.',
        retryAfter: 1800
      });
    }

    // Adicionar requisição atual
    validRequests.push(now);

    // Adicionar headers de rate limit
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - validRequests.length);
    res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());

    next();
  };
}

export function loginRateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const email = req.body.email;

  // Rate limiter específico para login: 5 tentativas em 15 minutos
  const key = `login_${ip}_${email}`;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;

  if (!requestCounts.has(key)) {
    requestCounts.set(key, []);
  }

  const attempts = requestCounts.get(key);
  const validAttempts = attempts.filter(timestamp => now - timestamp < windowMs);
  requestCounts.set(key, validAttempts);

  if (validAttempts.length >= 5) {
    // Registrar tentativa de login bloqueada
    if (email) {
      db.insert(logs_seguranca)
        .values({
          empresa_id: null,
          funcionario_id: null,
          evento: 'LOGIN_FALHOU',
          ip,
          user_agent: req.headers['user-agent'],
          tentativas: validAttempts.length,
          bloqueado: true
        })
        .catch(err => console.error('Erro ao registrar log de segurança:', err));
    }

    return res.status(429).json({
      success: false,
      message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
      retryAfter: Math.ceil(windowMs / 1000)
    });
  }

  validAttempts.push(now);

  next();
}

// Limpar dados antigos a cada hora
setInterval(() => {
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);

  for (const [key, requests] of requestCounts.entries()) {
    const validRequests = requests.filter(timestamp => timestamp > oneHourAgo);
    if (validRequests.length === 0) {
      requestCounts.delete(key);
    } else {
      requestCounts.set(key, validRequests);
    }
  }

  for (const [ip, blockedUntil] of blockedIPs.entries()) {
    if (now > blockedUntil) {
      blockedIPs.delete(ip);
    }
  }
}, 60 * 60 * 1000);

export default { rateLimiter, loginRateLimiter };

import { createClient } from 'redis';
import env from './env.js';

let redisClient = null;
let isRedisAvailable = false;
let memoryCache = new Map();

// Tentar conectar ao Redis
async function inicializarRedis() {
  if (!env.REDIS_URL) {
    console.log('ℹ️  Redis não configurado. Usando cache em memória.');
    return false;
  }

  try {
    redisClient = createClient({
      url: env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            console.warn('⚠️  Redis indisponível após 3 tentativas. Usando cache em memória.');
            return new Error('Redis indisponível');
          }
          return retries * 100;
        }
      }
    });

    redisClient.on('error', (err) => {
      console.error('❌ Erro no Redis:', err.message);
      isRedisAvailable = false;
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis conectado com sucesso');
      isRedisAvailable = true;
    });

    redisClient.on('disconnect', () => {
      console.warn('⚠️  Redis desconectado. Usando cache em memória.');
      isRedisAvailable = false;
    });

    await redisClient.connect();
    return true;
  } catch (error) {
    console.warn('⚠️  Não foi possível conectar ao Redis:', error.message);
    console.log('ℹ️  Usando cache em memória como fallback.');
    redisClient = null;
    isRedisAvailable = false;
    return false;
  }
}

// Obter valor do cache
async function get(key) {
  if (isRedisAvailable && redisClient) {
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Erro ao ler do Redis, usando memória:', error.message);
      isRedisAvailable = false;
    }
  }

  // Fallback para memória
  const cached = memoryCache.get(key);
  if (!cached) return null;

  // Verificar expiração
  if (cached.expiresAt && Date.now() > cached.expiresAt) {
    memoryCache.delete(key);
    return null;
  }

  return cached.value;
}

// Definir valor no cache
async function set(key, value, ttlSeconds = 300) {
  if (isRedisAvailable && redisClient) {
    try {
      await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Erro ao escrever no Redis, usando memória:', error.message);
      isRedisAvailable = false;
    }
  }

  // Fallback para memória
  memoryCache.set(key, {
    value,
    expiresAt: ttlSeconds > 0 ? Date.now() + (ttlSeconds * 1000) : null
  });
  return true;
}

// Deletar valor do cache
async function del(key) {
  if (isRedisAvailable && redisClient) {
    try {
      await redisClient.del(key);
      return true;
    } catch (error) {
      console.error('Erro ao deletar do Redis:', error.message);
      isRedisAvailable = false;
    }
  }

  // Fallback para memória
  memoryCache.delete(key);
  return true;
}

// Limpar todo o cache
async function clear() {
  if (isRedisAvailable && redisClient) {
    try {
      await redisClient.flushDb();
    } catch (error) {
      console.error('Erro ao limpar Redis:', error.message);
    }
  }

  memoryCache.clear();
  console.log('🧹 Cache limpo');
}

// Limpeza automática do cache em memória (executar a cada 5 minutos)
setInterval(() => {
  const now = Date.now();
  for (const [key, cached] of memoryCache.entries()) {
    if (cached.expiresAt && now > cached.expiresAt) {
      memoryCache.delete(key);
    }
  }
}, 5 * 60 * 1000);

export default {
  inicializar: inicializarRedis,
  get,
  set,
  del,
  clear,
  isAvailable: () => isRedisAvailable
};

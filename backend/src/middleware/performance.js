// Middleware de performance monitoring
const requestTimes = new Map();

export function performanceMonitor(req, res, next) {
  const start = process.hrtime.bigint();

  // Capturar quando a resposta é enviada
  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000; // Converter para milissegundos

    const route = `${req.method} ${req.route?.path || req.path}`;

    // Adicionar header de tempo de resposta
    res.setHeader('X-Response-Time', `${durationMs.toFixed(2)}ms`);

    // Log de requisições lentas (> 1 segundo)
    if (durationMs > 1000) {
      console.warn(`⚠️  Requisição lenta: ${route} - ${durationMs.toFixed(2)}ms`);
    }

    // Guardar estatísticas (últimas 100 requisições por rota)
    if (!requestTimes.has(route)) {
      requestTimes.set(route, []);
    }

    const times = requestTimes.get(route);
    times.push(durationMs);

    if (times.length > 100) {
      times.shift(); // Remover mais antiga
    }
  });

  next();
}

export function getPerformanceStats() {
  const stats = {};

  for (const [route, times] of requestTimes.entries()) {
    if (times.length === 0) continue;

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const sorted = [...times].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    stats[route] = {
      count: times.length,
      avg: avg.toFixed(2),
      min: Math.min(...times).toFixed(2),
      max: Math.max(...times).toFixed(2),
      p50: p50.toFixed(2),
      p95: p95.toFixed(2),
      p99: p99.toFixed(2)
    };
  }

  return stats;
}

export default { performanceMonitor, getPerformanceStats };

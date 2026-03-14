import http from 'http';
import app from './app.js';
import env from './lib/env.js';
import { testarConexao, verificarTabelas } from './lib/db.js';
import cache from './lib/cache.js';
import { initializeSocket } from './lib/socket.js';

// ═══════════════════════════════════════════════════════════════════════════════
//  INICIALIZAÇÃO DO SERVIDOR
// ═══════════════════════════════════════════════════════════════════════════════

async function iniciarServidor() {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  VIDRATO — Sistema Integrado de Gestão');
  console.log('  Iniciando servidor...');
  console.log('════════════════════════════════════════════════════════════════\n');

  try {
    // 1. Testar conexão com MySQL
    console.log('📦 Verificando banco de dados...');
    const dbConnected = await testarConexao();
    if (!dbConnected) {
      console.error('❌ Não foi possível conectar ao banco de dados.');
      console.error('   Verifique as configurações no arquivo .env');
      process.exit(1);
    }

    // 2. Verificar se as tabelas existem
    const tabelasExistem = await verificarTabelas();
    if (!tabelasExistem && !env.DEMO_MODE) {
      console.warn('\n⚠️  ATENÇÃO: Tabelas não encontradas no banco de dados.');
      console.warn('   Execute o comando: npm run db:push');
      console.warn('   Ou configure DEMO_MODE=true para usar o seed automático.\n');
    }

    // 3. Inicializar cache (Redis ou memória)
    console.log('💾 Inicializando sistema de cache...');
    await cache.inicializar();

    // 4. Criar servidor HTTP
    const httpServer = http.createServer(app);

    // 5. Inicializar Socket.io
    console.log('🔌 Inicializando WebSocket...');
    initializeSocket(httpServer);

    // 6. Modo de operação
    console.log('\n📋 Configuração do sistema:');
    console.log(`   Modo: ${env.DEMO_MODE ? '🎭 DEMONSTRAÇÃO' : '🏭 PRODUÇÃO'}`);
    console.log(`   Setup: ${env.SETUP_COMPLETED ? '✅ Completo' : '⚠️  Pendente'}`);
    console.log(`   Ambiente: ${env.NODE_ENV}`);
    console.log(`   Frontend: ${env.FRONTEND_URL}`);

    // 7. Carregar seed em modo demo
    if (env.DEMO_MODE) {
      console.log('\n🎭 Modo DEMO ativado');
      console.log('   Usuários de demonstração:');
      console.log('   - admin@vidrato.demo / demo123 (ADMIN)');
      console.log('   - vendedor@vidrato.demo / demo123 (VENDEDOR)');
      console.log('   - almoxarife@vidrato.demo / demo123 (ALMOXARIFE)');
      console.log('   - operador@vidrato.demo / demo123 (OPERADOR_FABRICA)');
      console.log('   - financeiro@vidrato.demo / demo123 (FINANCEIRO)');

      // TODO: Carregar seed se tabelas existirem mas estiverem vazias
      // const { carregarSeedDemo } = await import('./demo/seed.js');
      // await carregarSeedDemo();
    }

    // 8. Iniciar cron jobs (alertas a cada 5 minutos)
    if (env.SETUP_COMPLETED || env.DEMO_MODE) {
      console.log('⏰ Iniciando jobs agendados...');
      // TODO: Importar e iniciar cron jobs
      // const { iniciarMonitorEstoque } = await import('./jobs/estoqueMonitor.js');
      // iniciarMonitorEstoque();
    }

    // 9. Iniciar servidor
    const PORT = env.PORT;
    httpServer.listen(PORT, () => {
      console.log('\n════════════════════════════════════════════════════════════════');
      console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
      console.log(`✅ API disponível em http://localhost:${PORT}/api/v1`);
      console.log(`✅ Health check: http://localhost:${PORT}/health`);
      console.log('════════════════════════════════════════════════════════════════\n');

      if (!env.SETUP_COMPLETED && !env.DEMO_MODE) {
        console.log('⚠️  Sistema não configurado. Acesse /install para configurar.\n');
      }
    });

    // 10. Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('\n⚠️  SIGTERM recebido. Encerrando servidor...');
      httpServer.close(() => {
        console.log('✅ Servidor encerrado com sucesso');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('\n⚠️  SIGINT recebido. Encerrando servidor...');
      httpServer.close(() => {
        console.log('✅ Servidor encerrado com sucesso');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('\n❌ Erro fatal ao iniciar servidor:', error);
    process.exit(1);
  }
}

// Iniciar servidor
iniciarServidor();

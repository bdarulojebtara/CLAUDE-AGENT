import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from '../../drizzle/schema.js';
import env from './env.js';

// Criar pool de conexões MySQL
const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASS,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Instância Drizzle ORM
const db = drizzle(pool, { schema, mode: 'default' });

// Testar conexão com o banco
export async function testarConexao() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Conexão com MySQL estabelecida com sucesso');
    console.log(`   Database: ${env.DB_NAME}`);
    console.log(`   Host: ${env.DB_HOST}:${env.DB_PORT}`);
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Erro ao conectar com MySQL:', error.message);
    return false;
  }
}

// Verificar se as tabelas existem
export async function verificarTabelas() {
  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) as count FROM information_schema.tables
       WHERE table_schema = ? AND table_name = 'empresas'`,
      [env.DB_NAME]
    );

    const tabelasExistem = rows[0].count > 0;

    if (!tabelasExistem) {
      console.warn('⚠️  Tabelas do banco não foram encontradas');
      console.warn('   Execute: npm run db:push');
    } else {
      console.log('✅ Tabelas do banco verificadas');
    }

    return tabelasExistem;
  } catch (error) {
    console.error('❌ Erro ao verificar tabelas:', error.message);
    return false;
  }
}

export { pool, db };
export default db;

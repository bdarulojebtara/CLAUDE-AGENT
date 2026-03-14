import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  // Modo de operação
  DEMO_MODE: z.string().transform(val => val === 'true'),
  SETUP_COMPLETED: z.string().transform(val => val === 'true'),

  // Banco de dados
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().transform(val => parseInt(val)).default('3306'),
  DB_NAME: z.string().default('vidrato'),
  DB_USER: z.string().default('root'),
  DB_PASS: z.string().default(''),

  // Redis (opcional)
  REDIS_URL: z.string().optional(),

  // Autenticação
  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter no mínimo 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),

  // Servidor
  PORT: z.string().transform(val => parseInt(val)).default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  // IA
  GEMINI_API_KEY: z.string().optional(),

  // Segurança
  BCRYPT_ROUNDS: z.string().transform(val => parseInt(val)).default('12'),
  RATE_LIMIT_MAX: z.string().transform(val => parseInt(val)).default('100'),

  // Upload
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE_MB: z.string().transform(val => parseInt(val)).default('10')
});

let env;

try {
  env = envSchema.parse(process.env);
  console.log('✅ Variáveis de ambiente validadas com sucesso');
} catch (error) {
  console.error('❌ Erro na validação das variáveis de ambiente:');
  if (error instanceof z.ZodError) {
    error.errors.forEach(err => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
  }
  process.exit(1);
}

export default env;

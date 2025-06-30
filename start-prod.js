// Configurações de produção
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '3001';
process.env.LOG_LEVEL = 'info';
process.env.WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'prod_secret_' + Math.random().toString(36).slice(2);
process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || '*';
process.env.WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || 'https://webhook.bkcrm.devsible.com.br';

// Carregar variáveis de ambiente do arquivo .env
require('dotenv').config();

// Verificar variáveis obrigatórias
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'JWT_SECRET',
  'API_KEY'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Erro: Variáveis de ambiente obrigatórias não definidas:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\n📝 Crie um arquivo .env com as variáveis necessárias');
  process.exit(1);
}

// Iniciar servidor
try {
  require('./src/server');
  console.log('🚀 Servidor iniciado em modo produção');
  console.log(`📡 Porta: ${process.env.PORT}`);
  console.log(`🌐 URL Base: ${process.env.WEBHOOK_BASE_URL}`);
} catch (error) {
  console.error('❌ Erro ao iniciar servidor:', error);
  process.exit(1);
} 
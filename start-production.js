// Configurações de produção
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '3001';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'info';
process.env.WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'prod_secret';
process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || '*';
process.env.WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || `https://webhook.bkcrm.devsible.com.br`;

// Log das configurações (sem secrets)
console.log('🚀 Iniciando servidor em modo PRODUÇÃO...');
console.log('📊 Configurações:');
console.log(`  - Ambiente: ${process.env.NODE_ENV}`);
console.log(`  - Porta: ${process.env.PORT}`);
console.log(`  - Log Level: ${process.env.LOG_LEVEL}`);
console.log(`  - CORS Origins: ${process.env.ALLOWED_ORIGINS}`);
console.log(`  - Webhook Base URL: ${process.env.WEBHOOK_BASE_URL}`);
console.log('');

// Configurações específicas para produção
if (process.env.NODE_ENV === 'production') {
  // Configurar uncaught exception handler
  process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    console.error('🔄 Tentando graceful shutdown...');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    console.error('🔄 Tentando graceful shutdown...');
    process.exit(1);
  });

  // Graceful shutdown handlers
  process.on('SIGTERM', () => {
    console.log('📤 SIGTERM received, shutting down gracefully...');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('📤 SIGINT received, shutting down gracefully...');
    process.exit(0);
  });
}

// Iniciar servidor simples
try {
  require('./src/server-simple');
} catch (error) {
  console.error('💥 Erro fatal ao iniciar servidor:', error);
  process.exit(1);
} 
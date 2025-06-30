// Configurações de desenvolvimento
process.env.NODE_ENV = 'development';
process.env.PORT = '3001';
process.env.LOG_LEVEL = 'debug';
process.env.WEBHOOK_SECRET = 'dev_secret';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000,http://localhost:3001';
process.env.WEBHOOK_BASE_URL = 'http://localhost:3001';

// Iniciar servidor
require('./src/server-simple'); 
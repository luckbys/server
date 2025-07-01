import dotenv from 'dotenv';
dotenv.config();

const config = {
  // Ambiente
  env: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',

  // Servidor
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || 'localhost',
  baseUrl: process.env.BASE_URL || 'http://localhost:3001',
  apiPrefix: '/api',

  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_KEY
  },

  // Evolution API
  evolution: {
    baseUrl: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
    webhookUrl: process.env.WEBHOOK_BASE_URL || 'http://localhost:3001',
    defaultInstance: process.env.DEFAULT_INSTANCE || 'default'
  },

  // Logs
  logs: {
    level: process.env.LOG_LEVEL || 'info',
    directory: process.env.LOG_DIRECTORY || './logs',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: process.env.LOG_MAX_FILES || '14d',
    errorMaxFiles: process.env.LOG_ERROR_MAX_FILES || '30d',
    webhookMaxFiles: process.env.LOG_WEBHOOK_MAX_FILES || '7d'
  },

  // Segurança
  security: {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 100 // limite de 100 requisições por windowMs
    }
  },

  // Cache
  cache: {
    ttl: parseInt(process.env.CACHE_TTL || '300', 10), // 5 minutos em segundos
    checkPeriod: parseInt(process.env.CACHE_CHECK_PERIOD || '600', 10) // 10 minutos em segundos
  },

  // Filas
  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '3', 10),
    attempts: parseInt(process.env.QUEUE_ATTEMPTS || '3', 10),
    backoff: {
      type: 'exponential',
      delay: 1000 // delay inicial de 1 segundo
    }
  }
};

// Construir URLs completas
config.urls = {
  api: `${config.evolution.webhookUrl}${config.apiPrefix}`,
  health: `${config.evolution.webhookUrl}${config.apiPrefix}/health`,
  webhookGeneric: `${config.evolution.webhookUrl}${config.apiPrefix}/:event`,
  webhookMessages: `${config.evolution.webhookUrl}${config.apiPrefix}/webhook/evolution/:instanceName`
};

export default config; 
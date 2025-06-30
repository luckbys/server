import { config } from 'dotenv';
import { ServerConfig } from '../types';

// Carregar variáveis de ambiente
config();

const getConfig = (): ServerConfig => {
  const nodeEnv = (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development';
  
  return {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv,
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
    webhookSecret: process.env.WEBHOOK_SECRET,
    
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      name: process.env.DB_NAME || 'evolution_webhook',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      ssl: process.env.DB_SSL === 'true' || nodeEnv === 'production'
    },
    
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10)
    },
    
    rabbitmq: {
      url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
      queues: {
        messages: process.env.RABBITMQ_MESSAGES_QUEUE || 'evolution.messages',
        events: process.env.RABBITMQ_EVENTS_QUEUE || 'evolution.events',
        deadLetter: process.env.RABBITMQ_DEAD_LETTER_QUEUE || 'evolution.dead_letter'
      }
    },
    
    logging: {
      level: process.env.LOG_LEVEL || (nodeEnv === 'production' ? 'info' : 'debug'),
      file: process.env.LOG_FILE
    }
  };
};

export default getConfig(); 
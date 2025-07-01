import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { RateLimiterMemory } from 'rate-limiter-flexible';

import config from './config';
import logger from './utils/logger';
import db from './database/connection';
import cache from './services/cache';
import queue from './services/queue';
import runMigrations from './database/migrations/run';
import { addRequestId, requestLogger } from './middleware/security';

import webhookRoutes from './routes/webhook';
import healthRoutes from './routes/health';
import statsRoutes from './routes/stats';
import { MessageQueuePayload } from './types';

class EvolutionWebhookServer {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;
  private rateLimiter: RateLimiterMemory;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: config.corsOrigins,
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      }
    });

    this.rateLimiter = new RateLimiterMemory({
      keyGenerator: (req: express.Request) => req.ip || 'unknown',
      points: 100, // Número de requests
      duration: 60, // Por minuto
    });

    this.setupMiddlewares();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupErrorHandling();
  }

  private setupMiddlewares(): void {
    // Request ID e Logging
    this.app.use(addRequestId);
    this.app.use(requestLogger);

    // Segurança
    this.app.use(helmet());
    
    // CORS
    this.app.use(cors({
      origin: config.corsOrigins,
      credentials: true
    }));

    // Compressão
    this.app.use(compression());

    // Rate limiting
    this.app.use(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        await this.rateLimiter.consume(req.ip || 'unknown');
        next();
      } catch (rateLimiterRes) {
        logger.warn('🚫 Rate limit excedido', {
          requestId: req.id,
          ip: req.ip,
          path: req.path,
          retryAfter: Math.round(rateLimiterRes.msBeforeNext / 1000) || 1
        });

        res.status(429).json({
          success: false,
          message: 'Rate limit excedido',
          retryAfter: Math.round(rateLimiterRes.msBeforeNext / 1000) || 1,
        });
      }
    });

    // Body parser
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging de requests
    this.app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.debug(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Rotas principais
    this.app.use('/api/health', healthRoutes);
    this.app.use('/api/stats', statsRoutes);
    this.app.use('/api', webhookRoutes);

    // Rota raiz
    this.app.get('/', (req: express.Request, res: express.Response) => {
      res.json({
        status: 200,
        message: 'Evolution Webhook Server - Scalable Version',
        version: '2.0.0',
        documentation: 'https://doc.evolution-api.com',
        serverUrl: `http://localhost:${config.port}`,
        capabilities: {
          webhooks: true,
          websocket: true,
          messageTypes: ['text', 'image', 'video', 'audio', 'document', 'location', 'contact', 'buttons', 'list'],
          integrations: ['postgresql', 'redis', 'rabbitmq', 'websocket'],
          features: ['rate-limiting', 'caching', 'queue-processing', 'horizontal-scaling']
        },
        infrastructure: {
          database: 'PostgreSQL',
          cache: 'Redis',
          queue: 'RabbitMQ',
          websocket: 'Socket.IO'
        }
      });
    });

    // 404 handler
    this.app.use('*', (req: express.Request, res: express.Response) => {
      res.status(404).json({
        success: false,
        message: 'Endpoint não encontrado',
        path: req.originalUrl
      });
    });
  }

  private setupWebSocket(): void {
    this.io.on('connection', (socket) => {
      logger.info('🔌 Cliente WebSocket conectado', { socketId: socket.id });

      socket.on('disconnect', () => {
        logger.info('🔌 Cliente WebSocket desconectado', { socketId: socket.id });
      });

      // Eventos personalizados
      socket.on('join-instance', (instanceName: string) => {
        socket.join(`instance:${instanceName}`);
        logger.debug(`📡 Cliente joined instance: ${instanceName}`, { socketId: socket.id });
      });

      socket.on('leave-instance', (instanceName: string) => {
        socket.leave(`instance:${instanceName}`);
        logger.debug(`📡 Cliente left instance: ${instanceName}`, { socketId: socket.id });
      });
    });
  }

  private setupErrorHandling(): void {
    // Error handler global
    this.app.use((
      error: Error,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      logger.error('💥 Erro não tratado:', error);
      
      res.status(500).json({
        success: false,
        message: config.nodeEnv === 'production' ? 'Erro interno do servidor' : error.message,
        timestamp: new Date().toISOString()
      });
    });

    // Handlers de processo
    process.on('uncaughtException', (error: Error) => {
      logger.error('💥 Uncaught Exception:', error);
      this.gracefulShutdown();
    });

    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.error('💥 Unhandled Rejection at:', { promise, reason });
    });

    process.on('SIGTERM', () => {
      logger.info('📤 SIGTERM recebido, iniciando shutdown graceful...');
      this.gracefulShutdown();
    });

    process.on('SIGINT', () => {
      logger.info('📤 SIGINT recebido, iniciando shutdown graceful...');
      this.gracefulShutdown();
    });
  }

  private async setupQueueConsumers(): Promise<void> {
    // Consumer para mensagens
    await queue.startMessageConsumer(async (payload: MessageQueuePayload) => {
      try {
        logger.info('📥 Processando mensagem da fila', {
          id: payload.id,
          eventType: payload.eventType,
          instanceName: payload.instanceName
        });

        // Processar mensagem (implementar lógica específica)
        await this.processMessage(payload);

        // Emitir via WebSocket
        this.io.to(`instance:${payload.instanceName}`).emit('message', payload);
        
      } catch (error) {
        logger.error('❌ Erro ao processar mensagem da fila:', error);
        throw error; // Re-throw para rejeitar a mensagem
      }
    });

    // Consumer para eventos
    await queue.startEventConsumer(async (payload: MessageQueuePayload) => {
      try {
        logger.info('📥 Processando evento da fila', {
          id: payload.id,
          eventType: payload.eventType,
          instanceName: payload.instanceName
        });

        // Processar evento (implementar lógica específica)
        await this.processEvent(payload);

        // Emitir via WebSocket
        this.io.to(`instance:${payload.instanceName}`).emit('event', payload);
        
      } catch (error) {
        logger.error('❌ Erro ao processar evento da fila:', error);
        throw error;
      }
    });
  }

  private async processMessage(payload: MessageQueuePayload): Promise<void> {
    // Implementar lógica de processamento de mensagens
    // Por exemplo: salvar no banco, processar com IA, etc.
    logger.debug('💬 Processando mensagem:', payload);
  }

  private async processEvent(payload: MessageQueuePayload): Promise<void> {
    // Implementar lógica de processamento de eventos
    // Por exemplo: atualizar status, cache, notificações, etc.
    logger.debug('🎯 Processando evento:', payload);
  }

  public async start(): Promise<void> {
    try {
      logger.info('🚀 Iniciando Evolution Webhook Server (Scalable)...');

      // Conectar aos serviços
      logger.info('🔌 Conectando aos serviços...');
      
      // Testar conexão com banco
      const dbConnected = await db.testConnection();
      if (!dbConnected) {
        throw new Error('Falha ao conectar com PostgreSQL');
      }

      // Executar migrations
      await runMigrations();

      // Conectar Redis (opcional em desenvolvimento)
      try {
        await cache.connect();
      } catch (error) {
        logger.warn('⚠️ Redis não disponível (modo desenvolvimento):', error);
      }

      // Conectar RabbitMQ (opcional em desenvolvimento)
      try {
        await queue.connect();
        await this.setupQueueConsumers();
      } catch (error) {
        logger.warn('⚠️ RabbitMQ não disponível (modo desenvolvimento):', error);
      }

      // Iniciar servidor
      this.server.listen(config.port, () => {
        logger.info('✅ Servidor iniciado com sucesso!');
        logger.info(`📡 Porta: ${config.port}`);
        logger.info(`🌍 Ambiente: ${config.nodeEnv}`);
        logger.info('🌐 URLs:');
        logger.info(`  - API: http://localhost:${config.port}/api`);
        logger.info(`  - Health: http://localhost:${config.port}/api/health`);
        logger.info(`  - Stats: http://localhost:${config.port}/api/stats`);
        logger.info(`  - Webhook: http://localhost:${config.port}/api/webhook/evolution/:instanceName`);
        logger.info('');
        logger.info('🎯 Recursos habilitados:');
        logger.info('  ✅ PostgreSQL (Persistência)');
        logger.info('  ✅ WebSocket (Tempo real)');
        logger.info('  ✅ Rate Limiting (Segurança)');
        logger.info('  ✅ CORS (Cross-origin)');
        logger.info('  ✅ Helmet (Segurança)');
        logger.info('  ✅ Compressão (Performance)');
        if (cache.isConnected()) {
          logger.info('  ✅ Redis (Cache)');
        }
        if (queue.isConnected()) {
          logger.info('  ✅ RabbitMQ (Filas)');
        }
      });

    } catch (error) {
      logger.error('💥 Falha ao iniciar servidor:', error);
      process.exit(1);
    }
  }

  private async gracefulShutdown(): Promise<void> {
    logger.info('🔄 Iniciando shutdown graceful...');

    // Fechar servidor HTTP
    this.server.close(() => {
      logger.info('🔌 Servidor HTTP fechado');
    });

    // Fechar conexões
    await Promise.all([
      db.close(),
      cache.disconnect(),
      queue.disconnect()
    ]);

    logger.info('✅ Shutdown concluído');
    process.exit(0);
  }

  public getApp(): express.Application {
    return this.app;
  }

  public getIO(): SocketIOServer {
    return this.io;
  }
}

// Iniciar servidor se não estiver em teste
if (process.env.NODE_ENV !== 'test') {
  const server = new EvolutionWebhookServer();
  server.start();
}

export default EvolutionWebhookServer; 
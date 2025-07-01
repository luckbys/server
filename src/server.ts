import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { RateLimiterMemory } from 'rate-limiter-flexible';

import config from './config';
import logger, { 
  logSystemStatus, 
  logUserAction, 
  logEvolutionApi,
  logWhatsAppStatus,
  logError
} from './utils/logger';
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
        logger.warn('🚫 Taxa limite excedida! Pedindo para o cliente aguardar um pouco...', {
          requestId: req.id,
          ip: req.ip,
          path: req.path,
          retryAfter: Math.round(rateLimiterRes.msBeforeNext / 1000) || 1
        });

        res.status(429).json({
          success: false,
          message: 'Muitas requisições! Por favor, aguarde um momento antes de tentar novamente.',
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
      logger.warn('🔍 Rota não encontrada', {
        requestId: req.id,
        path: req.originalUrl,
        method: req.method
      });

      res.status(404).json({
        success: false,
        message: 'Ops! Essa rota não existe em nosso servidor.',
        path: req.originalUrl
      });
    });
  }

  private setupWebSocket(): void {
    this.io.on('connection', (socket) => {
      logger.info('🔌 Novo cliente conectado ao WebSocket!', { 
        socketId: socket.id,
        userAgent: socket.handshake.headers['user-agent']
      });

      socket.on('disconnect', () => {
        logger.info('👋 Cliente WebSocket desconectou', { 
          socketId: socket.id 
        });
      });

      // Eventos personalizados
      socket.on('join-instance', (instanceName: string) => {
        socket.join(`instance:${instanceName}`);
        logger.debug(`📡 Cliente entrou na sala da instância: ${instanceName}`, { 
          socketId: socket.id 
        });
      });

      socket.on('leave-instance', (instanceName: string) => {
        socket.leave(`instance:${instanceName}`);
        logger.debug(`📡 Cliente saiu da sala da instância: ${instanceName}`, { 
          socketId: socket.id 
        });
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
      logError(error, 'Erro não tratado no servidor', req);
      
      res.status(500).json({
        success: false,
        message: config.nodeEnv === 'production' 
          ? 'Ops! Tivemos um problema interno. Nossa equipe já foi notificada!' 
          : error.message,
        timestamp: new Date().toISOString()
      });
    });

    // Handlers de processo
    process.on('uncaughtException', (error: Error) => {
      logError(error, 'Exceção não capturada');
      this.gracefulShutdown();
    });

    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logError(new Error(reason?.message || 'Unknown error'), 'Promessa rejeitada não tratada');
    });

    process.on('SIGTERM', () => {
      logSystemStatus('shutdown', { reason: 'SIGTERM' });
      this.gracefulShutdown();
    });

    process.on('SIGINT', () => {
      logSystemStatus('shutdown', { reason: 'SIGINT' });
      this.gracefulShutdown();
    });
  }

  private async setupQueueConsumers(): Promise<void> {
    // Consumer para mensagens
    await queue.startMessageConsumer(async (payload: MessageQueuePayload) => {
      try {
        logger.info('📬 Nova mensagem recebida na fila para processamento', {
          id: payload.id,
          eventType: payload.eventType,
          instanceName: payload.instanceName
        });

        // Processar mensagem
        await this.processMessage(payload);

        logger.info('✨ Mensagem processada com sucesso!', {
          id: payload.id,
          eventType: payload.eventType
        });
      } catch (error) {
        logError(error as Error, 'Falha ao processar mensagem da fila', undefined);
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
      // Banner de inicialização
      const banner = [
        '🌟 BKCRM - Evolution Webhook Server 🌟',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        `🚀 Iniciando servidor em modo ${config.nodeEnv.toUpperCase()}`,
        '',
        '📊 Configurações do Servidor:',
        `  • Ambiente: ${config.nodeEnv}`,
        `  • Porta: ${config.port}`,
        `  • Log Level: ${config.logging.level}`,
        `  • Diretório de Logs: ${config.logging.directory}`,
        '',
        '🔒 Configurações de Segurança:',
        `  • CORS: ${config.corsOrigins.join(', ')}`,
        `  • Rate Limit: 100 req/min`,
        `  • Helmet: Ativado`,
        `  • Compressão: Ativada`,
        '',
        '🔌 Serviços Integrados:'
      ].join('\n');

      console.log('\n' + banner + '\n');

      // Conectar ao banco
      logger.info('📦 Conectando ao PostgreSQL...');
      await db.connect();
      logger.info('✅ PostgreSQL conectado com sucesso!');

      // Rodar migrações
      logger.info('🔄 Aplicando migrações do banco...');
      await runMigrations();
      logger.info('✅ Migrações aplicadas com sucesso!');

      // Conectar ao Redis
      logger.info('⚡ Conectando ao Redis...');
      await cache.connect();
      logger.info('✅ Redis conectado com sucesso!');

      // Conectar ao RabbitMQ
      logger.info('🐰 Conectando ao RabbitMQ...');
      await queue.connect();
      logger.info('✅ RabbitMQ conectado com sucesso!');

      // Iniciar consumers
      logger.info('📥 Iniciando consumidores de fila...');
      await this.setupQueueConsumers();
      logger.info('✅ Consumidores iniciados com sucesso!');

      // Iniciar servidor HTTP
      this.server.listen(config.port, () => {
        const urls = [
          '',
          '🌐 URLs Disponíveis:',
          `  • API: https://webhook.bkcrm.devsible.com.br/api`,
          `  • Health Check: https://webhook.bkcrm.devsible.com.br/api/health`,
          `  • Estatísticas: https://webhook.bkcrm.devsible.com.br/api/stats`,
          `  • Webhook Evolution: https://webhook.bkcrm.devsible.com.br/api/webhook/evolution/:instanceName`,
          '',
          '✨ Recursos Ativos:',
          '  ✓ PostgreSQL (Persistência)',
          '  ✓ Redis (Cache)',
          '  ✓ RabbitMQ (Filas)',
          '  ✓ WebSocket (Real-time)',
          '  ✓ Rate Limiting',
          '  ✓ CORS',
          '  ✓ Helmet',
          '  ✓ Compressão',
          '',
          '🎉 Servidor pronto para uso!',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
        ].join('\n');

        console.log(urls);
        
        logSystemStatus('ready', {
          port: config.port,
          environment: config.nodeEnv,
          services: {
            postgresql: true,
            redis: cache.isConnected(),
            rabbitmq: queue.isConnected(),
            websocket: true
          }
        });
      });
    } catch (error) {
      logError(error as Error, 'Falha ao iniciar servidor');
      process.exit(1);
    }
  }

  private async gracefulShutdown(): Promise<void> {
    try {
      const banner = [
        '',
        '🛑 Iniciando desligamento gracioso do servidor',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      ].join('\n');

      console.log(banner);

      // Parar de aceitar novas conexões
      this.server.close();
      logger.info('✅ Servidor HTTP parado');

      // Desconectar WebSocket
      this.io.close();
      logger.info('✅ Conexões WebSocket encerradas');

      // Desconectar do banco
      await db.disconnect();
      logger.info('✅ PostgreSQL desconectado');

      // Desconectar do Redis
      await cache.disconnect();
      logger.info('✅ Redis desconectado');

      // Desconectar do RabbitMQ
      await queue.disconnect();
      logger.info('✅ RabbitMQ desconectado');

      const finalBanner = [
        '',
        '✨ Servidor finalizado com sucesso!',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        ''
      ].join('\n');

      console.log(finalBanner);
      process.exit(0);
    } catch (error) {
      logError(error as Error, 'Erro durante shutdown');
      process.exit(1);
    }
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
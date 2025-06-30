require('dotenv').config();

const express = require('express');
const http = require('http');
const compression = require('compression');
const path = require('path');

// Importar configurações
const logger = require('./config/logger');
const { testConnection } = require('./config/supabase');
const webSocketManager = require('./config/websocket');

// Importar middlewares
const { helmet, cors, limiter, sanitizeInput, requestLogger } = require('./middleware/security');

// Importar rotas
const routes = require('./routes');

class Server {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.port = process.env.PORT || 3000;
    this.io = null;
  }
  
  // Inicializar servidor
  async initialize() {
    try {
      // Testar conexão com banco de dados
      logger.info('Testando conexão com Supabase...');
      const dbConnected = await testConnection();
      if (!dbConnected) {
        logger.warn('Falha na conexão com Supabase, mas continuando...');
      }
      
      // Configurar middlewares
      this.setupMiddlewares();
      
      // Configurar rotas
      this.setupRoutes();
      
      // Configurar WebSocket
      this.setupWebSocket();
      
      // Configurar tratamento de erros
      this.setupErrorHandling();
      
      logger.info('Servidor inicializado com sucesso');
    } catch (error) {
      logger.error('Erro ao inicializar servidor:', error);
      process.exit(1);
    }
  }
  
  // Configurar middlewares
  setupMiddlewares() {
    // Middleware de compressão
    this.app.use(compression());
    
    // Middlewares de segurança
    this.app.use(helmet);
    this.app.use(cors);
    
    // Middleware de logging
    this.app.use(requestLogger);
    
    // Rate limiting geral
    this.app.use(limiter);
    
    // Parse JSON com limite
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Sanitização de entrada
    this.app.use(sanitizeInput);
    
    // Servir arquivos estáticos (uploads)
    this.app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
    
    // Trust proxy para obter IP real
    this.app.set('trust proxy', 1);
    
    logger.info('Middlewares configurados');
  }
  
  // Configurar rotas
  setupRoutes() {
    // Usar rotas principais
    this.app.use('/api', routes);
    
    // Rota raiz
    this.app.get('/', (req, res) => {
      res.json({
        success: true,
        message: 'Evolution Webhook Server está funcionando!',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/api/health',
          info: '/api/info',
          stats: '/api/stats',
          instances: '/api/instances',
          webhook: '/api/webhook/evolution/:instanceName'
        }
      });
    });
    
    logger.info('Rotas configuradas');
  }
  
  // Configurar WebSocket
  setupWebSocket() {
    this.io = webSocketManager.initialize(this.server);
    
    // Tornar WebSocket disponível para toda a aplicação
    this.app.set('io', this.io);
    
    // Adicionar métodos de WebSocket aos controllers
    this.app.use((req, res, next) => {
      req.io = this.io;
      req.wsManager = webSocketManager;
      next();
    });
    
    logger.info('WebSocket configurado');
  }
  
  // Configurar tratamento de erros
  setupErrorHandling() {
    // Middleware de erro global
    this.app.use((error, req, res, next) => {
      logger.error('Erro não tratado:', {
        error: error.message,
        stack: error.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip
      });
      
      res.status(error.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 
          'Erro interno do servidor' : 
          error.message,
        timestamp: new Date().toISOString()
      });
    });
    
    // Tratamento de promises rejeitadas
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Promise rejeitada não tratada:', { reason, promise });
    });
    
    // Tratamento de exceções não capturadas
    process.on('uncaughtException', (error) => {
      logger.error('Exceção não capturada:', error);
      process.exit(1);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM recebido, encerrando servidor...');
      this.shutdown();
    });
    
    process.on('SIGINT', () => {
      logger.info('SIGINT recebido, encerrando servidor...');
      this.shutdown();
    });
    
    logger.info('Tratamento de erros configurado');
  }
  
  // Iniciar servidor
  async start() {
    try {
      await this.initialize();
      
      this.server.listen(this.port, () => {
        logger.info(`Servidor rodando na porta ${this.port}`, {
          port: this.port,
          environment: process.env.NODE_ENV || 'development',
          pid: process.pid,
          urls: {
            local: `http://localhost:${this.port}`,
            health: `http://localhost:${this.port}/api/health`,
            webhook: `http://localhost:${this.port}/api/webhook/evolution/:instanceName`
          }
        });
        
        // Emitir evento de inicialização via WebSocket se houver clientes
        setTimeout(() => {
          if (this.io) {
            webSocketManager.broadcast('server-started', {
              port: this.port,
              environment: process.env.NODE_ENV || 'development',
              version: '1.0.0'
            });
          }
        }, 1000);
      });
    } catch (error) {
      logger.error('Erro ao iniciar servidor:', error);
      process.exit(1);
    }
  }
  
  // Encerrar servidor graciosamente
  async shutdown() {
    logger.info('Iniciando encerramento gracioso do servidor...');
    
    try {
      // Fechar conexões WebSocket
      if (this.io) {
        webSocketManager.broadcast('server-shutdown', {
          message: 'Servidor sendo encerrado'
        });
        
        this.io.close();
        logger.info('WebSocket encerrado');
      }
      
      // Encerrar servidor HTTP
      this.server.close(() => {
        logger.info('Servidor HTTP encerrado');
        process.exit(0);
      });
      
      // Forçar encerramento após timeout
      setTimeout(() => {
        logger.warn('Forçando encerramento do servidor...');
        process.exit(1);
      }, 10000);
    } catch (error) {
      logger.error('Erro ao encerrar servidor:', error);
      process.exit(1);
    }
  }
}

// Criar e iniciar servidor
const server = new Server();

// Verificar variáveis de ambiente essenciais
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  logger.error('Variáveis de ambiente obrigatórias não definidas');
  logger.error('Certifique-se de definir: SUPABASE_URL, SUPABASE_ANON_KEY');
  process.exit(1);
}

// Iniciar servidor
server.start().catch((error) => {
  logger.error('Falha ao iniciar servidor:', error);
  process.exit(1);
});

module.exports = server; 
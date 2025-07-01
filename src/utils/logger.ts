import winston from 'winston';
import 'winston-daily-rotate-file';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import config from '../config';

// Interfaces
interface LogMetadata {
  requestId?: string;
  instanceName?: string;
  userId?: string;
  path?: string;
  method?: string;
  duration?: number;
  statusCode?: number;
  [key: string]: any;
}

// Constantes
const LOG_LEVELS = {
  error: 0,    // Erros críticos que precisam de atenção imediata
  warn: 1,     // Avisos importantes mas não críticos
  info: 2,     // Informações gerais sobre o funcionamento do sistema
  http: 3,     // Logs específicos de requisições HTTP
  verbose: 4,  // Informações detalhadas para debugging
  debug: 5,    // Informações muito detalhadas para desenvolvimento
  silly: 6     // Logs extremamente detalhados
};

// Emojis para diferentes tipos de eventos
const EVENT_EMOJIS = {
  // Status do Sistema
  startup: '🚀',
  shutdown: '🛑',
  ready: '✨',
  
  // Conexões
  connected: '🔌',
  disconnected: '🔍',
  reconnecting: '🔄',
  
  // Mensagens
  messageReceived: '📥',
  messageSent: '📤',
  messageError: '📨❌',
  messageQueued: '📬',
  messageProcessed: '✅',
  
  // Webhooks
  webhookReceived: '🎣',
  webhookSent: '🎯',
  webhookError: '🎣❌',
  webhookRetry: '🔁',
  
  // Database
  dbQuery: '🗃️',
  dbSuccess: '💾',
  dbError: '💽❌',
  dbMigration: '📦',
  
  // Cache
  cacheHit: '⚡',
  cacheMiss: '🔍',
  cacheUpdate: '🔄',
  
  // Segurança
  authSuccess: '🔐',
  authError: '🚫',
  rateLimit: '⚠️',
  
  // Performance
  slowOperation: '🐢',
  fastOperation: '🚄',
  optimization: '⚡',
  
  // Integrações
  whatsappStatus: '📱',
  evolutionApi: '🤖',
  rabbitmq: '🐰',
  redis: '📦',
  
  // Erros e Avisos
  error: '💥',
  warning: '⚠️',
  critical: '🚨',
  
  // Usuários
  userAction: '👤',
  adminAction: '👑',
  
  // Outros
  success: '✅',
  failed: '❌',
  pending: '⏳',
  scheduled: '📅'
};

// Formatos personalizados
const formats = {
  // Formato base com timestamp e nível
  base: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true })
  ),

  // Formato para console com cores e emojis
  console: winston.format.printf(({ level, message, timestamp, stack, ...metadata }) => {
    const metaString = Object.keys(metadata).length ? 
      `\n${JSON.stringify(metadata, null, 2)}` : '';
    
    const emoji = {
      error: EVENT_EMOJIS.error,
      warn: EVENT_EMOJIS.warning,
      info: EVENT_EMOJIS.success,
      http: '🌐',
      verbose: '📝',
      debug: '🔍',
      silly: '🎈'
    }[level] || '📋';

    return `${timestamp} ${emoji} [${level.toUpperCase()}]: ${message}${
      stack ? `\n${stack}` : ''
    }${metaString}`;
  }),

  // Formato para arquivo JSON
  file: winston.format.combine(
    winston.format.json()
  )
};

// Configuração de transports
const transports = {
  // Console transport
  console: new winston.transports.Console({
    level: config.logging.consoleLevel || 'info',
    format: winston.format.combine(
      winston.format.colorize(),
      formats.base,
      formats.console
    )
  }),

  // Arquivo de logs gerais
  file: new winston.transports.DailyRotateFile({
    level: config.logging.fileLevel || 'info',
    dirname: 'logs',
    filename: 'bkcrm-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    format: winston.format.combine(
      formats.base,
      formats.file
    )
  }),

  // Arquivo específico para erros
  errorFile: new winston.transports.DailyRotateFile({
    level: 'error',
    dirname: 'logs/errors',
    filename: 'error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '30d',
    format: winston.format.combine(
      formats.base,
      formats.file
    )
  }),

  // Arquivo específico para webhooks
  webhookFile: new winston.transports.DailyRotateFile({
    level: 'info',
    dirname: 'logs/webhooks',
    filename: 'webhook-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '7d',
    format: winston.format.combine(
      formats.base,
      formats.file
    )
  })
};

// Criar logger
const logger = winston.createLogger({
  levels: LOG_LEVELS,
  transports: [
    transports.console,
    transports.file,
    transports.errorFile,
    transports.webhookFile
  ],
  exitOnError: false
});

// Funções auxiliares
const getRequestMetadata = (req?: Request): LogMetadata => {
  if (!req) return {};
  return {
    requestId: req.headers['x-request-id'] as string || uuidv4(),
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    instanceName: req.params.instanceName
  };
};

const getSystemInfo = () => ({
  hostname: os.hostname(),
  platform: os.platform(),
  memory: {
    total: os.totalmem(),
    free: os.freemem(),
    usage: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2) + '%'
  },
  cpu: os.cpus().length,
  uptime: os.uptime()
});

// Funções de log especializadas
export const logWebhook = (event: string, instanceName: string, data: any, req?: Request) => {
  const metadata = {
    ...getRequestMetadata(req),
    event,
    instanceName,
    dataKeys: Object.keys(data || {}),
    timestamp: new Date().toISOString()
  };

  logger.info(`${EVENT_EMOJIS.webhookReceived} Novo webhook recebido da Evolution API! Evento: ${event}`, metadata);
};

export const logMessage = (messageData: any, req?: Request) => {
  const metadata = {
    ...getRequestMetadata(req),
    id: messageData.id,
    from: messageData.from,
    type: messageData.messageType,
    timestamp: messageData.timestamp
  };

  logger.info(`${EVENT_EMOJIS.messageReceived} Nova mensagem chegou no WhatsApp! Tipo: ${messageData.messageType}`, metadata);
};

export const logError = (error: Error, context?: string, req?: Request) => {
  const metadata = {
    ...getRequestMetadata(req),
    context,
    errorName: error.name,
    errorMessage: error.message,
    stack: error.stack,
    systemInfo: getSystemInfo()
  };

  logger.error(`${EVENT_EMOJIS.error} Ops! Encontramos um problema${context ? ` em ${context}` : ''}`, metadata);
};

export const logDatabase = (operation: string, table: string, result: any, duration: number, req?: Request) => {
  const metadata = {
    ...getRequestMetadata(req),
    operation,
    table,
    duration,
    success: !!result,
    affectedRows: result?.rowCount || 0
  };

  const emoji = result ? EVENT_EMOJIS.dbSuccess : EVENT_EMOJIS.dbError;
  const speed = duration < 100 ? EVENT_EMOJIS.fastOperation : EVENT_EMOJIS.slowOperation;

  logger.debug(`${emoji} Operação no banco de dados ${result ? 'concluída' : 'falhou'} ${speed} (${duration}ms)`, metadata);
};

export const logQueue = (operation: string, queue: string, messageId: string, metadata: any = {}, req?: Request) => {
  const logMetadata = {
    ...getRequestMetadata(req),
    operation,
    queue,
    messageId,
    ...metadata
  };

  logger.debug(`${EVENT_EMOJIS.rabbitmq} Mensagem ${operation === 'send' ? 'enviada para' : 'recebida da'} fila ${queue}`, logMetadata);
};

export const logPerformance = (context: string, duration: number, metadata: any = {}, req?: Request) => {
  const logMetadata = {
    ...getRequestMetadata(req),
    context,
    duration,
    ...metadata,
    systemInfo: getSystemInfo()
  };

  const emoji = duration < 100 ? EVENT_EMOJIS.fastOperation : EVENT_EMOJIS.slowOperation;
  logger.verbose(`${emoji} Performance medida em ${context}: ${duration}ms`, logMetadata);
};

export const logSecurity = (event: string, metadata: any = {}, req?: Request) => {
  const logMetadata = {
    ...getRequestMetadata(req),
    event,
    ...metadata
  };

  const emoji = event.includes('success') ? EVENT_EMOJIS.authSuccess : EVENT_EMOJIS.authError;
  logger.warn(`${emoji} Evento de segurança: ${event}`, logMetadata);
};

export const logWebhookError = (error: Error, webhookData: any, req?: Request) => {
  const metadata = {
    ...getRequestMetadata(req),
    errorName: error.name,
    errorMessage: error.message,
    stack: error.stack,
    webhookUrl: webhookData?.url,
    webhookEvent: webhookData?.event,
    retryCount: webhookData?.retryCount,
    systemInfo: getSystemInfo()
  };

  const retryEmoji = webhookData?.retryCount ? EVENT_EMOJIS.webhookRetry : EVENT_EMOJIS.webhookError;
  logger.error(`${retryEmoji} Falha ao processar webhook ${webhookData?.retryCount ? `(Tentativa ${webhookData.retryCount})` : ''}`, metadata);
};

export const logWhatsAppStatus = (status: string, instanceName: string, metadata: any = {}) => {
  logger.info(`${EVENT_EMOJIS.whatsappStatus} Status do WhatsApp atualizado: ${status} (${instanceName})`, metadata);
};

export const logEvolutionApi = (action: string, result: string, metadata: any = {}) => {
  const emoji = result === 'success' ? EVENT_EMOJIS.success : EVENT_EMOJIS.failed;
  logger.info(`${EVENT_EMOJIS.evolutionApi} Evolution API: ${action} ${emoji}`, metadata);
};

export const logUserAction = (action: string, userId: string, metadata: any = {}) => {
  logger.info(`${EVENT_EMOJIS.userAction} Usuário ${userId} realizou: ${action}`, metadata);
};

export const logSystemStatus = (status: 'startup' | 'shutdown' | 'ready', metadata: any = {}) => {
  const emoji = EVENT_EMOJIS[status];
  const messages = {
    startup: 'Sistema iniciando...',
    shutdown: 'Sistema encerrando...',
    ready: 'Sistema pronto para uso!'
  };
  
  logger.info(`${emoji} ${messages[status]}`, {
    ...metadata,
    systemInfo: getSystemInfo()
  });
};

export default logger; 
import winston from 'winston';
import config from '../config';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Formato personalizado para logs
const customFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
  const stackString = stack ? `\n${stack}` : '';
  return `${timestamp} [${level}]: ${message}${stackString}${metaString ? `\n${metaString}` : ''}`;
});

// Configurar transports
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      errors({ stack: true }),
      customFormat
    )
  })
];

// Adicionar arquivo de log se especificado
if (config.logging.file) {
  transports.push(
    new winston.transports.File({
      filename: config.logging.file,
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        customFormat
      )
    })
  );
}

// Criar logger
const logger = winston.createLogger({
  level: config.logging.level,
  transports,
  exceptionHandlers: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        customFormat
      )
    })
  ],
  rejectionHandlers: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        customFormat
      )
    })
  ]
});

// Adicionar métodos de conveniência
export const logWebhook = (event: string, instanceName: string, data: any) => {
  logger.info('📨 Webhook recebido', {
    event,
    instanceName,
    dataKeys: Object.keys(data || {}),
    timestamp: new Date().toISOString()
  });
};

export const logMessage = (messageData: any) => {
  logger.info('💬 Mensagem processada', {
    id: messageData.id,
    from: messageData.from,
    type: messageData.messageType,
    timestamp: messageData.timestamp
  });
};

export const logError = (error: Error, context?: string) => {
  logger.error(`❌ Erro${context ? ` em ${context}` : ''}`, {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
};

export const logDatabase = (operation: string, table: string, result?: any) => {
  logger.debug('🗄️ Operação no banco', {
    operation,
    table,
    result: result ? 'sucesso' : 'falha',
    timestamp: new Date().toISOString()
  });
};

export const logQueue = (operation: string, queue: string, messageId?: string) => {
  logger.debug('📥 Operação na fila', {
    operation,
    queue,
    messageId,
    timestamp: new Date().toISOString()
  });
};

export default logger; 
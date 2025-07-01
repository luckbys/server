const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

// Configuração CORS
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS ? 
      process.env.ALLOWED_ORIGINS.split(',') : 
      ['http://localhost:3000'];
    
    // Permitir requests sem origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Não permitido pelo CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // máximo 100 requests por janela
  message: {
    error: 'Muitas requisições de seu IP, tente novamente mais tarde.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit excedido', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl
    });
    
    res.status(429).json({
      error: 'Muitas requisições de seu IP, tente novamente mais tarde.',
      retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
    });
  }
});

// Rate limiting específico para webhooks (mais permissivo)
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // limite de 100 requisições por minuto
  message: {
    success: false,
    message: 'Muitas requisições, tente novamente mais tarde',
    error: 'TOO_MANY_REQUESTS'
  }
});

// Middleware para verificar assinatura do webhook
const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers['x-hub-signature'];
  const webhookSecret = process.env.WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.warn('🔒 Webhook secret não configurado');
    return next();
  }

  if (!signature) {
    logger.warn('🔒 Assinatura do webhook não encontrada', { ip: req.ip });
    return res.status(401).json({
      success: false,
      message: 'Assinatura do webhook não encontrada',
      error: 'MISSING_SIGNATURE'
    });
  }

  const hmac = crypto.createHmac('sha1', webhookSecret);
  const calculatedSignature = `sha1=${hmac
    .update(JSON.stringify(req.body))
    .digest('hex')}`;

  if (signature !== calculatedSignature) {
    logger.warn('🔒 Assinatura do webhook inválida', {
      ip: req.ip,
      expectedSignature: calculatedSignature,
      receivedSignature: signature
    });
    return res.status(401).json({
      success: false,
      message: 'Assinatura do webhook inválida',
      error: 'INVALID_SIGNATURE'
    });
  }

  next();
};

// Middleware para adicionar requestId
const addRequestId = (req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('x-request-id', req.id);
  next();
};

// Middleware para logging de requisições
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Logging ao finalizar a requisição
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    };

    if (res.statusCode >= 400) {
      logger.warn('🌐 Requisição com erro', logData);
    } else {
      logger.http('🌐 Requisição processada', logData);
    }
  });

  next();
};

// Sanitização básica de entrada
function sanitizeInput(req, res, next) {
  if (req.body) {
    // Remove propriedades potencialmente perigosas
    delete req.body.__proto__;
    delete req.body.constructor;
    delete req.body.prototype;
  }
  next();
}

module.exports = {
  helmet: helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:", "ws:"]
      }
    }
  }),
  cors: cors(corsOptions),
  limiter,
  webhookLimiter,
  verifyWebhookSignature,
  addRequestId,
  requestLogger,
  sanitizeInput
}; 
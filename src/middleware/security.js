const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const logger = require('../config/logger');

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
  max: 1000, // máximo 1000 requests por minuto para webhooks
  message: {
    error: 'Rate limit de webhook excedido'
  },
  standardHeaders: false,
  legacyHeaders: false
});

// Middleware para verificar assinatura do webhook
function verifyWebhookSignature(req, res, next) {
  const signature = req.headers['x-signature'];
  const webhookSecret = process.env.WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    logger.warn('WEBHOOK_SECRET não configurado, pulando verificação de assinatura');
    return next();
  }
  
  if (!signature) {
    logger.warn('Webhook recebido sem assinatura', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    return res.status(401).json({ error: 'Assinatura obrigatória' });
  }
  
  try {
    const body = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');
    
    const providedSignature = signature.replace('sha256=', '');
    
    if (!crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    )) {
      logger.warn('Assinatura de webhook inválida', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        providedSignature: providedSignature.substring(0, 8) + '...'
      });
      return res.status(401).json({ error: 'Assinatura inválida' });
    }
    
    next();
  } catch (error) {
    logger.error('Erro ao verificar assinatura do webhook:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

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

// Middleware para log de requisições
function requestLogger(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };
    
    if (res.statusCode >= 400) {
      logger.warn('Request com erro', logData);
    } else {
      logger.info('Request processado', logData);
    }
  });
  
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
  sanitizeInput,
  requestLogger
}; 
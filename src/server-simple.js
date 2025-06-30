// Configurações básicas
process.env.NODE_ENV = 'development';
process.env.PORT = process.env.PORT || '3001';
process.env.WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'test_secret';
process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001';
process.env.WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || 'https://webhook.bkcrm.devsible.com.br';

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const logger = require('./config/logger-simple');
const webhookConfig = require('./config/webhook-simple');

// Criar servidor
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Middlewares
app.use(cors());
app.use(express.json());

// Rotas
const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Rotas da API
router.get('/', (req, res) => {
  res.json({
    status: 200,
    message: 'Welcome to the Evolution Webhook Server!',
    version: '2.0.0',
    documentation: 'https://doc.evolution-api.com',
    serverUrl: webhookConfig.baseUrl,
    capabilities: {
      webhooks: true,
      websocket: true,
      messageTypes: ['text', 'image', 'video', 'audio', 'document', 'location', 'contact', 'buttons', 'list'],
      integrations: ['typebot', 'chatwoot', 'rabbitmq', 'sqs', 'websocket']
    }
  });
});

// Webhook da Evolution API
router.post('/webhook/evolution/:instanceName', (req, res) => {
  const { instanceName } = req.params;
  const webhookData = req.body;
  
  logger.info('📨 Webhook recebido:', {
    instance: instanceName,
    event: webhookData.event,
    dataKeys: Object.keys(webhookData.data || {})
  });
  
  // Processar mensagem
  if (webhookData.event === 'messages.upsert' || webhookData.event === 'MESSAGES_UPSERT') {
    logger.info('💬 Processando mensagem...');
    const messages = Array.isArray(webhookData.data) ? webhookData.data : [webhookData.data];
    
    messages.forEach((msg, index) => {
      logger.info(`📝 Mensagem ${index + 1}:`, {
        id: msg.key?.id,
        from: msg.key?.remoteJid,
        pushName: msg.pushName,
        messageType: msg.message?.conversation ? 'conversation' : 
                    msg.message?.imageMessage ? 'imageMessage' :
                    msg.message?.videoMessage ? 'videoMessage' :
                    msg.message?.audioMessage ? 'audioMessage' :
                    msg.message?.documentMessage ? 'documentMessage' :
                    msg.message?.buttonsResponseMessage ? 'buttonsResponseMessage' :
                    msg.message?.listResponseMessage ? 'listResponseMessage' :
                    'other',
        timestamp: new Date(msg.messageTimestamp * 1000).toISOString()
      });
    });
  }
  
  // Emitir evento via WebSocket
  io.emit('webhook', {
    instanceName,
    event: webhookData.event,
    data: webhookData.data,
    timestamp: new Date().toISOString()
  });
  
  res.json({
    success: true,
    message: 'Webhook processado com sucesso',
    event: webhookData.event,
    instance: instanceName,
    timestamp: new Date().toISOString()
  });
});

// Buscar instâncias (simulado)
router.get('/instance/fetchInstances', (req, res) => {
  const { instanceName } = req.query;
  
  const mockInstances = [
    {
      instance: {
        instanceName: instanceName || 'test-evolution-instance',
        instanceId: 'mock-id-123',
        status: 'open',
        serverUrl: webhookConfig.baseUrl,
        apikey: 'mock-api-key',
        integration: {
          integration: 'WHATSAPP-BAILEYS',
          webhook_wa_business: webhookConfig.getWebhookUrl(instanceName || 'test-instance')
        }
      }
    }
  ];
  
  logger.info('📋 Buscando instâncias:', { instanceName });
  
  if (instanceName) {
    const filtered = mockInstances.filter(i => i.instance.instanceName === instanceName);
    res.json(filtered.length > 0 ? filtered : []);
  } else {
    res.json(mockInstances);
  }
});

// Montar rotas
app.use('/api', router);

// WebSocket
io.on('connection', (socket) => {
  logger.info('🔌 Cliente WebSocket conectado:', socket.id);
  
  socket.on('disconnect', () => {
    logger.info('🔌 Cliente WebSocket desconectado:', socket.id);
  });
});

// Exportar para testes
module.exports = server;

// Iniciar servidor se não estiver em teste
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 3001;
  
  server.listen(PORT, () => {
    logger.info('🚀 Servidor Evolution API iniciado');
    logger.info(`📡 Porta: ${PORT}`);
    logger.info('🌐 URLs:');
    logger.info(`  - API: ${webhookConfig.baseUrl}/api`);
    logger.info(`  - Health: ${webhookConfig.baseUrl}/api/health`);
    logger.info(`  - Webhook: ${webhookConfig.getWebhookUrl(':instanceName')}`);
    logger.info('');
    logger.info('📊 WebSocket disponível');
    logger.info('🔗 CORS configurado');
  });
} 
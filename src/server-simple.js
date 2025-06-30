// Configurações básicas
process.env.NODE_ENV = 'development';
process.env.PORT = process.env.PORT || '3001';
process.env.WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'test_secret';
process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001';
process.env.WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || 'http://localhost:3001';

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const logger = require('./config/logger-simple');

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
    serverUrl: process.env.WEBHOOK_BASE_URL,
    capabilities: {
      webhooks: true,
      websocket: true,
      messageTypes: ['text', 'image', 'video', 'audio', 'document', 'location', 'contact', 'buttons', 'list'],
      integrations: ['typebot', 'chatwoot', 'rabbitmq', 'sqs', 'websocket']
    }
  });
});

// Webhook genérico da Evolution API (para qualquer evento)
router.post('/:event', (req, res) => {
  const { event } = req.params;
  const webhookData = req.body;
  
  logger.info(`📨 Webhook ${event.toUpperCase()} recebido:`, {
    event,
    data: webhookData
  });
  
  // Emitir evento via WebSocket
  io.emit('webhook', {
    event,
    data: webhookData,
    timestamp: new Date().toISOString()
  });
  
  res.json({
    success: true,
    message: `Evento ${event} processado com sucesso`,
    timestamp: new Date().toISOString()
  });
});

// Webhook específico para mensagens
router.post('/webhook/evolution/:instanceName', (req, res) => {
  const { instanceName } = req.params;
  const webhookData = req.body;
  
  logger.info('📨 Webhook recebido:', {
    instance: instanceName,
    event: webhookData.event,
    dataKeys: Object.keys(webhookData.data || {})
  });
  
  // Processar e emitir eventos específicos para frontend
  const timestamp = new Date().toISOString();
  
  // Mensagens
  if (webhookData.event === 'messages.upsert' || webhookData.event === 'MESSAGES_UPSERT') {
    logger.info('💬 Processando mensagem...');
    const messages = Array.isArray(webhookData.data) ? webhookData.data : [webhookData.data];
    
    messages.forEach((msg, index) => {
      const messageData = {
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
        content: msg.message?.conversation || 
                 msg.message?.imageMessage?.caption ||
                 msg.message?.videoMessage?.caption ||
                 msg.message?.documentMessage?.title ||
                 'Mensagem de mídia',
        timestamp: new Date(msg.messageTimestamp * 1000).toISOString(),
        instance: instanceName
      };
      
      logger.info(`📝 Mensagem ${index + 1}:`, messageData);
      
      // Emitir evento específico para frontend
      io.emit('new-message', messageData);
    });
  }
  
  // Atualizações de conexão
  else if (webhookData.event === 'connection.update' || webhookData.event === 'CONNECTION_UPDATE') {
    const connectionData = {
      instance: instanceName,
      status: webhookData.data?.state || webhookData.data?.status,
      statusReason: webhookData.data?.statusReason,
      isNewLogin: webhookData.data?.isNewLogin,
      timestamp
    };
    
    logger.info('🔗 Processando atualização de conexão:', connectionData);
    io.emit('connection-update', connectionData);
  }
  
  // QR Code atualizado
  else if (webhookData.event === 'qr.updated' || webhookData.event === 'QRCODE_UPDATED') {
    const qrData = {
      instance: instanceName,
      qrCode: webhookData.data?.qrcode || webhookData.data?.qr,
      pairingCode: webhookData.data?.pairingCode,
      timestamp
    };
    
    logger.info('📱 Processando QR Code atualizado');
    io.emit('qr-updated', qrData);
  }
  
  // Startup da aplicação
  else if (webhookData.event === 'application.startup' || webhookData.event === 'APPLICATION_STARTUP') {
    const startupData = {
      instance: instanceName,
      status: 'started',
      timestamp
    };
    
    logger.info('🚀 Processando startup da aplicação');
    io.emit('application-startup', startupData);
  }
  
  // Eventos genéricos (contatos, chats, grupos, etc.)
  else {
    logger.info(`📨 Evento ${webhookData.event} processado (handler genérico)`);
    io.emit('generic-event', {
      instance: instanceName,
      event: webhookData.event,
      data: webhookData.data,
      timestamp
    });
  }
  
  // Emitir evento geral também (para compatibilidade)
  io.emit('webhook', {
    instanceName,
    event: webhookData.event,
    data: webhookData.data,
    timestamp
  });
  
  res.json({
    success: true,
    message: 'Webhook processado com sucesso',
    event: webhookData.event,
    instance: instanceName,
    timestamp
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
        serverUrl: process.env.WEBHOOK_BASE_URL,
        apikey: 'mock-api-key',
        integration: {
          integration: 'WHATSAPP-BAILEYS',
          webhook_wa_business: `${process.env.WEBHOOK_BASE_URL}/webhook/evolution/${instanceName || 'test-instance'}`
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

// Estatísticas do servidor
router.get('/stats', (req, res) => {
  res.json({
    success: true,
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      platform: process.platform
    },
    websocket: {
      connectedClients: io.engine.clientsCount,
      rooms: Object.keys(io.sockets.adapter.rooms).length
    },
    webhook: {
      totalReceived: global.webhookStats?.total || 0,
      lastReceived: global.webhookStats?.lastReceived || null
    },
    timestamp: new Date().toISOString()
  });
});

// Enviar mensagem (endpoint para frontend)
router.post('/send-message', (req, res) => {
  const { instance, to, message, type = 'text' } = req.body;
  
  if (!instance || !to || !message) {
    return res.status(400).json({
      success: false,
      error: 'Parâmetros obrigatórios: instance, to, message'
    });
  }
  
  // Simular envio de mensagem
  logger.info('📤 Solicitação de envio de mensagem:', {
    instance,
    to,
    messageType: type,
    messageLength: message.length
  });
  
  // Emitir evento para WebSocket (simulação)
  io.emit('message-sent', {
    instance,
    to,
    message,
    type,
    timestamp: new Date().toISOString(),
    status: 'sent'
  });
  
  res.json({
    success: true,
    message: 'Mensagem enviada com sucesso',
    messageId: `msg_${Date.now()}`,
    timestamp: new Date().toISOString()
  });
});

// Buscar mensagens (endpoint para frontend)
router.get('/messages/:instanceName', (req, res) => {
  const { instanceName } = req.params;
  const { limit = 50, offset = 0 } = req.query;
  
  // Simular busca de mensagens
  const mockMessages = Array.from({ length: limit }, (_, i) => ({
    id: `msg_${Date.now()}_${i}`,
    instance: instanceName,
    from: '5511999999999@s.whatsapp.net',
    pushName: `Contato ${i + 1}`,
    content: `Mensagem de exemplo ${i + 1}`,
    messageType: 'conversation',
    timestamp: new Date(Date.now() - (i * 60000)).toISOString(),
    direction: i % 2 === 0 ? 'incoming' : 'outgoing'
  }));
  
  logger.info('📋 Buscando mensagens:', { 
    instance: instanceName, 
    limit: Number(limit), 
    offset: Number(offset) 
  });
  
  res.json({
    success: true,
    messages: mockMessages,
    pagination: {
      limit: Number(limit),
      offset: Number(offset),
      total: 1000,
      hasMore: Number(offset) + Number(limit) < 1000
    },
    timestamp: new Date().toISOString()
  });
});

// Montar rotas
app.use('/api', router);

// WebSocket
io.on('connection', (socket) => {
  logger.info('🔌 Cliente WebSocket conectado:', socket.id);
  
  // Enviar status inicial ao conectar
  socket.emit('server-status', {
    status: 'connected',
    serverTime: new Date().toISOString(),
    uptime: process.uptime(),
    version: '2.0.0'
  });
  
  // Escutar eventos do frontend
  socket.on('join-instance', (instanceName) => {
    socket.join(`instance-${instanceName}`);
    logger.info(`🔌 Cliente ${socket.id} entrou na sala: instance-${instanceName}`);
    
    socket.emit('joined-instance', {
      instance: instanceName,
      timestamp: new Date().toISOString()
    });
  });
  
  socket.on('leave-instance', (instanceName) => {
    socket.leave(`instance-${instanceName}`);
    logger.info(`🔌 Cliente ${socket.id} saiu da sala: instance-${instanceName}`);
  });
  
  // Ping-pong para manter conexão
  socket.on('ping', () => {
    socket.emit('pong', {
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });
  
  // Solicitação de status de instância
  socket.on('get-instance-status', (instanceName) => {
    socket.emit('instance-status', {
      instance: instanceName,
      status: 'connected', // Simulado
      lastActivity: new Date().toISOString(),
      qrCodeRequired: false
    });
  });
  
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
    logger.info(`  - API: ${process.env.WEBHOOK_BASE_URL}/api`);
    logger.info(`  - Health: ${process.env.WEBHOOK_BASE_URL}/api/health`);
    logger.info(`  - Webhook Genérico: ${process.env.WEBHOOK_BASE_URL}/api/:event`);
    logger.info(`  - Webhook Mensagens: ${process.env.WEBHOOK_BASE_URL}/api/webhook/evolution/:instanceName`);
    logger.info('');
    logger.info('📊 WebSocket disponível');
    logger.info('🔗 CORS configurado');
  });
} 
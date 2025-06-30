const express = require('express');
const router = express.Router();

// Controllers
const webhookController = require('../controllers/webhookController');
const instanceController = require('../controllers/instanceController');
const messageController = require('../controllers/messageController');
const statsController = require('../controllers/statsController');

// Middlewares
const { webhookLimiter, verifyWebhookSignature } = require('../middleware/security');

// === ROUTES COMPATÍVEIS COM EVOLUTION API ===

// Informações da API (compatível com Evolution API)
router.get('/', (req, res) => {
  res.json({
    status: 200,
    message: 'Welcome to the Evolution Webhook Server, it is working!',
    version: '2.0.0',
    documentation: 'https://doc.evolution-api.com',
    swagger: `${req.protocol}://${req.get('host')}/api/docs`,
    manager: `${req.protocol}://${req.get('host')}/api/manager`,
    serverUrl: `${req.protocol}://${req.get('host')}`,
    capabilities: {
      webhooks: true,
      websocket: true,
      messageTypes: ['text', 'image', 'video', 'audio', 'document', 'location', 'contact', 'buttons', 'list'],
      integrations: ['typebot', 'chatwoot', 'rabbitmq', 'sqs', 'websocket'],
      events: [
        'APPLICATION_STARTUP', 'QRCODE_UPDATED', 'MESSAGES_SET', 'MESSAGES_UPSERT', 
        'MESSAGES_UPDATE', 'MESSAGES_DELETE', 'SEND_MESSAGE', 'CONTACTS_SET', 
        'CONTACTS_UPSERT', 'CONTACTS_UPDATE', 'PRESENCE_UPDATE', 'CHATS_SET', 
        'CHATS_UPSERT', 'CHATS_UPDATE', 'CHATS_DELETE', 'GROUPS_UPSERT', 
        'GROUP_UPDATE', 'GROUP_PARTICIPANTS_UPDATE', 'CONNECTION_UPDATE', 'CALL'
      ]
    }
  });
});

// === ROUTES DE INSTÂNCIA (EVOLUTION API COMPATIBLE) ===

// Criar instância
router.post('/instance/create', instanceController.createInstance);

// Conectar instância
router.get('/instance/connect/:instanceName', instanceController.connectInstance);

// Buscar instâncias
router.get('/instance/fetchInstances', instanceController.fetchInstances);

// Status da instância
router.get('/instance/connectionState/:instanceName', instanceController.getConnectionState);

// Deletar instância
router.delete('/instance/delete/:instanceName', instanceController.deleteInstance);

// Logout/Desconectar instância
router.delete('/instance/logout/:instanceName', instanceController.logoutInstance);

// Reiniciar instância
router.put('/instance/restart/:instanceName', instanceController.restartInstance);

// === ROUTES DE WEBHOOK (EVOLUTION API COMPATIBLE) ===

// Configurar webhook
router.post('/webhook/set/:instanceName', instanceController.setWebhook);

// Buscar webhook
router.get('/webhook/find/:instanceName', instanceController.getWebhook);

// Processar webhook da Evolution API
router.post('/webhook/evolution/:instanceName', 
  webhookLimiter,
  express.json({ limit: '50mb' }),
  verifyWebhookSignature,
  (req, res, next) => {
    // Adicionar referência do app ao req para acesso ao WebSocket
    req.app = req.app || res.app;
    next();
  },
  webhookController.processWebhook
);

// === ROUTES DE CONFIGURAÇÕES (EVOLUTION API COMPATIBLE) ===

// Configurar settings da instância
router.post('/settings/set/:instanceName', instanceController.setSettings);

// Buscar settings da instância
router.get('/settings/find/:instanceName', instanceController.getSettings);

// === ROUTES DE MENSAGEM (EVOLUTION API COMPATIBLE) ===

// Enviar mensagem de texto
router.post('/message/sendText/:instanceName', messageController.sendTextMessage);

// Enviar mídia
router.post('/message/sendMedia/:instanceName', messageController.sendMediaMessage);

// Enviar áudio
router.post('/message/sendWhatsAppAudio/:instanceName', messageController.sendAudioMessage);

// Enviar localização
router.post('/message/sendLocation/:instanceName', messageController.sendLocationMessage);

// Enviar contato
router.post('/message/sendContact/:instanceName', messageController.sendContactMessage);

// Enviar botões
router.post('/message/sendButtons/:instanceName', messageController.sendButtonsMessage);

// Enviar lista
router.post('/message/sendList/:instanceName', messageController.sendListMessage);

// === ROUTES DE CHAT (EVOLUTION API COMPATIBLE) ===

// Marcar mensagem como lida
router.put('/chat/markMessageAsRead/:instanceName', messageController.markAsRead);

// Definir presença
router.put('/chat/presence/:instanceName', messageController.setPresence);

// Verificar números WhatsApp
router.post('/chat/whatsappNumbers/:instanceName', messageController.checkWhatsAppNumbers);

// Buscar mensagens
router.get('/chat/findMessages/:instanceName', messageController.findMessages);

// === ROUTES DE GRUPO (EVOLUTION API COMPATIBLE) ===

// Criar grupo
router.post('/group/create/:instanceName', messageController.createGroup);

// Atualizar grupo
router.put('/group/updateGroupInfo/:instanceName', messageController.updateGroup);

// Adicionar participantes
router.put('/group/participants/:instanceName', messageController.updateGroupParticipants);

// Sair do grupo
router.delete('/group/leaveGroup/:instanceName', messageController.leaveGroup);

// === ROUTES DE PERFIL (EVOLUTION API COMPATIBLE) ===

// Buscar perfil
router.get('/chat/findProfile/:instanceName', messageController.findProfile);

// Atualizar perfil
router.put('/chat/updateProfileName/:instanceName', messageController.updateProfileName);

// Atualizar status
router.put('/chat/updateProfileStatus/:instanceName', messageController.updateProfileStatus);

// Atualizar foto do perfil
router.put('/chat/updateProfilePicture/:instanceName', messageController.updateProfilePicture);

// === ROUTES INTERNAS DO SERVIDOR ===

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Estatísticas gerais
router.get('/stats', statsController.getGeneralStats);

// Estatísticas de dashboard
router.get('/stats/dashboard', statsController.getDashboardStats);

// Estatísticas de performance
router.get('/stats/performance', statsController.getPerformanceStats);

// === ROUTES DE GERENCIAMENTO ===

// Listar instâncias internas
router.get('/instances', instanceController.listInstances);

// Criar instância interna
router.post('/instances', instanceController.createInternalInstance);

// Atualizar instância interna
router.put('/instances/:id', instanceController.updateInstance);

// Deletar instância interna
router.delete('/instances/:id', instanceController.deleteInternalInstance);

// Status da instância interna
router.get('/instances/:id/status', instanceController.getInstanceStatus);

// QR Code da instância
router.get('/instances/:id/qrcode', instanceController.getQRCode);

// === ROUTES DE MENSAGENS INTERNAS ===

// Enviar mensagem (endpoint interno)
router.post('/send-message', messageController.sendMessage);

// Mensagens do ticket
router.get('/messages/ticket/:ticketId', messageController.getTicketMessages);

// Marcar mensagem como lida (interno)
router.put('/messages/:messageId/read', messageController.markMessageAsRead);

// === ROUTES DE INTEGRAÇÃO ===

// Typebot
router.post('/typebot/start/:instanceName', instanceController.startTypebot);
router.post('/typebot/changeStatus/:instanceName', instanceController.changeTypebotStatus);

// Chatwoot
router.post('/chatwoot/setup/:instanceName', instanceController.setupChatwoot);
router.get('/chatwoot/status/:instanceName', instanceController.getChatwootStatus);

// RabbitMQ
router.post('/rabbitmq/setup/:instanceName', instanceController.setupRabbitMQ);

// SQS
router.post('/sqs/setup/:instanceName', instanceController.setupSQS);

// WebSocket
router.post('/websocket/setup/:instanceName', instanceController.setupWebSocket);

// === ROUTES DE MONITORAMENTO ===

// Logs da instância
router.get('/logs/:instanceName', statsController.getInstanceLogs);

// Métricas da instância
router.get('/metrics/:instanceName', statsController.getInstanceMetrics);

// Status geral do servidor
router.get('/server/status', statsController.getServerStatus);

// === ROUTES DE UTILIDADES ===

// Validar número WhatsApp
router.post('/utils/validate-number', messageController.validateWhatsAppNumber);

// Download de mídia
router.get('/media/download/:mediaId', messageController.downloadMedia);

// Upload de mídia
router.post('/media/upload', messageController.uploadMedia);

// Gerar QR Code
router.get('/utils/qrcode/:instanceName', instanceController.generateQRCode);

// === MIDDLEWARE DE ERRO ===
router.use((err, req, res, next) => {
  console.error('Erro na rota:', err);
  res.status(500).json({
    success: false,
    error: 'Erro interno do servidor',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// === ROTA 404 ===
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint não encontrado',
    method: req.method,
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
    availableEndpoints: {
      instances: 'GET /api/instance/fetchInstances',
      createInstance: 'POST /api/instance/create',
      sendMessage: 'POST /api/message/sendText/:instanceName',
      webhook: 'POST /api/webhook/evolution/:instanceName',
      health: 'GET /api/health',
      docs: 'GET /api/'
    }
  });
});

module.exports = router; 
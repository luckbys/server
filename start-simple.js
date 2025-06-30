// Script simples para testar o servidor sem dependências externas
process.env.NODE_ENV = 'development';
process.env.PORT = '3001';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test_key';
process.env.WEBHOOK_SECRET = 'test_secret';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000,http://localhost:3001';
process.env.WEBHOOK_BASE_URL = 'https://webhook.bkcrm.devsible.com.br';

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const webhookConfig = require('./src/config/webhook');

console.log('🚀 Iniciando servidor simples...');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Middlewares básicos
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// === ROTAS COMPATÍVEIS COM EVOLUTION API ===

// Rota raiz (compatível com Evolution API)
app.get('/api/', (req, res) => {
  res.json({
    status: 200,
    message: 'Welcome to the Evolution Webhook Server, it is working!',
    version: '2.0.0',
    documentation: 'https://doc.evolution-api.com',
    swagger: `${req.protocol}://${req.get('host')}/api/docs`,
    manager: `${req.protocol}://${req.get('host')}/api/manager`,
    serverUrl: webhookConfig.baseUrl,
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
        'GROUP_UPDATE', 'GROUP_PARTICIPANTS_UPDATE', 'CONNECTION_UPDATE', 'CALL',
        'NEW_JWT_TOKEN', 'TYPEBOT_START', 'TYPEBOT_CHANGE_STATUS'
      ]
    }
  });
});

// Webhook da Evolution API
app.post('/api/webhook/evolution/:instanceName', (req, res) => {
  const { instanceName } = req.params;
  const webhookData = req.body;
  
  console.log('📨 Webhook recebido de', instanceName + ':', {
    event: webhookData.event,
    dataKeys: Object.keys(webhookData.data || {})
  });
  
  // Processar mensagem
  if (webhookData.event === 'messages.upsert' || webhookData.event === 'MESSAGES_UPSERT') {
    console.log('💬 Processando mensagem...');
    const messages = Array.isArray(webhookData.data) ? webhookData.data : [webhookData.data];
    
    messages.forEach((msg, index) => {
      console.log(`  📝 Mensagem ${index + 1}:`, {
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
  
  // Processar atualização de conexão
  else if (webhookData.event === 'CONNECTION_UPDATE') {
    console.log('🔗 Processando atualização de conexão...');
    console.log('  📊 Estado:', webhookData.data.state);
    console.log('  📊 Status:', webhookData.data.statusReason);
  }
  
  // Processar QR Code
  else if (webhookData.event === 'QRCODE_UPDATED') {
    console.log('📱 Processando QR Code atualizado...');
    console.log('  📊 QR Code:', webhookData.data.qrcode ? 'Presente' : 'Ausente');
    console.log('  📊 Pairing Code:', webhookData.data.pairingCode);
  }
  
  // Processar startup da aplicação
  else if (webhookData.event === 'APPLICATION_STARTUP') {
    console.log('🚀 Processando startup da aplicação...');
  }
  
  // Outros eventos
  else {
    console.log(`📨 Evento ${webhookData.event} processado (handler genérico)`);
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
app.get('/api/instance/fetchInstances', (req, res) => {
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
  
  console.log('📋 Buscando instâncias:', { instanceName });
  
  if (instanceName) {
    const filtered = mockInstances.filter(i => i.instance.instanceName === instanceName);
    res.json(filtered.length > 0 ? filtered : []);
  } else {
    res.json(mockInstances);
  }
});

// WebSocket
io.on('connection', (socket) => {
  console.log('🔌 Cliente WebSocket conectado:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('🔌 Cliente WebSocket desconectado:', socket.id);
  });
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log('🚀 Iniciando servidor Evolution API compatível...');
  console.log('🎉 Servidor rodando com sucesso!');
  console.log(`📡 Porta: ${PORT}`);
  console.log('🌐 URLs:');
  console.log(`  - API Info: ${webhookConfig.baseUrl}/api/`);
  console.log(`  - Health: ${webhookConfig.baseUrl}/api/health`);
  console.log(`  - Stats: ${webhookConfig.baseUrl}/api/stats`);
  console.log(`  - Instances: ${webhookConfig.baseUrl}/api/instance/fetchInstances`);
  console.log(`  - Webhook: ${webhookConfig.baseUrl}/api/webhook/evolution/:instanceName`);
  console.log('');
  console.log('📊 WebSocket disponível');
  console.log('🔗 CORS configurado para localhost');
  console.log('🚀 Compatível com Evolution API oficial!');
  console.log('');
  console.log('💡 Execute: node test-evolution-compatibility.js para testar');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor encerrado com sucesso');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Encerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor encerrado com sucesso');
    process.exit(0);
  });
}); 
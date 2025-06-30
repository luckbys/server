const axios = require('axios');
const webhookConfig = require('./src/config/webhook');

const WEBHOOK_URL = webhookConfig.getWebhookUrl('test-instance');

// Simular webhook de mensagem
const messageWebhook = {
  event: 'messages.upsert',
  data: [{
    key: {
      remoteJid: '5511999999999@s.whatsapp.net',
      fromMe: false,
      id: 'msg_123456'
    },
    messageTimestamp: Math.floor(Date.now() / 1000),
    pushName: 'João Silva',
    message: {
      conversation: 'Olá! Preciso de ajuda com meu pedido.'
    }
  }]
};

async function testWebhook() {
  console.log('🕸️  Testando Webhook da Evolution API...\n');
  console.log(`📡 URL do Webhook: ${WEBHOOK_URL}\n`);
  
  try {
    console.log('📨 Enviando webhook de mensagem...');
    
    const response = await axios.post(WEBHOOK_URL, messageWebhook, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`✅ Webhook enviado com sucesso: ${response.status}`);
    console.log('📄 Resposta:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
  }
}

testWebhook(); 
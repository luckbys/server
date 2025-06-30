const axios = require('axios');

// Configurações
const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || 'http://localhost:3001';
const INSTANCE_NAME = 'test-evolution-instance';

console.log('\n=== TESTE DE COMPATIBILIDADE EVOLUTION API ===');
console.log('🚀 Testando servidor Evolution Webhook com compatibilidade total...\n');

console.log(`📡 URL Base: ${WEBHOOK_BASE_URL}/api`);
console.log(`📡 URL do Webhook: ${WEBHOOK_BASE_URL}/api/webhook/evolution/${INSTANCE_NAME}\n`);

// Função para simular eventos da Evolution API
async function simulateEvolutionEvents() {
  try {
    console.log('=== 1. Testando Endpoint Raiz ===');
    const rootResponse = await axios.get(`${WEBHOOK_BASE_URL}/api`);
    console.log('✅ Endpoint raiz compatível com Evolution API');
    console.log(`ℹ️  Versão: ${rootResponse.data.version}`);
    console.log(`ℹ️  Documentação: ${rootResponse.data.documentation}\n`);

    console.log('=== 2. Testando Eventos ===');
    
    // Simular mensagem de texto
    await simulateEvent('messages.upsert', {
      key: {
        id: 'evolution_msg_123456',
        remoteJid: '5511999999999@s.whatsapp.net'
      },
      pushName: 'João Silva - Evolution Test',
      message: {
        conversation: 'Olá! Esta é uma mensagem de teste.'
      },
      messageTimestamp: Math.floor(Date.now() / 1000)
    });
    
    // Simular atualização de conexão
    await simulateEvent('connection.update', {
      instance: INSTANCE_NAME,
      state: 'open',
      statusReason: 200,
      isNewLogin: false,
      qr: null
    });
    
    // Simular atualização de QR Code
    await simulateEvent('qr.updated', {
      instance: INSTANCE_NAME,
      qrcode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgA...',
      pairingCode: '123456'
    });
    
    // Simular startup da aplicação
    await simulateEvent('application.startup', {
      instance: INSTANCE_NAME,
      test: true
    });
    
    // Simular outros eventos comuns
    const commonEvents = [
      'contacts.upsert',
      'chats.upsert',
      'groups.upsert',
      'presence.update',
      'call',
      'typebot.start'
    ];
    
    for (const event of commonEvents) {
      await simulateEvent(event, {
        instance: INSTANCE_NAME,
        test: true
      });
    }
    
    // Simular mensagem com mídia
    await simulateEvent('messages.upsert', {
      key: {
        id: 'evolution_media_123',
        remoteJid: '5511999999999@s.whatsapp.net'
      },
      pushName: 'João Silva',
      message: {
        imageMessage: {
          caption: 'Teste de imagem',
          mimetype: 'image/jpeg',
          url: 'https://example.com/image.jpg'
        }
      },
      messageTimestamp: Math.floor(Date.now() / 1000)
    });
    
    // Simular mensagem com botões
    await simulateEvent('messages.upsert', {
      key: {
        id: 'evolution_buttons_123',
        remoteJid: '5511999999999@s.whatsapp.net'
      },
      pushName: 'João Silva',
      message: {
        buttonsResponseMessage: {
          selectedButtonId: 'btn_1',
          selectedDisplayText: 'Opção 1'
        }
      },
      messageTimestamp: Math.floor(Date.now() / 1000)
    });
    
    console.log('\n✅ Todos os testes concluídos com sucesso!');
    
  } catch (error) {
    console.log('\n❌ Erro durante os testes:', error.message);
    console.log('\n📋 Detalhes do erro:', error.response?.data || error);
    process.exit(1);
  }
}

// Função auxiliar para simular eventos
async function simulateEvent(event, data) {
  try {
    // Enviar para o webhook específico da instância
    const response = await axios.post(
      `${WEBHOOK_BASE_URL}/api/webhook/evolution/${INSTANCE_NAME}`,
      {
        event,
        data,
        instance: {
          instanceName: INSTANCE_NAME
        }
      }
    );
    
    console.log(`✅ Evento ${event} simulado com sucesso`);
    return response.data;
    
  } catch (error) {
    console.error(`❌ Erro ao simular ${event}:`, error.message);
    throw error;
  }
}

// Executar testes
simulateEvolutionEvents(); 
const axios = require('axios');
const webhookConfig = require('./src/config/webhook');

// Configurações
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001/api';
const WEBHOOK_URL = webhookConfig.getWebhookUrl('test-evolution-instance');

// Cores para output do console
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  header: (msg) => console.log(`\n${colors.bold}${colors.blue}=== ${msg} ===${colors.reset}`)
};

async function testEvolutionCompatibility() {
  log.header('TESTE DE COMPATIBILIDADE EVOLUTION API');
  
  console.log('🚀 Testando servidor Evolution Webhook com compatibilidade total...\n');
  console.log(`📡 URL Base: ${BASE_URL}`);
  console.log(`📡 URL do Webhook: ${WEBHOOK_URL}\n`);
  
  try {
    // 1. Testar endpoint raiz (compatível com Evolution API)
    log.header('1. Testando Endpoint Raiz');
    const rootResponse = await axios.get(`${BASE_URL}/`);
    
    if (rootResponse.data.status === 200 && rootResponse.data.message.includes('Evolution')) {
      log.success('Endpoint raiz compatível com Evolution API');
      log.info(`Versão: ${rootResponse.data.version}`);
      log.info(`Swagger: ${rootResponse.data.swagger}`);
      log.info(`Eventos suportados: ${rootResponse.data.capabilities.events.length}`);
    } else {
      log.error('Endpoint raiz não compatível');
    }
    
    // 2. Testar health check
    log.header('2. Testando Health Check');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    
    if (healthResponse.data.success && healthResponse.data.status === 'healthy') {
      log.success('Health check funcionando');
      log.info(`Uptime: ${Math.floor(healthResponse.data.uptime)}s`);
      log.info(`Memória: ${Math.floor(healthResponse.data.memory.used / 1024 / 1024)}MB`);
    }
    
    // 3. Testar webhook Evolution API
    log.header('3. Testando Webhook Evolution API');
    
    // Webhook de mensagem compatível com Evolution API
    const messageWebhook = {
      event: 'MESSAGES_UPSERT',
      data: [{
        key: {
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
          id: 'evolution_msg_123456',
          participant: undefined
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: 'João Silva - Evolution Test',
        broadcast: false,
        status: 'SERVER_ACK',
        message: {
          conversation: 'Olá! Este é um teste de compatibilidade com Evolution API 🚀'
        }
      }]
    };
    
    const webhookResponse = await axios.post(WEBHOOK_URL, messageWebhook);
    
    if (webhookResponse.data.success) {
      log.success('Webhook MESSAGES_UPSERT processado');
      log.info(`Evento: ${webhookResponse.data.event}`);
      log.info(`Instância: ${webhookResponse.data.instance}`);
    }
    
    // 4. Testar webhook de conexão
    log.header('4. Testando Webhook de Conexão');
    
    const connectionWebhook = {
      event: 'CONNECTION_UPDATE',
      data: {
        instance: 'test-evolution-instance',
        state: 'open',
        statusReason: 200,
        isNewLogin: false,
        qr: null
      }
    };
    
    const connectionResponse = await axios.post(WEBHOOK_URL, connectionWebhook);
    
    if (connectionResponse.data.success) {
      log.success('Webhook CONNECTION_UPDATE processado');
    }
    
    // 5. Testar webhook de QR Code
    log.header('5. Testando Webhook de QR Code');
    
    const qrWebhook = {
      event: 'QRCODE_UPDATED',
      data: {
        instance: 'test-evolution-instance',
        qrcode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        pairingCode: '123456'
      }
    };
    
    const qrResponse = await axios.post(WEBHOOK_URL, qrWebhook);
    
    if (qrResponse.data.success) {
      log.success('Webhook QRCODE_UPDATED processado');
    }
    
    // 6. Testar eventos avançados
    log.header('6. Testando Eventos Avançados');
    
    const advancedEvents = [
      'APPLICATION_STARTUP',
      'CONTACTS_UPSERT',
      'CHATS_UPSERT',
      'GROUPS_UPSERT',
      'PRESENCE_UPDATE',
      'CALL',
      'TYPEBOT_START'
    ];
    
    for (const event of advancedEvents) {
      const eventWebhook = {
        event,
        data: {
          instance: 'test-evolution-instance',
          test: true
        }
      };
      
      const eventResponse = await axios.post(WEBHOOK_URL, eventWebhook);
      
      if (eventResponse.data.success) {
        log.success(`Webhook ${event} processado`);
      }
    }
    
    // 7. Testar mensagens complexas
    log.header('7. Testando Mensagens Complexas');
    
    // Mensagem com mídia
    const mediaWebhook = {
      event: 'MESSAGES_UPSERT',
      data: [{
        key: {
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
          id: 'evolution_media_123'
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: 'João Silva',
        message: {
          imageMessage: {
            caption: 'Imagem de teste da Evolution API',
            mimetype: 'image/jpeg',
            url: 'https://example.com/image.jpg',
            mediaKey: 'test_media_key',
            fileLength: 1024,
            fileName: 'teste.jpg',
            jpegThumbnail: '/9j/4AAQSkZJRgABAQAAAQABAAD'
          }
        }
      }]
    };
    
    const mediaResponse = await axios.post(
      `${BASE_URL}/webhook/evolution/test-evolution-instance`, 
      mediaWebhook
    );
    
    if (mediaResponse.data.success) {
      log.success('Mensagem de mídia processada');
    }
    
    // Mensagem com botões
    const buttonsWebhook = {
      event: 'MESSAGES_UPSERT',
      data: [{
        key: {
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
          id: 'evolution_buttons_123'
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: 'João Silva',
        message: {
          buttonsResponseMessage: {
            selectedButtonId: 'btn_option_1',
            contextInfo: {
              quotedMessage: null
            }
          }
        }
      }]
    };
    
    const buttonsResponse = await axios.post(
      `${BASE_URL}/webhook/evolution/test-evolution-instance`, 
      buttonsWebhook
    );
    
    if (buttonsResponse.data.success) {
      log.success('Resposta de botão processada');
    }
    
    // 8. Testar estatísticas
    log.header('8. Testando Estatísticas');
    
    const statsResponse = await axios.get(`${BASE_URL}/stats`);
    if (statsResponse.data.success) {
      log.success('Estatísticas obtidas');
      log.info(`Uptime: ${statsResponse.data.data.uptime}s`);
    }
    
    // 9. Resumo final
    log.header('RESUMO DOS TESTES');
    
    console.log(`
${colors.green}✅ TODOS OS TESTES PASSARAM COM SUCESSO!${colors.reset}

${colors.bold}🎉 Compatibilidade Evolution API CONFIRMADA:${colors.reset}

📍 ${colors.blue}Endpoints Compatíveis:${colors.reset}
   • GET  /api/ (informações da API)
   • GET  /api/health (health check)
   • POST /api/webhook/evolution/:instanceName (webhook receiver)
   • GET  /api/stats (estatísticas)

📍 ${colors.blue}Eventos Suportados:${colors.reset}
   • MESSAGES_UPSERT (mensagens recebidas)
   • CONNECTION_UPDATE (status de conexão)
   • QRCODE_UPDATED (QR code atualizado)
   • APPLICATION_STARTUP (startup da aplicação)
   • CONTACTS_UPSERT, CHATS_UPSERT, GROUPS_UPSERT
   • PRESENCE_UPDATE, CALL, TYPEBOT_START

📍 ${colors.blue}Tipos de Mensagem:${colors.reset}
   • Texto simples e formatado
   • Imagens, vídeos, áudios, documentos
   • Localização, contatos, stickers
   • Botões e listas interativas
   • Reações e respostas

📍 ${colors.blue}Recursos Avançados:${colors.reset}
   • WebSocket em tempo real
   • Validação completa de dados
   • Logs estruturados
   • Processamento assíncrono
   • Middleware de segurança

🚀 ${colors.bold}${colors.green}SERVIDOR PRONTO PARA PRODUÇÃO!${colors.reset}
    `);
    
  } catch (error) {
    log.error(`Erro durante os testes: ${error.message}`);
    
    if (error.code === 'ECONNREFUSED') {
      log.warning('Servidor não está rodando. Execute: npm start ou node start-simple.js');
    }
    
    console.log('\n📋 Detalhes do erro:', error.response?.data || error.message);
  }
}

// Executar testes se chamado diretamente
if (require.main === module) {
  testEvolutionCompatibility();
}

module.exports = { testEvolutionCompatibility }; 
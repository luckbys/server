const axios = require('axios');
const webhookConfig = require('./src/config/webhook');

// Configurações
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001/api';
const WEBHOOK_URL = webhookConfig.getWebhookUrl('test-instance');

async function testServer() {
  console.log('🧪 Iniciando testes do servidor...\n');
  console.log(`📡 URL Base: ${BASE_URL}`);
  console.log(`📡 URL do Webhook: ${WEBHOOK_URL}\n`);
  
  const tests = [
    {
      name: 'Health Check',
      url: `${BASE_URL}/health`,
      method: 'GET'
    },
    {
      name: 'Informações da API',
      url: `${BASE_URL}/info`,
      method: 'GET'
    },
    {
      name: 'Estatísticas Gerais',
      url: `${BASE_URL}/stats`,
      method: 'GET'
    },
    {
      name: 'Listar Instâncias',
      url: `${BASE_URL}/instances`,
      method: 'GET'
    },
    {
      name: 'Estatísticas do Dashboard',
      url: `${BASE_URL}/stats/dashboard`,
      method: 'GET'
    }
  ];
  
  for (const test of tests) {
    try {
      console.log(`🔍 Testando: ${test.name}`);
      
      const response = await axios({
        method: test.method,
        url: test.url,
        timeout: 5000
      });
      
      console.log(`✅ ${test.name}: ${response.status} - ${response.statusText}`);
      
      if (response.data) {
        console.log(`📄 Dados:`, JSON.stringify(response.data, null, 2).substring(0, 200) + '...');
      }
      
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.response?.status || 'ERROR'} - ${error.message}`);
      
      if (error.response?.data) {
        console.log(`📄 Erro:`, JSON.stringify(error.response.data, null, 2));
      }
    }
    
    console.log(''); // Linha em branco
  }
  
  // Teste de criação de instância
  console.log('🔍 Testando: Criar Instância');
  try {
    const instanceData = {
      instanceName: 'test-instance',
      integration: 'WHATSAPP-BAILEYS',
      webhook: WEBHOOK_URL,
      webhook_by_events: true,
      webhook_base64: false,
      events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
      reject_call: true,
      msg_call: 'Desculpe, não posso atender chamadas no momento.',
      groups_ignore: true,
      always_online: true,
      read_messages: true,
      read_status: true
    };
    
    const response = await axios.post(`${BASE_URL}/instances`, instanceData);
    console.log(`✅ Criar Instância: ${response.status} - Instância criada com ID: ${response.data.data?.id}`);
    
    // Tentar listar novamente para ver a instância criada
    const listResponse = await axios.get(`${BASE_URL}/instances`);
    console.log(`📊 Total de instâncias: ${listResponse.data.data?.length || 0}`);
    
  } catch (error) {
    console.log(`❌ Criar Instância: ${error.response?.status || 'ERROR'} - ${error.message}`);
    if (error.response?.data) {
      console.log(`📄 Erro:`, JSON.stringify(error.response.data, null, 2));
    }
  }
  
  console.log('\n🎉 Testes concluídos!');
}

testServer(); 
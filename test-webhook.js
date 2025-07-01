require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const messageId = `TEST_${Date.now()}`;
const timestamp = Math.floor(Date.now() / 1000);
const phone = '5511999999999';
const instanceName = 'test-instance';

const webhookData = {
  event: 'MESSAGES_UPSERT',
  instance: instanceName,
  data: [{
    key: {
      remoteJid: `${phone}@s.whatsapp.net`,
      fromMe: false,
      id: messageId,
      participant: null
    },
    messageTimestamp: timestamp,
    pushName: 'Teste Webhook',
    message: {
      conversation: 'Mensagem de teste via webhook'
    },
    broadcast: false,
    status: 'PENDING'
  }]
};

// Gerar assinatura do webhook
function generateSignature(data, secret) {
  const hmac = crypto.createHmac('sha1', secret);
  return `sha1=${hmac.update(JSON.stringify(data)).digest('hex')}`;
}

async function checkMessages(supabase, retries = 5) {
  for (let i = 0; i < retries; i++) {
    console.log(`\n🔍 Verificando mensagens (tentativa ${i + 1}/${retries})...`);

    const { data: recentMessages, error: recentError } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentError) {
      console.error('❌ Erro ao consultar mensagens:', recentError.message);
      continue;
    }

    if (recentMessages && recentMessages.length > 0) {
      console.log('\n✅ Mensagens encontradas:');
      recentMessages.forEach(msg => {
        console.log('\n📝 Mensagem:', {
          id: msg.id,
          content: msg.content,
          type: msg.message_type,
          created_at: msg.created_at,
          ticket_id: msg.ticket_id,
          sender_id: msg.sender_id,
          whatsapp_id: msg.metadata?.whatsapp?.messageId
        });

        if (msg.metadata?.whatsapp?.messageId === messageId) {
          console.log('\n✅ Mensagem de teste encontrada!');
          return true;
        }
      });
    } else {
      console.log('❌ Nenhuma mensagem encontrada');
    }

    // Aguardar antes da próxima tentativa
    if (i < retries - 1) {
      console.log(`\n⏳ Aguardando 2 segundos antes da próxima verificação...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return false;
}

async function testWebhook() {
  try {
    // Gerar assinatura
    const webhookSecret = process.env.WEBHOOK_SECRET || 'test-secret';
    const signature = generateSignature(webhookData, webhookSecret);

    console.log('📤 Enviando webhook de teste...', {
      instance: webhookData.instance,
      messageId: webhookData.data[0].key.id,
      content: webhookData.data[0].message.conversation
    });

    const response = await axios.post(
      'http://localhost:3001/api/webhook/evolution/test-instance',
      webhookData,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Evolution-Webhook/1.0',
          'X-Hub-Signature': signature
        }
      }
    );

    console.log('✅ Resposta:', response.data);

    // Aguardar um momento para o processamento
    console.log('\n⏳ Aguardando 2 segundos para o processamento inicial...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verificar se a mensagem foi salva
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    const found = await checkMessages(supabase);
    
    if (!found) {
      console.log('\n❌ Mensagem de teste não encontrada após todas as tentativas');
    }
    
  } catch (error) {
    console.error('❌ Erro ao testar webhook:', error.message);
    if (error.response) {
      console.error('Detalhes do erro:', {
        status: error.response.status,
        data: error.response.data
      });
    }
  }
}

testWebhook(); 
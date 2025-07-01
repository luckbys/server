require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function checkMessages() {
  try {
    console.log('🔍 Consultando mensagens...');
    
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      throw error;
    }

    if (messages && messages.length > 0) {
      console.log('✅ Últimas mensagens encontradas:');
      messages.forEach(msg => {
        console.log('\n📝 Mensagem:', {
          id: msg.id,
          content: msg.content,
          type: msg.message_type,
          created_at: msg.created_at,
          ticket_id: msg.ticket_id,
          sender_id: msg.sender_id
        });
      });
    } else {
      console.log('❌ Nenhuma mensagem encontrada');
    }
  } catch (error) {
    console.error('❌ Erro ao consultar mensagens:', error.message);
  }
}

checkMessages(); 
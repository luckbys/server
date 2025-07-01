require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Configuração do Supabase incompleta', {
    url: supabaseUrl ? 'definida' : 'indefinida',
    key: supabaseKey ? 'definida' : 'indefinida'
  });
  process.exit(1);
}

console.log('🔌 Inicializando cliente Supabase...', {
  url: supabaseUrl
});

async function testSupabase() {
  try {
    console.log('🔍 Testando conexão com Supabase...');

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        },
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'x-application-name': 'evolution-webhook'
          }
        }
      }
    );

    console.log('📝 Tentando buscar mensagens...');
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Erro ao buscar mensagens:', {
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return;
    }

    console.log('✅ Mensagens encontradas:', data);

  } catch (error) {
    console.error('❌ Erro ao testar Supabase:', error.message);
  }
}

testSupabase(); 
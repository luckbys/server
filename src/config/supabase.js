const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

// Obter variáveis de ambiente
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Validar configuração
if (!supabaseUrl || !supabaseKey) {
  logger.error('❌ Configuração do Supabase incompleta:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey
  });
  throw new Error('Configuração do Supabase incompleta. SUPABASE_URL e SUPABASE_KEY são obrigatórios.');
}

// Criar cliente Supabase com retry e timeout
const supabase = createClient(
  supabaseUrl,
  supabaseKey,
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

// Testar conexão
async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('count')
      .limit(1)
      .single();

    if (error) throw error;
    
    logger.info('✅ Conexão com Supabase estabelecida com sucesso');
  } catch (error) {
    logger.error('❌ Erro ao testar conexão com Supabase:', {
      error: error.message,
      details: error.details,
      hint: error.hint
    });
    throw error;
  }
}

// Testar conexão inicial
testConnection();

module.exports = {
  supabase,
  testConnection
}; 
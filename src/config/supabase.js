const { createClient } = require('@supabase/supabase-js');
const logger = require('./logger');

// Validar variáveis de ambiente
if (!process.env.SUPABASE_URL) {
  logger.error('SUPABASE_URL não definida');
  process.exit(1);
}

if (!process.env.SUPABASE_ANON_KEY) {
  logger.error('SUPABASE_ANON_KEY não definida');
  process.exit(1);
}

// Cliente público (com RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Cliente administrativo (sem RLS)
let supabaseAdmin = null;
if (process.env.SUPABASE_SERVICE_KEY) {
  supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

// Função para testar conexão
async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);
    
    if (error) {
      logger.error('Erro ao testar conexão com Supabase:', error);
      return false;
    }
    
    logger.info('Conexão com Supabase estabelecida com sucesso');
    return true;
  } catch (error) {
    logger.error('Erro ao conectar com Supabase:', error);
    return false;
  }
}

module.exports = {
  supabase,
  supabaseAdmin,
  testConnection
}; 
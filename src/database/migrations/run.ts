import { readFileSync } from 'fs';
import { join } from 'path';
import db from '../connection';
import logger from '../../utils/logger';

interface Migration {
  version: string;
  filename: string;
  description: string;
}

const migrations: Migration[] = [
  {
    version: '001',
    filename: '001_create_messages_table.sql',
    description: 'Create messages table'
  },
  {
    version: '002',
    filename: '002_create_events_table.sql',
    description: 'Create events table'
  }
];

async function createMigrationsTable(): Promise<void> {
  const sql = `
    CREATE TABLE IF NOT EXISTS migrations (
      version VARCHAR(10) PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      description TEXT,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;
  
  await db.query(sql);
  logger.info('✅ Tabela de migrations criada/verificada');
}

async function isMigrationExecuted(version: string): Promise<boolean> {
  const result = await db.query(
    'SELECT version FROM migrations WHERE version = $1',
    [version]
  );
  return result.length > 0;
}

async function executeMigration(migration: Migration): Promise<void> {
  const migrationPath = join(__dirname, migration.filename);
  const sql = readFileSync(migrationPath, 'utf-8');
  
  await db.transaction(async (client) => {
    // Executar a migration
    await client.query(sql);
    
    // Registrar como executada
    await client.query(
      'INSERT INTO migrations (version, filename, description) VALUES ($1, $2, $3)',
      [migration.version, migration.filename, migration.description]
    );
  });
  
  logger.info(`✅ Migration ${migration.version} executada: ${migration.description}`);
}

async function runMigrations(): Promise<void> {
  try {
    logger.info('🔄 Iniciando execução das migrations...');
    
    // Criar tabela de migrations se não existir
    await createMigrationsTable();
    
    // Executar migrations pendentes
    for (const migration of migrations) {
      const executed = await isMigrationExecuted(migration.version);
      
      if (!executed) {
        logger.info(`🔄 Executando migration ${migration.version}...`);
        await executeMigration(migration);
      } else {
        logger.info(`⏭️  Migration ${migration.version} já executada`);
      }
    }
    
    logger.info('✅ Todas as migrations foram executadas com sucesso!');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migrations:', error);
    throw error;
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('🎉 Processo de migration concluído');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Falha no processo de migration:', error);
      process.exit(1);
    });
}

export default runMigrations; 
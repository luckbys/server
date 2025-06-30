import { Pool, PoolClient } from 'pg';
import config from '../config';
import logger, { logDatabase, logError } from '../utils/logger';

class DatabaseConnection {
  private pool: Pool;
  private static instance: DatabaseConnection;

  private constructor() {
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err: Error) => {
      logError(err, 'Pool de conexão PostgreSQL');
    });

    this.pool.on('connect', () => {
      logger.debug('🔌 Nova conexão estabelecida com PostgreSQL');
    });
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public async getClient(): Promise<PoolClient> {
    try {
      const client = await this.pool.connect();
      logDatabase('connect', 'pool', true);
      return client;
    } catch (error) {
      logError(error as Error, 'Obter cliente do pool');
      throw error;
    }
  }

  public async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const client = await this.getClient();
    try {
      const start = Date.now();
      const result = await client.query(text, params);
      const duration = Date.now() - start;
      
      logDatabase('query', 'execution', {
        duration: `${duration}ms`,
        rows: result.rowCount
      });
      
      return result.rows;
    } catch (error) {
      logError(error as Error, 'Execução de query');
      throw error;
    } finally {
      client.release();
    }
  }

  public async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      logDatabase('transaction', 'begin', true);
      
      const result = await callback(client);
      
      await client.query('COMMIT');
      logDatabase('transaction', 'commit', true);
      
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logDatabase('transaction', 'rollback', false);
      logError(error as Error, 'Transação');
      throw error;
    } finally {
      client.release();
    }
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this.query('SELECT NOW()');
      logger.info('✅ Conexão com PostgreSQL testada com sucesso');
      return true;
    } catch (error) {
      logError(error as Error, 'Teste de conexão');
      return false;
    }
  }

  public async close(): Promise<void> {
    try {
      await this.pool.end();
      logger.info('🔌 Pool de conexões PostgreSQL fechado');
    } catch (error) {
      logError(error as Error, 'Fechar pool de conexões');
    }
  }
}

export default DatabaseConnection.getInstance(); 
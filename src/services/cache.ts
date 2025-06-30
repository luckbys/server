import { createClient, RedisClientType } from 'redis';
import config from '../config';
import logger, { logError } from '../utils/logger';

class CacheService {
  private client: RedisClientType;
  private static instance: CacheService;
  private connected: boolean = false;

  private constructor() {
    this.client = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password,
      database: config.redis.db,
    });

    this.setupEventHandlers();
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('🔌 Conectando ao Redis...');
    });

    this.client.on('ready', () => {
      logger.info('✅ Redis conectado e pronto');
      this.connected = true;
    });

    this.client.on('error', (error: Error) => {
      logError(error, 'Redis');
      this.connected = false;
    });

    this.client.on('end', () => {
      logger.info('🔌 Conexão Redis encerrada');
      this.connected = false;
    });
  }

  public async connect(): Promise<void> {
    try {
      if (!this.connected) {
        await this.client.connect();
      }
    } catch (error) {
      logError(error as Error, 'Conectar ao Redis');
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.connected) {
        await this.client.disconnect();
      }
    } catch (error) {
      logError(error as Error, 'Desconectar do Redis');
    }
  }

  public async set(key: string, value: any, expiration?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      
      if (expiration) {
        await this.client.setEx(key, expiration, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      
      logger.debug(`📝 Cache definido: ${key}`);
    } catch (error) {
      logError(error as Error, `Definir cache: ${key}`);
      throw error;
    }
  }

  public async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      
      if (value === null) {
        logger.debug(`🔍 Cache miss: ${key}`);
        return null;
      }
      
      logger.debug(`✅ Cache hit: ${key}`);
      return JSON.parse(value);
    } catch (error) {
      logError(error as Error, `Obter cache: ${key}`);
      return null;
    }
  }

  public async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
      logger.debug(`🗑️ Cache removido: ${key}`);
    } catch (error) {
      logError(error as Error, `Remover cache: ${key}`);
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      const exists = await this.client.exists(key);
      return exists === 1;
    } catch (error) {
      logError(error as Error, `Verificar existência cache: ${key}`);
      return false;
    }
  }

  public async increment(key: string, value: number = 1): Promise<number> {
    try {
      const result = await this.client.incrBy(key, value);
      logger.debug(`📈 Cache incrementado: ${key} = ${result}`);
      return result;
    } catch (error) {
      logError(error as Error, `Incrementar cache: ${key}`);
      throw error;
    }
  }

  public async setExpiration(key: string, seconds: number): Promise<void> {
    try {
      await this.client.expire(key, seconds);
      logger.debug(`⏱️ Expiração definida: ${key} = ${seconds}s`);
    } catch (error) {
      logError(error as Error, `Definir expiração: ${key}`);
    }
  }

  // Métodos específicos para o contexto da aplicação
  public async cacheMessage(messageId: string, message: any, ttl: number = 1800): Promise<void> {
    await this.set(`message:${messageId}`, message, ttl);
  }

  public async getCachedMessage(messageId: string): Promise<any | null> {
    return await this.get(`message:${messageId}`);
  }

  public async cacheUserStatus(jid: string, status: string, ttl: number = 300): Promise<void> {
    await this.set(`user:${jid}:status`, status, ttl);
  }

  public async getUserStatus(jid: string): Promise<string | null> {
    return await this.get(`user:${jid}:status`);
  }

  public async cacheInstanceStatus(instanceName: string, status: any, ttl: number = 600): Promise<void> {
    await this.set(`instance:${instanceName}:status`, status, ttl);
  }

  public async getInstanceStatus(instanceName: string): Promise<any | null> {
    return await this.get(`instance:${instanceName}:status`);
  }

  public isConnected(): boolean {
    return this.connected;
  }
}

export default CacheService.getInstance(); 
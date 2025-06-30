import amqp, { Connection, Channel } from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import config from '../config';
import logger, { logError, logQueue } from '../utils/logger';
import { MessageQueuePayload, EvolutionEventType } from '../types';

class QueueService {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private static instance: QueueService;
  private connected: boolean = false;

  private constructor() {}

  public static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  public async connect(): Promise<void> {
    try {
      logger.info('🔌 Conectando ao RabbitMQ...');
      
      this.connection = await amqp.connect(config.rabbitmq.url);
      this.channel = await this.connection.createChannel();
      
      // Configurar event handlers
      this.connection.on('error', (error: Error) => {
        logError(error, 'RabbitMQ Connection');
        this.connected = false;
      });

      this.connection.on('close', () => {
        logger.info('🔌 Conexão RabbitMQ fechada');
        this.connected = false;
      });

      // Declarar filas
      await this.setupQueues();
      
      this.connected = true;
      logger.info('✅ RabbitMQ conectado e configurado');
      
    } catch (error) {
      logError(error as Error, 'Conectar ao RabbitMQ');
      throw error;
    }
  }

  private async setupQueues(): Promise<void> {
    if (!this.channel) {
      throw new Error('Canal RabbitMQ não está disponível');
    }

    // Configurar exchange para dead letter
    await this.channel.assertExchange('evolution.dlx', 'direct', { durable: true });

    // Declarar filas com configurações de dead letter
    const queueOptions = {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'evolution.dlx',
        'x-dead-letter-routing-key': 'dead-letter'
      }
    };

    await this.channel.assertQueue(config.rabbitmq.queues.messages, queueOptions);
    await this.channel.assertQueue(config.rabbitmq.queues.events, queueOptions);
    await this.channel.assertQueue(config.rabbitmq.queues.deadLetter, { durable: true });

    // Configurar dead letter queue
    await this.channel.bindQueue(
      config.rabbitmq.queues.deadLetter,
      'evolution.dlx',
      'dead-letter'
    );

    logger.info('📋 Filas RabbitMQ configuradas');
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      
      this.connected = false;
      logger.info('🔌 RabbitMQ desconectado');
      
    } catch (error) {
      logError(error as Error, 'Desconectar do RabbitMQ');
    }
  }

  public async publishMessage(
    queue: string,
    payload: MessageQueuePayload,
    options: { priority?: number; delay?: number } = {}
  ): Promise<void> {
    if (!this.channel || !this.connected) {
      throw new Error('RabbitMQ não está conectado');
    }

    try {
      const messageBuffer = Buffer.from(JSON.stringify(payload));
      const publishOptions: any = {
        persistent: true,
        messageId: payload.id,
        timestamp: Date.now(),
      };

      if (options.priority) {
        publishOptions.priority = options.priority;
      }

      if (options.delay) {
        publishOptions.headers = { 'x-delay': options.delay };
      }

      const result = this.channel.sendToQueue(queue, messageBuffer, publishOptions);
      
      if (result) {
        logQueue('publish', queue, payload.id);
      } else {
        throw new Error('Falha ao publicar mensagem na fila');
      }
      
    } catch (error) {
      logError(error as Error, `Publicar mensagem na fila ${queue}`);
      throw error;
    }
  }

  public async consumeMessages(
    queue: string,
    handler: (payload: MessageQueuePayload) => Promise<void>,
    options: { prefetch?: number } = {}
  ): Promise<void> {
    if (!this.channel || !this.connected) {
      throw new Error('RabbitMQ não está conectado');
    }

    try {
      // Configurar prefetch
      if (options.prefetch) {
        await this.channel.prefetch(options.prefetch);
      }

      await this.channel.consume(queue, async (message) => {
        if (!message) {
          return;
        }

        try {
          const payload: MessageQueuePayload = JSON.parse(message.content.toString());
          logQueue('consume', queue, payload.id);
          
          // Processar mensagem
          await handler(payload);
          
          // Acknowledge da mensagem
          this.channel!.ack(message);
          logQueue('ack', queue, payload.id);
          
        } catch (error) {
          logError(error as Error, `Processar mensagem da fila ${queue}`);
          
          // Rejeitar mensagem (irá para dead letter após tentativas)
          this.channel!.nack(message, false, false);
          logQueue('nack', queue, 'unknown');
        }
      });

      logger.info(`👂 Consumindo mensagens da fila: ${queue}`);
      
    } catch (error) {
      logError(error as Error, `Consumir mensagens da fila ${queue}`);
      throw error;
    }
  }

  // Métodos específicos para o contexto da aplicação
  public async publishEvolutionMessage(
    eventType: EvolutionEventType,
    instanceName: string,
    data: any
  ): Promise<void> {
    const payload: MessageQueuePayload = {
      id: uuidv4(),
      eventType,
      instanceName,
      data,
      timestamp: new Date(),
      retryCount: 0
    };

    await this.publishMessage(config.rabbitmq.queues.messages, payload);
  }

  public async publishEvolutionEvent(
    eventType: EvolutionEventType,
    instanceName: string,
    data: any,
    priority: number = 0
  ): Promise<void> {
    const payload: MessageQueuePayload = {
      id: uuidv4(),
      eventType,
      instanceName,
      data,
      timestamp: new Date(),
      retryCount: 0
    };

    await this.publishMessage(config.rabbitmq.queues.events, payload, { priority });
  }

  public async startMessageConsumer(
    handler: (payload: MessageQueuePayload) => Promise<void>
  ): Promise<void> {
    await this.consumeMessages(config.rabbitmq.queues.messages, handler, { prefetch: 10 });
  }

  public async startEventConsumer(
    handler: (payload: MessageQueuePayload) => Promise<void>
  ): Promise<void> {
    await this.consumeMessages(config.rabbitmq.queues.events, handler, { prefetch: 5 });
  }

  public async getQueueStats(queue: string): Promise<any> {
    if (!this.channel || !this.connected) {
      throw new Error('RabbitMQ não está conectado');
    }

    try {
      const queueInfo = await this.channel.checkQueue(queue);
      return {
        queue,
        messageCount: queueInfo.messageCount,
        consumerCount: queueInfo.consumerCount
      };
    } catch (error) {
      logError(error as Error, `Obter estatísticas da fila ${queue}`);
      throw error;
    }
  }

  public isConnected(): boolean {
    return this.connected;
  }
}

export default QueueService.getInstance(); 
export interface EvolutionMessage {
  key: {
    id: string;
    remoteJid: string;
    fromMe?: boolean;
    participant?: string;
  };
  messageTimestamp: number;
  pushName?: string;
  broadcast?: boolean;
  status?: string;
  message: {
    conversation?: string;
    imageMessage?: MediaMessage;
    videoMessage?: MediaMessage;
    audioMessage?: MediaMessage;
    documentMessage?: DocumentMessage;
    buttonsResponseMessage?: ButtonsResponseMessage;
    listResponseMessage?: ListResponseMessage;
    locationMessage?: LocationMessage;
    contactMessage?: ContactMessage;
    stickerMessage?: MediaMessage;
    reactionMessage?: ReactionMessage;
  };
}

export interface MediaMessage {
  url?: string;
  mimetype?: string;
  caption?: string;
  mediaKey?: string;
  fileLength?: number;
  fileName?: string;
  jpegThumbnail?: string;
}

export interface DocumentMessage extends MediaMessage {
  title?: string;
  pageCount?: number;
}

export interface ButtonsResponseMessage {
  selectedButtonId: string;
  selectedDisplayText?: string;
  contextInfo?: any;
}

export interface ListResponseMessage {
  singleSelectReply: {
    selectedRowId: string;
  };
  contextInfo?: any;
}

export interface LocationMessage {
  degreesLatitude: number;
  degreesLongitude: number;
  name?: string;
  address?: string;
}

export interface ContactMessage {
  displayName: string;
  vcard: string;
}

export interface ReactionMessage {
  key: {
    id: string;
    remoteJid: string;
  };
  text: string;
  senderTimestampMs: number;
}

export interface EvolutionWebhookPayload {
  event: EvolutionEventType;
  data: any;
  instance?: {
    instanceName: string;
  };
  timestamp?: string;
}

export type EvolutionEventType = 
  | 'MESSAGES_UPSERT'
  | 'CONNECTION_UPDATE'
  | 'QRCODE_UPDATED'
  | 'APPLICATION_STARTUP'
  | 'CONTACTS_UPSERT'
  | 'CHATS_UPSERT'
  | 'GROUPS_UPSERT'
  | 'PRESENCE_UPDATE'
  | 'CALL'
  | 'TYPEBOT_START'
  | 'TYPEBOT_CHANGE_STATUS'
  | 'CHAMA_AI_ACTION'
  | 'CHATWOOT_MESSAGE_CREATE'
  | 'CHATWOOT_MESSAGE_UPDATE'
  | 'LABELS_EDIT'
  | 'LABELS_ASSOCIATION'
  | 'SEND_MESSAGE';

export interface DatabaseMessage {
  id: string;
  evolutionId: string;
  instanceName: string;
  remoteJid: string;
  fromMe: boolean;
  pushName?: string;
  messageType: string;
  content?: string;
  mediaUrl?: string;
  timestamp: Date;
  processed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageQueuePayload {
  id: string;
  eventType: EvolutionEventType;
  instanceName: string;
  data: any;
  timestamp: Date;
  retryCount?: number;
}

export interface ServerConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  corsOrigins: string[];
  webhookSecret?: string;
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    ssl: boolean;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  rabbitmq: {
    url: string;
    queues: {
      messages: string;
      events: string;
      deadLetter: string;
    };
  };
  logging: {
    level: string;
    consoleLevel: string;
    fileLevel: string;
    directory: string;
    maxSize: string;
    maxFiles: string;
    compress: boolean;
    errorMaxFiles: string;
    webhookMaxFiles: string;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  timestamp: string;
  error?: string;
} 
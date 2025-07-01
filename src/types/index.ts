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

// Enums
export enum DocumentType {
  CPF = 'cpf',
  CNPJ = 'cnpj'
}

export enum CustomerStatus {
  PROSPECT = 'prospect',
  ACTIVE = 'active',
  INACTIVE = 'inactive'
}

export enum CustomerCategory {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum'
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  LOCATION = 'location',
  CONTACT = 'contact',
  STICKER = 'sticker'
}

export enum TicketStatus {
  OPEN = 'open',
  PENDING = 'pending',
  RESOLVED = 'resolved',
  CLOSED = 'closed'
}

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum UserRole {
  ADMIN = 'admin',
  AGENT = 'agent',
  CUSTOMER = 'customer'
}

export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error'
}

// Interfaces
export interface Address {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface Customer {
  id: string;
  profile_id?: string;
  created_at: Date;
  updated_at: Date;
  name: string;
  email: string;
  phone?: string;
  document?: string;
  document_type: DocumentType;
  company?: string;
  position?: string;
  address: Address;
  status: CustomerStatus;
  category: CustomerCategory;
  channel: string;
  tags: string[];
  total_orders: number;
  total_value: number;
  average_ticket: number;
  responsible_agent_id?: string;
  notes?: string;
  last_interaction?: Date;
  is_active: boolean;
  metadata: Record<string, any>;
}

export interface Department {
  id: string;
  created_at: Date;
  updated_at: Date;
  name: string;
  description?: string;
  color: string;
  icon: string;
  is_active: boolean;
  metadata: Record<string, any>;
}

export interface EvolutionInstance {
  id: string;
  created_at: Date;
  updated_at: Date;
  instance_name: string;
  department_id: string;
  department_name: string;
  status: 'open' | 'close' | 'connecting' | 'unknown';
  phone?: string;
  is_default: boolean;
  is_active: boolean;
  metadata: Record<string, any>;
  created_by?: string;
  instance_id?: string;
  server_url?: string;
  apikey?: string;
  settings: Record<string, any>;
  webhook_url?: string;
  qr_code?: string;
  last_sync?: Date;
}

export interface Message {
  id: string;
  created_at: Date;
  ticket_id: string;
  sender_id?: string;
  content: string;
  type: MessageType;
  file_url?: string;
  is_internal: boolean;
  metadata: Record<string, any>;
  sender_name?: string;
  sender_email?: string;
  sender_type: 'customer' | 'agent';
  message_type: string;
}

export interface Notification {
  id: string;
  created_at: Date;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  data: Record<string, any>;
}

export interface Profile {
  id: string;
  created_at: Date;
  updated_at: Date;
  email: string;
  name?: string;
  avatar_url?: string;
  role: UserRole;
  department?: string;
  metadata: Record<string, any>;
  is_active: boolean;
  phone?: string;
}

export interface Ticket {
  id: string;
  created_at: Date;
  updated_at: Date;
  title: string;
  description?: string;
  status: TicketStatus;
  priority: TicketPriority;
  customer_id?: string;
  agent_id?: string;
  department?: string;
  metadata: Record<string, any>;
  tags: string[];
  assigned_to?: string;
  last_message_at: Date;
  department_id?: string;
  channel: string;
  closed_at?: Date;
  nunmsg?: string;
  is_visualized: boolean;
} 
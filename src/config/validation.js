const { z } = require('zod');

// === ESQUEMAS PARA WEBHOOK PAYLOADS DA EVOLUTION API ===

// Eventos principais suportados pela Evolution API
const EVOLUTION_EVENTS = [
  'APPLICATION_STARTUP',
  'QRCODE_UPDATED', 
  'MESSAGES_SET',
  'MESSAGES_UPSERT',
  'MESSAGES_UPDATE',
  'MESSAGES_DELETE',
  'SEND_MESSAGE',
  'CONTACTS_SET',
  'CONTACTS_UPSERT', 
  'CONTACTS_UPDATE',
  'PRESENCE_UPDATE',
  'CHATS_SET',
  'CHATS_UPSERT',
  'CHATS_UPDATE', 
  'CHATS_DELETE',
  'GROUPS_UPSERT',
  'GROUP_UPDATE',
  'GROUP_PARTICIPANTS_UPDATE',
  'CONNECTION_UPDATE',
  'CALL',
  'NEW_JWT_TOKEN',
  'TYPEBOT_START',
  'TYPEBOT_CHANGE_STATUS'
];

// Schema para mensagens com suporte completo aos tipos da Evolution API
const webhookMessageSchema = z.object({
  key: z.object({
    remoteJid: z.string(),
    fromMe: z.boolean(),
    id: z.string(),
    participant: z.string().optional()
  }),
  messageTimestamp: z.number(),
  pushName: z.string().optional(),
  broadcast: z.boolean().optional(),
  status: z.enum(['ERROR', 'PENDING', 'SERVER_ACK', 'DELIVERY_ACK', 'READ', 'PLAYED']).optional(),
  message: z.object({
    // Mensagem de texto simples
    conversation: z.string().optional(),
    
    // Mensagem de texto com formatação
    extendedTextMessage: z.object({
      text: z.string(),
      contextInfo: z.object({
        quotedMessage: z.any().optional(),
        mentionedJid: z.array(z.string()).optional(),
        isForwarded: z.boolean().optional()
      }).optional()
    }).optional(),
    
    // Mensagem de imagem
    imageMessage: z.object({
      caption: z.string().optional(),
      mimetype: z.string(),
      url: z.string().optional(),
      mediaKey: z.string().optional(),
      fileLength: z.number().optional(),
      fileName: z.string().optional(),
      jpegThumbnail: z.string().optional()
    }).optional(),
    
    // Mensagem de vídeo
    videoMessage: z.object({
      caption: z.string().optional(),
      mimetype: z.string(),
      url: z.string().optional(),
      mediaKey: z.string().optional(),
      fileLength: z.number().optional(),
      fileName: z.string().optional(),
      seconds: z.number().optional(),
      jpegThumbnail: z.string().optional()
    }).optional(),
    
    // Mensagem de áudio
    audioMessage: z.object({
      mimetype: z.string(),
      url: z.string().optional(),
      mediaKey: z.string().optional(),
      fileLength: z.number().optional(),
      seconds: z.number().optional(),
      ptt: z.boolean().optional(), // Push to talk
      waveform: z.string().optional()
    }).optional(),
    
    // Mensagem de documento
    documentMessage: z.object({
      fileName: z.string().optional(),
      mimetype: z.string(),
      url: z.string().optional(),
      mediaKey: z.string().optional(),
      fileLength: z.number().optional(),
      title: z.string().optional(),
      pageCount: z.number().optional(),
      jpegThumbnail: z.string().optional()
    }).optional(),
    
    // Mensagem de localização
    locationMessage: z.object({
      degreesLatitude: z.number(),
      degreesLongitude: z.number(),
      name: z.string().optional(),
      address: z.string().optional(),
      url: z.string().optional(),
      jpegThumbnail: z.string().optional()
    }).optional(),
    
    // Mensagem de contato
    contactMessage: z.object({
      displayName: z.string(),
      vcard: z.string()
    }).optional(),
    
    // Mensagem de sticker
    stickerMessage: z.object({
      url: z.string().optional(),
      mimetype: z.string(),
      mediaKey: z.string().optional(),
      fileLength: z.number().optional(),
      isAnimated: z.boolean().optional()
    }).optional(),
    
    // Mensagem de reação
    reactionMessage: z.object({
      key: z.object({
        remoteJid: z.string(),
        fromMe: z.boolean(),
        id: z.string()
      }),
      text: z.string() // emoji
    }).optional(),
    
    // Mensagem de botões (Evolution API)
    buttonsMessage: z.object({
      contentText: z.string(),
      buttons: z.array(z.object({
        buttonId: z.string(),
        buttonText: z.object({
          displayText: z.string()
        })
      }))
    }).optional(),
    
    // Mensagem de lista (Evolution API)
    listMessage: z.object({
      title: z.string(),
      description: z.string(),
      sections: z.array(z.object({
        title: z.string(),
        rows: z.array(z.object({
          title: z.string(),
          description: z.string().optional(),
          rowId: z.string()
        }))
      }))
    }).optional(),
    
    // Resposta de botão
    buttonsResponseMessage: z.object({
      selectedButtonId: z.string(),
      contextInfo: z.object({
        quotedMessage: z.any().optional()
      }).optional()
    }).optional(),
    
    // Resposta de lista
    listResponseMessage: z.object({
      title: z.string(),
      listType: z.number().optional(),
      singleSelectReply: z.object({
        selectedRowId: z.string()
      }).optional()
    }).optional()
  }).optional()
});

// Schema para atualização de conexão
const webhookConnectionSchema = z.object({
  instance: z.string(),
  state: z.enum(['open', 'connecting', 'close']),
  statusReason: z.number().optional(),
  isNewLogin: z.boolean().optional(),
  qr: z.string().optional()
});

// Schema para QR Code
const webhookQrSchema = z.object({
  instance: z.string(),
  qrcode: z.string(),
  pairingCode: z.string().optional()
});

// Schema para contatos
const webhookContactSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  pushName: z.string().optional(),
  profilePictureUrl: z.string().optional(),
  isGroup: z.boolean().optional(),
  isWAContact: z.boolean().optional()
});

// Schema para chats
const webhookChatSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  isGroup: z.boolean(),
  unreadCount: z.number().optional(),
  archived: z.boolean().optional(),
  pinned: z.boolean().optional(),
  muteExpiration: z.number().optional(),
  lastMessage: z.object({
    key: z.object({
      id: z.string(),
      fromMe: z.boolean()
    }),
    messageTimestamp: z.number()
  }).optional()
});

// Schema para grupos
const webhookGroupSchema = z.object({
  id: z.string(),
  subject: z.string(),
  description: z.string().optional(),
  owner: z.string().optional(),
  creation: z.number().optional(),
  participants: z.array(z.object({
    id: z.string(),
    admin: z.enum(['admin', 'superadmin']).optional()
  })).optional(),
  announce: z.boolean().optional(),
  restrict: z.boolean().optional()
});

// Schema para chamadas
const webhookCallSchema = z.object({
  id: z.string(),
  from: z.string(),
  timestamp: z.number(),
  isVideo: z.boolean().optional(),
  isGroup: z.boolean().optional(),
  status: z.enum(['offer', 'accept', 'reject', 'timeout']).optional()
});

// Schema para presença
const webhookPresenceSchema = z.object({
  id: z.string(),
  presences: z.record(z.object({
    lastKnownPresence: z.enum(['unavailable', 'available', 'composing', 'recording', 'paused']),
    lastSeen: z.number().optional()
  }))
});

// Schema para Typebot
const webhookTypebotSchema = z.object({
  instance: z.string(),
  remoteJid: z.string(),
  status: z.enum(['opened', 'closed', 'paused']),
  url: z.string().optional(),
  typebot: z.string().optional(),
  session: z.string().optional()
});

// === ESQUEMAS PARA API REQUESTS ===

// Schema para envio de mensagem (compatível com Evolution API)
const sendMessageSchema = z.object({
  instanceName: z.string().min(1, 'Nome da instância é obrigatório'),
  number: z.string().min(10, 'Número deve ter pelo menos 10 dígitos'),
  message: z.string().min(1, 'Mensagem é obrigatória'),
  type: z.enum(['text', 'image', 'video', 'audio', 'document', 'location', 'contact', 'buttons', 'list']).default('text'),
  caption: z.string().optional(),
  fileName: z.string().optional(),
  delay: z.number().min(0).max(60).optional(), // Delay em segundos
  quoted: z.object({
    messageId: z.string(),
    remoteJid: z.string()
  }).optional(),
  mentions: z.array(z.string()).optional()
});

// Schema para criação de instância (compatível com Evolution API)
const createInstanceSchema = z.object({
  instanceName: z.string().min(1, 'Nome da instância é obrigatório'),
  token: z.string().optional(),
  qrcode: z.boolean().default(true),
  number: z.string().optional(),
  integration: z.enum(['WHATSAPP-BAILEYS', 'WHATSAPP-BUSINESS']).default('WHATSAPP-BAILEYS'),
  
  // Configurações de webhook
  webhook: z.string().url().optional(),
  webhook_by_events: z.boolean().default(false),
  webhook_base64: z.boolean().default(false),
  events: z.array(z.enum(EVOLUTION_EVENTS)).optional(),
  
  // Configurações da instância
  reject_call: z.boolean().default(false),
  msg_call: z.string().optional(),
  groups_ignore: z.boolean().default(false),
  always_online: z.boolean().default(false),
  read_messages: z.boolean().default(false),
  read_status: z.boolean().default(false),
  sync_full_history: z.boolean().default(false),
  
  // Configurações de WebSocket
  websocket_enabled: z.boolean().default(false),
  websocket_events: z.array(z.enum(EVOLUTION_EVENTS)).optional(),
  
  // Configurações de RabbitMQ
  rabbitmq_enabled: z.boolean().default(false),
  rabbitmq_events: z.array(z.enum(EVOLUTION_EVENTS)).optional(),
  
  // Configurações de SQS
  sqs_enabled: z.boolean().default(false),
  sqs_events: z.array(z.enum(EVOLUTION_EVENTS)).optional(),
  
  // Configurações do Typebot
  typebot_url: z.string().url().optional(),
  typebot: z.string().optional(),
  typebot_expire: z.number().optional(),
  typebot_keyword_finish: z.string().optional(),
  typebot_delay_message: z.number().optional(),
  typebot_unknown_message: z.string().optional(),
  typebot_listening_from_me: z.boolean().default(false),
  
  // Configurações do Chatwoot
  chatwoot_account_id: z.number().optional(),
  chatwoot_token: z.string().optional(),
  chatwoot_url: z.string().url().optional(),
  chatwoot_sign_msg: z.boolean().default(false),
  chatwoot_reopen_conversation: z.boolean().default(false),
  chatwoot_conversation_pending: z.boolean().default(false),
  
  // Configurações de proxy
  proxy: z.object({
    host: z.string(),
    port: z.string(),
    protocol: z.enum(['http', 'https']),
    username: z.string().optional(),
    password: z.string().optional()
  }).optional()
});

// Schema para atualização de configurações
const updateSettingsSchema = z.object({
  reject_call: z.boolean().optional(),
  msg_call: z.string().optional(),
  groups_ignore: z.boolean().optional(),
  always_online: z.boolean().optional(),
  read_messages: z.boolean().optional(),
  read_status: z.boolean().optional(),
  sync_full_history: z.boolean().optional()
});

// Schema para configuração de webhook
const setWebhookSchema = z.object({
  url: z.string().url('URL inválida'),
  webhook_by_events: z.boolean().default(false),
  webhook_base64: z.boolean().default(false),
  events: z.array(z.enum(EVOLUTION_EVENTS)).min(1, 'Pelo menos um evento é obrigatório')
});

// === FUNÇÕES DE VALIDAÇÃO ===

function validateData(schema, data) {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    return { 
      success: false, 
      error: error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
        code: e.code
      }))
    };
  }
}

function validateEvolutionEvent(eventType) {
  return EVOLUTION_EVENTS.includes(eventType);
}

function getMessageType(messageObj) {
  if (!messageObj || !messageObj.message) return 'unknown';
  
  const messageTypes = [
    'conversation', 'extendedTextMessage', 'imageMessage', 'videoMessage',
    'audioMessage', 'documentMessage', 'locationMessage', 'contactMessage',
    'stickerMessage', 'reactionMessage', 'buttonsMessage', 'listMessage',
    'buttonsResponseMessage', 'listResponseMessage'
  ];
  
  for (const type of messageTypes) {
    if (messageObj.message[type]) {
      return type;
    }
  }
  
  return 'unknown';
}

module.exports = {
  // Schemas
  webhookMessageSchema,
  webhookConnectionSchema,
  webhookQrSchema,
  webhookContactSchema,
  webhookChatSchema,
  webhookGroupSchema,
  webhookCallSchema,
  webhookPresenceSchema,
  webhookTypebotSchema,
  sendMessageSchema,
  createInstanceSchema,
  updateSettingsSchema,
  setWebhookSchema,
  
  // Constants
  EVOLUTION_EVENTS,
  
  // Functions
  validateData,
  validateEvolutionEvent,
  getMessageType
}; 
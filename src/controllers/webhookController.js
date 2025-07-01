const logger = require('../utils/logger');
const { 
  validateData, 
  validateEvolutionEvent,
  getMessageType,
  webhookMessageSchema, 
  webhookConnectionSchema, 
  webhookQrSchema,
  webhookContactSchema,
  webhookChatSchema,
  webhookGroupSchema,
  webhookCallSchema,
  webhookPresenceSchema,
  webhookTypebotSchema,
  EVOLUTION_EVENTS
} = require('../config/validation');
const customerService = require('../services/customerService');
const ticketService = require('../services/ticketService');
const messageService = require('../services/messageService');
const instanceService = require('../services/instanceService');
const evolutionService = require('../services/evolutionService');

class WebhookController {
  
  // Processar webhook da Evolution API
  async processWebhook(req, res) {
    try {
      const { instanceName } = req.params;
      const webhookData = req.body;
      
      // Log do webhook recebido
      logger.info('Webhook Evolution API recebido:', {
        instanceName,
        event: webhookData.event,
        timestamp: new Date().toISOString(),
        dataKeys: webhookData.data ? Object.keys(webhookData.data) : [],
        hasData: !!webhookData.data
      });
      
      // Validar se o evento é suportado
      if (!validateEvolutionEvent(webhookData.event)) {
        logger.warn('Evento não reconhecido pela Evolution API:', { 
          event: webhookData.event, 
          instanceName 
        });
        return res.status(400).json({ 
          success: false, 
          error: 'Evento não suportado',
          supportedEvents: EVOLUTION_EVENTS
        });
      }
      
      // Verificar se instância existe
      const instance = await instanceService.findByName(instanceName);
      if (!instance) {
        logger.warn('Webhook de instância não registrada:', { instanceName });
        // Criar instância automaticamente se não existir
        try {
          const newInstance = await instanceService.create({
            instance_name: instanceName,
            status: 'active',
            created_via: 'webhook'
          });
          logger.info('Instância criada automaticamente via webhook:', { instanceName });
        } catch (error) {
          logger.error('Erro ao criar instância automaticamente:', { error, instanceName });
          return res.status(404).json({ 
            success: false, 
            error: 'Instância não encontrada e não foi possível criar automaticamente' 
          });
        }
      }
      
      // Obter referência do WebSocket
      const io = req.app?.get('io');
      
      // Processar diferentes tipos de eventos da Evolution API
      const eventHandler = await this.getEventHandler(webhookData.event);
      if (eventHandler) {
        await eventHandler.call(this, webhookData.data, instance, io, instanceName);
      } else {
        logger.info('Handler não implementado para evento:', { 
          event: webhookData.event, 
          instanceName 
        });
      }
      
      res.status(200).json({ 
        success: true, 
        message: 'Webhook processado com sucesso',
        event: webhookData.event,
        instance: instanceName,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Erro ao processar webhook:', { 
        error: error.message, 
        stack: error.stack,
        instanceName: req.params.instanceName,
        event: req.body?.event
      });
      
      res.status(500).json({ 
        success: false, 
        error: 'Erro interno do servidor',
        message: error.message
      });
    }
  }
  
  // Obter handler baseado no evento
  async getEventHandler(event) {
    const handlers = {
      // Eventos de mensagem
      'MESSAGES_UPSERT': this.handleMessagesUpsert,
      'MESSAGES_UPDATE': this.handleMessagesUpdate,
      'MESSAGES_DELETE': this.handleMessagesDelete,
      'SEND_MESSAGE': this.handleSendMessage,
      
      // Eventos de conexão e QR
      'CONNECTION_UPDATE': this.handleConnectionUpdate,
      'QRCODE_UPDATED': this.handleQRCodeUpdated,
      'APPLICATION_STARTUP': this.handleApplicationStartup,
      
      // Eventos de contatos
      'CONTACTS_SET': this.handleContactsSet,
      'CONTACTS_UPSERT': this.handleContactsUpsert,
      'CONTACTS_UPDATE': this.handleContactsUpdate,
      
      // Eventos de chats
      'CHATS_SET': this.handleChatsSet,
      'CHATS_UPSERT': this.handleChatsUpsert,
      'CHATS_UPDATE': this.handleChatsUpdate,
      'CHATS_DELETE': this.handleChatsDelete,
      
      // Eventos de grupos
      'GROUPS_UPSERT': this.handleGroupsUpsert,
      'GROUP_UPDATE': this.handleGroupUpdate,
      'GROUP_PARTICIPANTS_UPDATE': this.handleGroupParticipantsUpdate,
      
      // Eventos de presença e chamadas
      'PRESENCE_UPDATE': this.handlePresenceUpdate,
      'CALL': this.handleCall,
      
      // Eventos de Typebot
      'TYPEBOT_START': this.handleTypebotStart,
      'TYPEBOT_CHANGE_STATUS': this.handleTypebotChangeStatus,
      
      // Outros eventos
      'NEW_JWT_TOKEN': this.handleNewJwtToken
    };
    
    return handlers[event];
  }
  
  // === HANDLERS DE EVENTOS ===
  
  // Handler para mensagens (messages.upsert)
  async handleMessagesUpsert(data, instance, io, instanceName) {
    try {
      if (!data || !Array.isArray(data)) {
        logger.warn('Dados de mensagem inválidos:', { data, instanceName });
        return;
      }
      
      for (const messageData of data) {
        await this.processMessage(messageData, instance, io, instanceName);
      }
    } catch (error) {
      logger.error('Erro ao processar evento MESSAGES_UPSERT:', { 
        error: error.message, 
        instanceName 
      });
    }
  }
  
  // Processar mensagem individual
  async processMessage(messageData, instance, io, instanceName) {
    try {
      // Validar dados da mensagem
      const validation = validateData(webhookMessageSchema, messageData);
      if (!validation.success) {
        logger.warn('Dados de mensagem inválidos:', { 
          error: validation.error, 
          messageId: messageData.key?.id,
          instanceName 
        });
        return;
      }
      
      const message = validation.data;
      
      // Ignorar mensagens enviadas por nós
      if (message.key.fromMe) {
        logger.debug('Ignorando mensagem própria:', { 
          messageId: message.key.id,
          instanceName 
        });
        return;
      }
      
      // Ignorar mensagens de status/broadcast se configurado
      if (message.key.remoteJid === 'status@broadcast') {
        logger.debug('Ignorando status do WhatsApp:', { 
          messageId: message.key.id,
          instanceName 
        });
        return;
      }
      
      // Verificar se mensagem já foi processada
      const existingMessage = await messageService.findByWhatsAppId(
        message.key.id, 
        instanceName
      );
      
      if (existingMessage) {
        logger.debug('Mensagem já processada:', { 
          messageId: message.key.id,
          instanceName 
        });
        return;
      }
      
      // Determinar tipo e conteúdo da mensagem
      const messageInfo = this.extractMessageInfo(message);
      
      // Obter ou criar cliente
      const customerData = await customerService.findOrCreate({
        jid: message.key.remoteJid,
        pushName: message.pushName || 'Usuário',
        instanceName: instanceName
      });
      
      // Obter ou criar ticket
      const ticket = await ticketService.findOrCreate(customerData, instance);
      
      // Criar mensagem no banco
      const savedMessage = await messageService.create({
        ticketId: ticket.id,
        content: messageInfo.content,
        senderId: customerData.id,
        senderName: customerData.name,
        senderType: 'customer',
        messageType: messageInfo.type,
        whatsappMessageId: message.key.id,
        whatsappTimestamp: message.messageTimestamp,
        instanceName: instanceName,
        timestamp: new Date(message.messageTimestamp * 1000).toISOString(),
        isGroup: message.key.remoteJid.includes('@g.us'),
        participant: message.key.participant,
        status: message.status || 'RECEIVED',
        ...messageInfo.mediaInfo
      });
      
      // Emitir evento via WebSocket
      if (io) {
        io.emit('new-message', {
          message: savedMessage,
          ticket: ticket,
          customer: customerData,
          instance: instanceName,
          messageInfo: messageInfo
        });
        
        // Emitir evento específico para o tipo de mensagem
        io.emit(`message-${messageInfo.type}`, {
          message: savedMessage,
          instance: instanceName
        });
      }
      
      logger.info('Mensagem processada com sucesso:', {
        messageId: savedMessage.id,
        ticketId: ticket.id,
        customerId: customerData.id,
        type: messageInfo.type,
        instanceName: instanceName,
        isGroup: message.key.remoteJid.includes('@g.us')
      });
      
    } catch (error) {
      logger.error('Erro ao processar mensagem individual:', { 
        error: error.message, 
        messageId: messageData.key?.id,
        instanceName 
      });
    }
  }
  
  // Extrair informações da mensagem (aprimorado)
  extractMessageInfo(message) {
    if (!message.message) {
      return {
        type: 'unknown',
        content: '[Mensagem sem conteúdo]',
        mediaInfo: {}
      };
    }
    
    const messageType = getMessageType(message);
    const msg = message.message;
    
    switch (messageType) {
      case 'conversation':
        return {
          type: 'text',
          content: msg.conversation,
          mediaInfo: {}
        };
        
      case 'extendedTextMessage':
        return {
          type: 'text',
          content: msg.extendedTextMessage.text,
          mediaInfo: {
            isForwarded: msg.extendedTextMessage.contextInfo?.isForwarded || false,
            mentions: msg.extendedTextMessage.contextInfo?.mentionedJid || [],
            hasQuoted: !!msg.extendedTextMessage.contextInfo?.quotedMessage
          }
        };
        
      case 'imageMessage':
        return {
          type: 'image',
          content: msg.imageMessage.caption || '[IMAGEM]',
          mediaInfo: {
            mediaMimetype: msg.imageMessage.mimetype,
            mediaUrl: msg.imageMessage.url,
            mediaKey: msg.imageMessage.mediaKey,
            fileLength: msg.imageMessage.fileLength,
            fileName: msg.imageMessage.fileName,
            jpegThumbnail: msg.imageMessage.jpegThumbnail
          }
        };
        
      case 'videoMessage':
        return {
          type: 'video',
          content: msg.videoMessage.caption || '[VÍDEO]',
          mediaInfo: {
            mediaMimetype: msg.videoMessage.mimetype,
            mediaUrl: msg.videoMessage.url,
            mediaKey: msg.videoMessage.mediaKey,
            fileLength: msg.videoMessage.fileLength,
            fileName: msg.videoMessage.fileName,
            seconds: msg.videoMessage.seconds,
            jpegThumbnail: msg.videoMessage.jpegThumbnail
          }
        };
        
      case 'audioMessage':
        return {
          type: 'audio',
          content: '[ÁUDIO]',
          mediaInfo: {
            mediaMimetype: msg.audioMessage.mimetype,
            mediaUrl: msg.audioMessage.url,
            mediaKey: msg.audioMessage.mediaKey,
            fileLength: msg.audioMessage.fileLength,
            seconds: msg.audioMessage.seconds,
            ptt: msg.audioMessage.ptt || false,
            waveform: msg.audioMessage.waveform
          }
        };
        
      case 'documentMessage':
        return {
          type: 'document',
          content: msg.documentMessage.fileName || '[DOCUMENTO]',
          mediaInfo: {
            mediaMimetype: msg.documentMessage.mimetype,
            mediaUrl: msg.documentMessage.url,
            mediaKey: msg.documentMessage.mediaKey,
            mediaFilename: msg.documentMessage.fileName,
            fileLength: msg.documentMessage.fileLength,
            title: msg.documentMessage.title,
            pageCount: msg.documentMessage.pageCount
          }
        };
        
      case 'locationMessage':
        return {
          type: 'location',
          content: msg.locationMessage.name || '[LOCALIZAÇÃO]',
          mediaInfo: {
            latitude: msg.locationMessage.degreesLatitude,
            longitude: msg.locationMessage.degreesLongitude,
            address: msg.locationMessage.address,
            url: msg.locationMessage.url
          }
        };
        
      case 'contactMessage':
        return {
          type: 'contact',
          content: `[CONTATO] ${msg.contactMessage.displayName}`,
          mediaInfo: {
            displayName: msg.contactMessage.displayName,
            vcard: msg.contactMessage.vcard
          }
        };
        
      case 'stickerMessage':
        return {
          type: 'sticker',
          content: '[STICKER]',
          mediaInfo: {
            mediaMimetype: msg.stickerMessage.mimetype,
            mediaUrl: msg.stickerMessage.url,
            mediaKey: msg.stickerMessage.mediaKey,
            isAnimated: msg.stickerMessage.isAnimated || false
          }
        };
        
      case 'reactionMessage':
        return {
          type: 'reaction',
          content: `[REAÇÃO] ${msg.reactionMessage.text}`,
          mediaInfo: {
            emoji: msg.reactionMessage.text,
            messageId: msg.reactionMessage.key.id,
            messageJid: msg.reactionMessage.key.remoteJid
          }
        };
        
      case 'buttonsResponseMessage':
        return {
          type: 'button_reply',
          content: `[BOTÃO] ${msg.buttonsResponseMessage.selectedButtonId}`,
          mediaInfo: {
            selectedButtonId: msg.buttonsResponseMessage.selectedButtonId
          }
        };
        
      case 'listResponseMessage':
        return {
          type: 'list_reply',
          content: `[LISTA] ${msg.listResponseMessage.title}`,
          mediaInfo: {
            selectedRowId: msg.listResponseMessage.singleSelectReply?.selectedRowId,
            title: msg.listResponseMessage.title
          }
        };
        
      default:
        return {
          type: 'unknown',
          content: `[${messageType.toUpperCase()}]`,
          mediaInfo: {}
        };
    }
  }
  
  // Handler para atualização de conexão
  async handleConnectionUpdate(data, instance, io, instanceName) {
    try {
      const validation = validateData(webhookConnectionSchema, data);
      if (!validation.success) {
        logger.warn('Dados de conexão inválidos:', { 
          error: validation.error,
          instanceName 
        });
        return;
      }
      
      const connectionData = validation.data;
      
      // Mapear status da Evolution API para nosso formato
      let status = 'disconnected';
      switch (connectionData.state) {
        case 'open':
          status = 'connected';
          break;
        case 'connecting':
          status = 'connecting';
          break;
        case 'close':
          status = 'disconnected';
          break;
        default:
          status = 'error';
      }
      
      // Atualizar status da instância
      await instanceService.updateStatus(instanceName, status, {
        connection_state: connectionData.state,
        status_reason: connectionData.statusReason,
        is_new_login: connectionData.isNewLogin,
        updated_via: 'webhook',
        qr_code: connectionData.qr
      });
      
      // Emitir evento via WebSocket
      if (io) {
        io.emit('connection-update', {
          instanceName,
          status,
          state: connectionData.state,
          isNewLogin: connectionData.isNewLogin,
          timestamp: new Date().toISOString()
        });
      }
      
      logger.info('Status de conexão atualizado:', {
        instanceName,
        status,
        state: connectionData.state,
        isNewLogin: connectionData.isNewLogin
      });
      
    } catch (error) {
      logger.error('Erro ao processar CONNECTION_UPDATE:', { 
        error: error.message, 
        instanceName 
      });
    }
  }
  
  // Handler para QR Code
  async handleQRCodeUpdated(data, instance, io, instanceName) {
    try {
      const validation = validateData(webhookQrSchema, data);
      if (!validation.success) {
        logger.warn('Dados de QR inválidos:', { 
          error: validation.error,
          instanceName 
        });
        return;
      }
      
      const qrData = validation.data;
      
      // Atualizar QR code da instância
      await instanceService.updateQRCode(instanceName, qrData.qrcode, qrData.pairingCode);
      
      // Emitir evento via WebSocket
      if (io) {
        io.emit('qr-updated', {
          instanceName,
          qrcode: qrData.qrcode,
          pairingCode: qrData.pairingCode,
          timestamp: new Date().toISOString()
        });
      }
      
      logger.info('QR Code atualizado:', {
        instanceName,
        hasQR: !!qrData.qrcode,
        hasPairingCode: !!qrData.pairingCode
      });
      
    } catch (error) {
      logger.error('Erro ao processar QRCODE_UPDATED:', { 
        error: error.message, 
        instanceName 
      });
    }
  }
  
  // Handler para startup da aplicação
  async handleApplicationStartup(data, instance, io, instanceName) {
    try {
      logger.info('Evolution API iniciada:', { instanceName });
      
      // Atualizar status da instância
      await instanceService.updateStatus(instanceName, 'initializing', {
        startup_time: new Date().toISOString(),
        updated_via: 'webhook'
      });
      
      // Emitir evento via WebSocket
      if (io) {
        io.emit('application-startup', {
          instanceName,
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      logger.error('Erro ao processar APPLICATION_STARTUP:', { 
        error: error.message, 
        instanceName 
      });
    }
  }
  
  // Handlers básicos para outros eventos (implementação básica)
  async handleMessagesUpdate(data, instance, io, instanceName) {
    logger.info('Evento MESSAGES_UPDATE recebido:', { instanceName });
    if (io) io.emit('messages-update', { instanceName, data, timestamp: new Date().toISOString() });
  }
  
  async handleMessagesDelete(data, instance, io, instanceName) {
    logger.info('Evento MESSAGES_DELETE recebido:', { instanceName });
    if (io) io.emit('messages-delete', { instanceName, data, timestamp: new Date().toISOString() });
  }
  
  async handleSendMessage(data, instance, io, instanceName) {
    logger.info('Evento SEND_MESSAGE recebido:', { instanceName });
    if (io) io.emit('send-message', { instanceName, data, timestamp: new Date().toISOString() });
  }
  
  async handleContactsSet(data, instance, io, instanceName) {
    logger.info('Evento CONTACTS_SET recebido:', { instanceName });
    if (io) io.emit('contacts-set', { instanceName, data, timestamp: new Date().toISOString() });
  }
  
  async handleContactsUpsert(data, instance, io, instanceName) {
    logger.info('Evento CONTACTS_UPSERT recebido:', { instanceName });
    if (io) io.emit('contacts-upsert', { instanceName, data, timestamp: new Date().toISOString() });
  }
  
  async handleContactsUpdate(data, instance, io, instanceName) {
    logger.info('Evento CONTACTS_UPDATE recebido:', { instanceName });
    if (io) io.emit('contacts-update', { instanceName, data, timestamp: new Date().toISOString() });
  }
  
  async handleChatsSet(data, instance, io, instanceName) {
    logger.info('Evento CHATS_SET recebido:', { instanceName });
    if (io) io.emit('chats-set', { instanceName, data, timestamp: new Date().toISOString() });
  }
  
  async handleChatsUpsert(data, instance, io, instanceName) {
    logger.info('Evento CHATS_UPSERT recebido:', { instanceName });
    if (io) io.emit('chats-upsert', { instanceName, data, timestamp: new Date().toISOString() });
  }
  
  async handleChatsUpdate(data, instance, io, instanceName) {
    logger.info('Evento CHATS_UPDATE recebido:', { instanceName });
    if (io) io.emit('chats-update', { instanceName, data, timestamp: new Date().toISOString() });
  }
  
  async handleChatsDelete(data, instance, io, instanceName) {
    logger.info('Evento CHATS_DELETE recebido:', { instanceName });
    if (io) io.emit('chats-delete', { instanceName, data, timestamp: new Date().toISOString() });
  }
  
  async handleGroupsUpsert(data, instance, io, instanceName) {
    logger.info('Evento GROUPS_UPSERT recebido:', { instanceName });
    if (io) io.emit('groups-upsert', { instanceName, data, timestamp: new Date().toISOString() });
  }
  
  async handleGroupUpdate(data, instance, io, instanceName) {
    logger.info('Evento GROUP_UPDATE recebido:', { instanceName });
    if (io) io.emit('group-update', { instanceName, data, timestamp: new Date().toISOString() });
  }
  
  async handleGroupParticipantsUpdate(data, instance, io, instanceName) {
    logger.info('Evento GROUP_PARTICIPANTS_UPDATE recebido:', { instanceName });
    if (io) io.emit('group-participants-update', { instanceName, data, timestamp: new Date().toISOString() });
  }
  
  async handlePresenceUpdate(data, instance, io, instanceName) {
    logger.debug('Evento PRESENCE_UPDATE recebido:', { instanceName });
    if (io) io.emit('presence-update', { instanceName, data, timestamp: new Date().toISOString() });
  }
  
  async handleCall(data, instance, io, instanceName) {
    logger.info('Evento CALL recebido:', { instanceName });
    if (io) io.emit('call', { instanceName, data, timestamp: new Date().toISOString() });
  }
  
  async handleTypebotStart(data, instance, io, instanceName) {
    logger.info('Evento TYPEBOT_START recebido:', { instanceName });
    if (io) io.emit('typebot-start', { instanceName, data, timestamp: new Date().toISOString() });
  }
  
  async handleTypebotChangeStatus(data, instance, io, instanceName) {
    logger.info('Evento TYPEBOT_CHANGE_STATUS recebido:', { instanceName });
    if (io) io.emit('typebot-change-status', { instanceName, data, timestamp: new Date().toISOString() });
  }
  
  async handleNewJwtToken(data, instance, io, instanceName) {
    logger.info('Evento NEW_JWT_TOKEN recebido:', { instanceName });
    if (io) io.emit('new-jwt-token', { instanceName, data, timestamp: new Date().toISOString() });
  }
}

module.exports = new WebhookController(); 
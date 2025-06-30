const { supabaseAdmin } = require('../config/supabase');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

class MessageService {
  
  // Criar nova mensagem
  async create(messageData) {
    try {
      const messageId = uuidv4();
      
      const message = {
        id: messageId,
        ticket_id: messageData.ticketId,
        content: messageData.content || '',
        sender_id: messageData.senderId,
        sender_name: messageData.senderName,
        sender_type: messageData.senderType || 'customer',
        message_type: messageData.messageType || 'text',
        is_internal: messageData.isInternal || false,
        metadata: {
          whatsapp_message_id: messageData.whatsappMessageId,
          whatsapp_timestamp: messageData.whatsappTimestamp,
          instance_name: messageData.instanceName,
          media_url: messageData.mediaUrl,
          media_filename: messageData.mediaFilename,
          media_mimetype: messageData.mediaMimetype,
          media_size: messageData.mediaSize,
          ...messageData.metadata
        },
        created_at: messageData.timestamp || new Date().toISOString()
      };
      
      const { data, error } = await supabaseAdmin
        .from('messages')
        .insert(message)
        .select()
        .single();
      
      if (error) {
        logger.error('Erro ao criar mensagem:', { error, messageData });
        throw error;
      }
      
      logger.info('Mensagem criada com sucesso:', { 
        messageId: data.id, 
        ticketId: messageData.ticketId,
        type: messageData.messageType 
      });
      
      return data;
    } catch (error) {
      logger.error('Erro ao criar mensagem:', { error, messageData });
      throw error;
    }
  }
  
  // Processar mensagem de mídia
  async processMediaMessage(messageData, mediaInfo) {
    try {
      // Baixar mídia se necessário
      let mediaUrl = null;
      let mediaFilename = null;
      let mediaSize = null;
      
      if (mediaInfo.url) {
        const downloadResult = await this.downloadMedia(mediaInfo.url, mediaInfo.mimetype);
        if (downloadResult.success) {
          mediaUrl = downloadResult.localPath;
          mediaFilename = downloadResult.filename;
          mediaSize = downloadResult.size;
        }
      }
      
      // Criar mensagem com informações de mídia
      const message = await this.create({
        ...messageData,
        mediaUrl,
        mediaFilename,
        mediaMimetype: mediaInfo.mimetype,
        mediaSize,
        content: mediaInfo.caption || `[${messageData.messageType.toUpperCase()}]`
      });
      
      return message;
    } catch (error) {
      logger.error('Erro ao processar mensagem de mídia:', { error, messageData, mediaInfo });
      throw error;
    }
  }
  
  // Baixar mídia do WhatsApp
  async downloadMedia(mediaUrl, mimetype) {
    try {
      // Criar diretório de uploads se não existir
      const uploadsDir = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // Gerar nome único para o arquivo
      const extension = this.getFileExtension(mimetype);
      const filename = `${uuidv4()}${extension}`;
      const filepath = path.join(uploadsDir, filename);
      
      // Baixar arquivo
      const response = await axios({
        method: 'GET',
        url: mediaUrl,
        responseType: 'stream',
        timeout: 30000
      });
      
      // Salvar arquivo
      const writer = fs.createWriteStream(filepath);
      response.data.pipe(writer);
      
      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          const stats = fs.statSync(filepath);
          resolve({
            success: true,
            localPath: `/uploads/${filename}`,
            filename,
            size: stats.size
          });
        });
        
        writer.on('error', (error) => {
          logger.error('Erro ao salvar arquivo de mídia:', { error, filename });
          reject(error);
        });
      });
    } catch (error) {
      logger.error('Erro ao baixar mídia:', { error, mediaUrl });
      return { success: false, error: error.message };
    }
  }
  
  // Obter extensão do arquivo baseado no mimetype
  getFileExtension(mimetype) {
    const mimeMap = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'video/mp4': '.mp4',
      'video/avi': '.avi',
      'video/quicktime': '.mov',
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav',
      'audio/ogg': '.ogg',
      'audio/mp4': '.m4a',
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'text/plain': '.txt'
    };
    
    return mimeMap[mimetype] || '.bin';
  }
  
  // Listar mensagens de um ticket
  async listByTicket(ticketId, page = 1, limit = 50) {
    try {
      const offset = (page - 1) * limit;
      
      const { data, error, count } = await supabaseAdmin
        .from('messages')
        .select('*', { count: 'exact' })
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);
      
      if (error) {
        logger.error('Erro ao listar mensagens do ticket:', { error, ticketId });
        throw error;
      }
      
      return {
        data,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      };
    } catch (error) {
      logger.error('Erro ao listar mensagens do ticket:', { error, ticketId });
      throw error;
    }
  }
  
  // Buscar mensagem por ID do WhatsApp
  async findByWhatsAppId(whatsappMessageId, instanceName) {
    try {
      const { data, error } = await supabaseAdmin
        .from('messages')
        .select('*')
        .eq('metadata->>whatsapp_message_id', whatsappMessageId)
        .eq('metadata->>instance_name', instanceName)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        logger.error('Erro ao buscar mensagem por ID WhatsApp:', { error, whatsappMessageId });
        throw error;
      }
      
      return data;
    } catch (error) {
      logger.error('Erro ao buscar mensagem por ID WhatsApp:', { error, whatsappMessageId });
      throw error;
    }
  }
  
  // Marcar mensagem como lida
  async markAsRead(messageId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('messages')
        .update({
          metadata: {
            read_at: new Date().toISOString()
          }
        })
        .eq('id', messageId)
        .select()
        .single();
      
      if (error) {
        logger.error('Erro ao marcar mensagem como lida:', { error, messageId });
        throw error;
      }
      
      return data;
    } catch (error) {
      logger.error('Erro ao marcar mensagem como lida:', { error, messageId });
      throw error;
    }
  }
  
  // Obter estatísticas de mensagens
  async getStats() {
    try {
      const { data, error } = await supabaseAdmin
        .from('messages')
        .select('created_at, message_type, sender_type');
      
      if (error) {
        logger.error('Erro ao obter estatísticas de mensagens:', error);
        throw error;
      }
      
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const stats = {
        total: data.length,
        today: data.filter(m => new Date(m.created_at) >= today).length,
        thisWeek: data.filter(m => new Date(m.created_at) >= thisWeek).length,
        thisMonth: data.filter(m => new Date(m.created_at) >= thisMonth).length,
        byType: {
          text: data.filter(m => m.message_type === 'text').length,
          image: data.filter(m => m.message_type === 'image').length,
          video: data.filter(m => m.message_type === 'video').length,
          audio: data.filter(m => m.message_type === 'audio').length,
          document: data.filter(m => m.message_type === 'document').length
        },
        bySender: {
          customer: data.filter(m => m.sender_type === 'customer').length,
          agent: data.filter(m => m.sender_type === 'agent').length,
          system: data.filter(m => m.sender_type === 'system').length
        }
      };
      
      return stats;
    } catch (error) {
      logger.error('Erro ao obter estatísticas de mensagens:', error);
      throw error;
    }
  }
}

module.exports = new MessageService(); 
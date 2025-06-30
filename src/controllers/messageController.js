const logger = require('../config/logger');
const { validateData, sendMessageSchema } = require('../config/validation');
const evolutionService = require('../services/evolutionService');
const instanceService = require('../services/instanceService');
const messageService = require('../services/messageService');
const ticketService = require('../services/ticketService');

class MessageController {
  
  // Enviar mensagem
  async sendMessage(req, res) {
    try {
      const validation = validateData(sendMessageSchema, req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Dados inválidos',
          details: validation.error
        });
      }
      
      const { instanceName, number, message, type, caption, fileName } = validation.data;
      
      // Validar instância
      const instanceValidation = await instanceService.validateInstance(instanceName);
      if (!instanceValidation.valid) {
        return res.status(400).json({
          success: false,
          error: instanceValidation.error
        });
      }
      
      let result;
      
      // Enviar baseado no tipo
      if (type === 'text') {
        result = await evolutionService.sendTextMessage(instanceName, number, message);
      } else {
        // Para outros tipos, seria necessário ter a URL da mídia
        return res.status(400).json({
          success: false,
          error: 'Envio de mídia não implementado neste endpoint'
        });
      }
      
      logger.info('Mensagem enviada via API:', {
        instanceName,
        number,
        type,
        messageId: result.messageId
      });
      
      res.json({
        success: true,
        data: result,
        message: 'Mensagem enviada com sucesso'
      });
    } catch (error) {
      logger.error('Erro ao enviar mensagem:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro interno do servidor'
      });
    }
  }
  
  // Enviar mensagem de texto
  async sendTextMessage(req, res) {
    try {
      const { instanceName } = req.params;
      const { number, message } = req.body;
      
      const result = await evolutionService.sendTextMessage(instanceName, number, message);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Erro ao enviar mensagem de texto:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Enviar mídia
  async sendMediaMessage(req, res) {
    try {
      const { instanceName } = req.params;
      const { number, mediaUrl, caption, fileName, type } = req.body;
      
      const result = await evolutionService.sendMediaMessage(instanceName, number, {
        type,
        url: mediaUrl,
        caption,
        fileName
      });
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Erro ao enviar mídia:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Enviar áudio
  async sendAudioMessage(req, res) {
    try {
      const { instanceName } = req.params;
      const { number, audioUrl } = req.body;
      
      const result = await evolutionService.sendMediaMessage(instanceName, number, {
        type: 'audio',
        url: audioUrl
      });
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Erro ao enviar áudio:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Enviar localização
  async sendLocationMessage(req, res) {
    try {
      const { instanceName } = req.params;
      const { number, latitude, longitude, name, address } = req.body;
      
      const result = await evolutionService.sendLocationMessage(instanceName, number, {
        latitude,
        longitude,
        name,
        address
      });
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Erro ao enviar localização:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Enviar contato
  async sendContactMessage(req, res) {
    try {
      const { instanceName } = req.params;
      const { number, contact } = req.body;
      
      const result = await evolutionService.sendContactMessage(instanceName, number, contact);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Erro ao enviar contato:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Enviar botões
  async sendButtonsMessage(req, res) {
    try {
      const { instanceName } = req.params;
      const { number, text, buttons, footer } = req.body;
      
      const result = await evolutionService.sendButtonsMessage(instanceName, number, {
        text,
        buttons,
        footer
      });
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Erro ao enviar botões:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Enviar lista
  async sendListMessage(req, res) {
    try {
      const { instanceName } = req.params;
      const { number, list } = req.body;
      
      const result = await evolutionService.sendListMessage(instanceName, number, list);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Erro ao enviar lista:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Marcar como lida
  async markAsRead(req, res) {
    try {
      const { instanceName } = req.params;
      const { messageId } = req.body;
      
      const result = await evolutionService.markMessageAsRead(instanceName, messageId);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Erro ao marcar como lida:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Definir presença
  async setPresence(req, res) {
    try {
      const { instanceName } = req.params;
      const { presence, chatId } = req.body;
      
      const result = await evolutionService.setPresence(instanceName, chatId, presence);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Erro ao definir presença:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Verificar números WhatsApp
  async checkWhatsAppNumbers(req, res) {
    try {
      const { instanceName } = req.params;
      const { numbers } = req.body;
      
      const result = await evolutionService.checkWhatsAppNumbers(instanceName, numbers);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Erro ao verificar números:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Buscar mensagens
  async findMessages(req, res) {
    try {
      const { instanceName } = req.params;
      const { chatId, count } = req.query;
      
      const result = await evolutionService.findMessages(instanceName, chatId, count);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Erro ao buscar mensagens:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Criar grupo
  async createGroup(req, res) {
    try {
      const { instanceName } = req.params;
      const { name, participants } = req.body;
      
      const result = await evolutionService.createGroup(instanceName, name, participants);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Erro ao criar grupo:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Atualizar grupo
  async updateGroup(req, res) {
    try {
      const { instanceName } = req.params;
      const { groupId, name, description } = req.body;
      
      const result = await evolutionService.updateGroup(instanceName, groupId, {
        name,
        description
      });
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Erro ao atualizar grupo:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Atualizar participantes do grupo
  async updateGroupParticipants(req, res) {
    try {
      const { instanceName } = req.params;
      const { groupId, action, participants } = req.body;
      
      const result = await evolutionService.updateGroupParticipants(instanceName, groupId, {
        action,
        participants
      });
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Erro ao atualizar participantes:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Sair do grupo
  async leaveGroup(req, res) {
    try {
      const { instanceName } = req.params;
      const { groupId } = req.body;
      
      const result = await evolutionService.leaveGroup(instanceName, groupId);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Erro ao sair do grupo:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Buscar perfil
  async findProfile(req, res) {
    try {
      const { instanceName } = req.params;
      const { number } = req.query;
      
      const result = await evolutionService.findProfile(instanceName, number);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Erro ao buscar perfil:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Atualizar nome do perfil
  async updateProfileName(req, res) {
    try {
      const { instanceName } = req.params;
      const { name } = req.body;
      
      const result = await evolutionService.updateProfileName(instanceName, name);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Erro ao atualizar nome do perfil:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Atualizar status do perfil
  async updateProfileStatus(req, res) {
    try {
      const { instanceName } = req.params;
      const { status } = req.body;
      
      const result = await evolutionService.updateProfileStatus(instanceName, status);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Erro ao atualizar status do perfil:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Atualizar foto do perfil
  async updateProfilePicture(req, res) {
    try {
      const { instanceName } = req.params;
      const { imageUrl } = req.body;
      
      const result = await evolutionService.updateProfilePicture(instanceName, imageUrl);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Erro ao atualizar foto do perfil:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Validar número WhatsApp
  async validateWhatsAppNumber(req, res) {
    try {
      const { number } = req.body;
      
      const result = await evolutionService.validateNumber(number);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Erro ao validar número:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Download de mídia
  async downloadMedia(req, res) {
    try {
      const { mediaId } = req.params;
      
      const result = await evolutionService.downloadMedia(mediaId);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Erro ao fazer download da mídia:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Upload de mídia
  async uploadMedia(req, res) {
    try {
      const { file } = req.files;
      
      const result = await evolutionService.uploadMedia(file);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Erro ao fazer upload da mídia:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Mensagens do ticket
  async getTicketMessages(req, res) {
    try {
      const { ticketId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      
      const result = await evolutionService.getTicketMessages(ticketId, page, limit);
      
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Erro ao listar mensagens do ticket:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new MessageController(); 
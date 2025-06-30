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
  
  // Listar mensagens de um ticket
  async listByTicket(req, res) {
    try {
      const { ticketId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      
      const result = await messageService.listByTicket(ticketId, page, limit);
      
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Erro ao listar mensagens:', { error, ticketId: req.params.ticketId });
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
  
  // Marcar mensagem como lida
  async markAsRead(req, res) {
    try {
      const { messageId } = req.params;
      
      const message = await messageService.markAsRead(messageId);
      
      // Emitir evento via WebSocket
      const io = req.app.get('io');
      if (io) {
        io.emit('message-read', {
          messageId: message.id,
          ticketId: message.ticket_id,
          timestamp: new Date().toISOString()
        });
      }
      
      res.json({
        success: true,
        data: message,
        message: 'Mensagem marcada como lida'
      });
    } catch (error) {
      logger.error('Erro ao marcar mensagem como lida:', { error, messageId: req.params.messageId });
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
  
  // Obter estatísticas de mensagens
  async getStats(req, res) {
    try {
      const stats = await messageService.getStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Erro ao obter estatísticas de mensagens:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
  
  // Buscar mensagens por filtros
  async search(req, res) {
    try {
      const {
        ticketId,
        senderId,
        messageType,
        startDate,
        endDate,
        search
      } = req.query;
      
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      
      // Implementar busca avançada se necessário
      // Por agora, listar por ticket é o mais comum
      if (ticketId) {
        const result = await messageService.listByTicket(ticketId, page, limit);
        return res.json({
          success: true,
          data: result.data,
          pagination: result.pagination
        });
      }
      
      res.status(400).json({
        success: false,
        error: 'Parâmetros de busca insuficientes'
      });
    } catch (error) {
      logger.error('Erro ao buscar mensagens:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
}

module.exports = new MessageController(); 
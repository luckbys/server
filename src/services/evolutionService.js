const axios = require('axios');
const logger = require('../config/logger');
const instanceService = require('./instanceService');

class EvolutionService {
  
  constructor() {
    this.defaultTimeout = 30000;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
  }
  
  // === MÉTODOS DE INSTÂNCIA ===
  
  // Criar instância na Evolution API
  async createInstance(instanceData) {
    try {
      const response = await this.makeRequest('POST', '/instance/create', instanceData);
      
      logger.info('Instância criada na Evolution API:', {
        instanceName: instanceData.instanceName,
        success: !!response.data?.instance
      });
      
      return {
        success: true,
        data: response.data,
        instance: response.data?.instance
      };
    } catch (error) {
      logger.error('Erro ao criar instância na Evolution API:', {
        error: error.message,
        instanceName: instanceData.instanceName,
        status: error.response?.status,
        data: error.response?.data
      });
      
      throw new Error(`Falha ao criar instância: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Conectar instância
  async connectInstance(instanceName) {
    try {
      const response = await this.makeRequest('GET', `/instance/connect/${instanceName}`);
      
      logger.info('Instância conectada:', {
        instanceName,
        success: !!response.data
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Erro ao conectar instância:', {
        error: error.message,
        instanceName,
        status: error.response?.status
      });
      
      throw new Error(`Falha ao conectar instância: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Buscar instâncias
  async fetchInstances(instanceName = null) {
    try {
      const url = instanceName ? `/instance/fetchInstances?instanceName=${instanceName}` : '/instance/fetchInstances';
      const response = await this.makeRequest('GET', url);
      
      return {
        success: true,
        data: response.data,
        instances: Array.isArray(response.data) ? response.data : [response.data]
      };
    } catch (error) {
      logger.error('Erro ao buscar instâncias:', {
        error: error.message,
        instanceName,
        status: error.response?.status
      });
      
      throw new Error(`Falha ao buscar instâncias: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Deletar instância
  async deleteInstance(instanceName) {
    try {
      const response = await this.makeRequest('DELETE', `/instance/delete/${instanceName}`);
      
      logger.info('Instância deletada:', {
        instanceName,
        success: !!response.data
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Erro ao deletar instância:', {
        error: error.message,
        instanceName,
        status: error.response?.status
      });
      
      throw new Error(`Falha ao deletar instância: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Obter status da instância
  async getInstanceStatus(instanceName) {
    try {
      const response = await this.makeRequest('GET', `/instance/connectionState/${instanceName}`);
      
      return {
        success: true,
        data: response.data,
        state: response.data?.state,
        status: response.data?.state === 'open' ? 'connected' : 'disconnected'
      };
    } catch (error) {
      logger.error('Erro ao obter status da instância:', {
        error: error.message,
        instanceName,
        status: error.response?.status
      });
      
      return {
        success: false,
        error: error.message,
        status: 'error'
      };
    }
  }
  
  // === MÉTODOS DE MENSAGEM ===
  
  // Enviar mensagem de texto
  async sendTextMessage(instanceName, number, message, options = {}) {
    try {
      const payload = {
        number: this.formatNumber(number),
        text: message,
        delay: options.delay || 0,
        quoted: options.quoted,
        mentions: options.mentions
      };
      
      const response = await this.makeRequest('POST', `/message/sendText/${instanceName}`, payload);
      
      logger.info('Mensagem de texto enviada:', {
        instanceName,
        number: payload.number,
        messageLength: message.length,
        success: !!response.data?.key?.id
      });
      
      return {
        success: true,
        data: response.data,
        messageId: response.data?.key?.id,
        key: response.data?.key
      };
    } catch (error) {
      logger.error('Erro ao enviar mensagem de texto:', {
        error: error.message,
        instanceName,
        number,
        status: error.response?.status,
        data: error.response?.data
      });
      
      throw new Error(`Falha ao enviar mensagem: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Enviar mídia (imagem, vídeo, áudio, documento)
  async sendMediaMessage(instanceName, number, mediaData, options = {}) {
    try {
      const { type, url, caption, fileName } = mediaData;
      const formattedNumber = this.formatNumber(number);
      
      let endpoint = '';
      let payload = {
        number: formattedNumber,
        delay: options.delay || 0,
        quoted: options.quoted,
        mentions: options.mentions
      };
      
      switch (type) {
        case 'image':
          endpoint = 'sendMedia';
          payload.mediaMessage = {
            media: url,
            caption: caption || '',
            type: 'image',
            fileName: fileName || 'image.jpg'
          };
          break;
          
        case 'video':
          endpoint = 'sendMedia';
          payload.mediaMessage = {
            media: url,
            caption: caption || '',
            type: 'video',
            fileName: fileName || 'video.mp4'
          };
          break;
          
        case 'audio':
          endpoint = 'sendWhatsAppAudio';
          payload.audio = url;
          break;
          
        case 'document':
          endpoint = 'sendMedia';
          payload.mediaMessage = {
            media: url,
            caption: caption || '',
            type: 'document',
            fileName: fileName || 'document.pdf'
          };
          break;
          
        default:
          throw new Error(`Tipo de mídia não suportado: ${type}`);
      }
      
      const response = await this.makeRequest('POST', `/message/${endpoint}/${instanceName}`, payload);
      
      logger.info('Mídia enviada:', {
        instanceName,
        number: formattedNumber,
        type,
        success: !!response.data?.key?.id
      });
      
      return {
        success: true,
        data: response.data,
        messageId: response.data?.key?.id,
        key: response.data?.key
      };
    } catch (error) {
      logger.error('Erro ao enviar mídia:', {
        error: error.message,
        instanceName,
        number,
        type: mediaData.type,
        status: error.response?.status,
        data: error.response?.data
      });
      
      throw new Error(`Falha ao enviar mídia: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Enviar localização
  async sendLocationMessage(instanceName, number, locationData, options = {}) {
    try {
      const payload = {
        number: this.formatNumber(number),
        locationMessage: {
          degreesLatitude: locationData.latitude,
          degreesLongitude: locationData.longitude,
          name: locationData.name || '',
          address: locationData.address || ''
        },
        delay: options.delay || 0,
        quoted: options.quoted
      };
      
      const response = await this.makeRequest('POST', `/message/sendLocation/${instanceName}`, payload);
      
      logger.info('Localização enviada:', {
        instanceName,
        number: payload.number,
        success: !!response.data?.key?.id
      });
      
      return {
        success: true,
        data: response.data,
        messageId: response.data?.key?.id,
        key: response.data?.key
      };
    } catch (error) {
      logger.error('Erro ao enviar localização:', {
        error: error.message,
        instanceName,
        number,
        status: error.response?.status,
        data: error.response?.data
      });
      
      throw new Error(`Falha ao enviar localização: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Enviar contato
  async sendContactMessage(instanceName, number, contact) {
    try {
      const payload = {
        number: this.formatNumber(number),
        contact
      };
      
      const response = await this.makeRequest('POST', `/message/sendContact/${instanceName}`, payload);
      
      logger.info('Contato enviado:', {
        instanceName,
        number: payload.number,
        success: !!response.data?.key?.id
      });
      
      return {
        success: true,
        data: response.data,
        messageId: response.data?.key?.id,
        key: response.data?.key
      };
    } catch (error) {
      logger.error('Erro ao enviar contato:', {
        error: error.message,
        instanceName,
        number,
        status: error.response?.status,
        data: error.response?.data
      });
      
      throw new Error(`Falha ao enviar contato: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Enviar botões
  async sendButtonsMessage(instanceName, number, buttonsData, options = {}) {
    try {
      const payload = {
        number: this.formatNumber(number),
        buttonMessage: {
          text: buttonsData.text,
          buttons: buttonsData.buttons,
          footer: buttonsData.footer || ''
        },
        delay: options.delay || 0,
        quoted: options.quoted
      };
      
      const response = await this.makeRequest('POST', `/message/sendButtons/${instanceName}`, payload);
      
      logger.info('Botões enviados:', {
        instanceName,
        number: payload.number,
        success: !!response.data?.key?.id
      });
      
      return {
        success: true,
        data: response.data,
        messageId: response.data?.key?.id,
        key: response.data?.key
      };
    } catch (error) {
      logger.error('Erro ao enviar botões:', {
        error: error.message,
        instanceName,
        number,
        status: error.response?.status,
        data: error.response?.data
      });
      
      throw new Error(`Falha ao enviar botões: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Enviar lista
  async sendListMessage(instanceName, number, listData, options = {}) {
    try {
      const payload = {
        number: this.formatNumber(number),
        listMessage: listData,
        delay: options.delay || 0,
        quoted: options.quoted
      };
      
      const response = await this.makeRequest('POST', `/message/sendList/${instanceName}`, payload);
      
      logger.info('Lista enviada:', {
        instanceName,
        number: payload.number,
        success: !!response.data?.key?.id
      });
      
      return {
        success: true,
        data: response.data,
        messageId: response.data?.key?.id,
        key: response.data?.key
      };
    } catch (error) {
      logger.error('Erro ao enviar lista:', {
        error: error.message,
        instanceName,
        number,
        status: error.response?.status,
        data: error.response?.data
      });
      
      throw new Error(`Falha ao enviar lista: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Marcar mensagem como lida
  async markMessageAsRead(instanceName, messageKey) {
    try {
      const response = await this.makeRequest('PUT', `/chat/markMessageAsRead/${instanceName}`, {
        messageKey
      });
      
      logger.info('Mensagem marcada como lida:', {
        instanceName,
        messageKey,
        success: !!response.data
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Erro ao marcar mensagem como lida:', {
        error: error.message,
        instanceName,
        messageKey,
        status: error.response?.status
      });
      
      throw new Error(`Falha ao marcar mensagem como lida: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Definir presença
  async setPresence(instanceName, jid, presence) {
    try {
      const response = await this.makeRequest('PUT', `/chat/presence/${instanceName}`, {
        jid,
        presence
      });
      
      logger.info('Presença definida:', {
        instanceName,
        jid,
        presence,
        success: !!response.data
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Erro ao definir presença:', {
        error: error.message,
        instanceName,
        jid,
        presence,
        status: error.response?.status
      });
      
      throw new Error(`Falha ao definir presença: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Verificar números WhatsApp
  async checkWhatsAppNumbers(instanceName, numbers) {
    try {
      const response = await this.makeRequest('POST', `/chat/whatsappNumbers/${instanceName}`, {
        numbers: Array.isArray(numbers) ? numbers : [numbers]
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Erro ao verificar números:', {
        error: error.message,
        instanceName,
        status: error.response?.status
      });
      
      throw new Error(`Falha ao verificar números: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Buscar mensagens
  async findMessages(instanceName, chatId, count = 50) {
    try {
      const response = await this.makeRequest('GET', `/chat/findMessages/${instanceName}`, {
        params: { chatId, count }
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Erro ao buscar mensagens:', {
        error: error.message,
        instanceName,
        chatId,
        status: error.response?.status
      });
      
      throw new Error(`Falha ao buscar mensagens: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Criar grupo
  async createGroup(instanceName, name, participants) {
    try {
      const response = await this.makeRequest('POST', `/group/create/${instanceName}`, {
        name,
        participants: Array.isArray(participants) ? participants : [participants]
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Erro ao criar grupo:', {
        error: error.message,
        instanceName,
        name,
        status: error.response?.status
      });
      
      throw new Error(`Falha ao criar grupo: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Atualizar grupo
  async updateGroup(instanceName, groupId, updateData) {
    try {
      const response = await this.makeRequest('PUT', `/group/updateGroupInfo/${instanceName}`, {
        groupId,
        ...updateData
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Erro ao atualizar grupo:', {
        error: error.message,
        instanceName,
        groupId,
        status: error.response?.status
      });
      
      throw new Error(`Falha ao atualizar grupo: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Atualizar participantes do grupo
  async updateGroupParticipants(instanceName, groupId, updateData) {
    try {
      const response = await this.makeRequest('PUT', `/group/participants/${instanceName}`, {
        groupId,
        ...updateData
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Erro ao atualizar participantes:', {
        error: error.message,
        instanceName,
        groupId,
        status: error.response?.status
      });
      
      throw new Error(`Falha ao atualizar participantes: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Sair do grupo
  async leaveGroup(instanceName, groupId) {
    try {
      const response = await this.makeRequest('DELETE', `/group/leaveGroup/${instanceName}`, {
        groupId
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Erro ao sair do grupo:', {
        error: error.message,
        instanceName,
        groupId,
        status: error.response?.status
      });
      
      throw new Error(`Falha ao sair do grupo: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Buscar perfil
  async findProfile(instanceName, number) {
    try {
      const response = await this.makeRequest('GET', `/chat/findProfile/${instanceName}`, {
        params: { number: this.formatNumber(number) }
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Erro ao buscar perfil:', {
        error: error.message,
        instanceName,
        number,
        status: error.response?.status
      });
      
      throw new Error(`Falha ao buscar perfil: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Atualizar nome do perfil
  async updateProfileName(instanceName, name) {
    try {
      const response = await this.makeRequest('PUT', `/chat/updateProfileName/${instanceName}`, {
        name
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Erro ao atualizar nome do perfil:', {
        error: error.message,
        instanceName,
        status: error.response?.status
      });
      
      throw new Error(`Falha ao atualizar nome do perfil: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Atualizar status do perfil
  async updateProfileStatus(instanceName, status) {
    try {
      const response = await this.makeRequest('PUT', `/chat/updateProfileStatus/${instanceName}`, {
        status
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Erro ao atualizar status do perfil:', {
        error: error.message,
        instanceName,
        status: error.response?.status
      });
      
      throw new Error(`Falha ao atualizar status do perfil: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Atualizar foto do perfil
  async updateProfilePicture(instanceName, imageUrl) {
    try {
      const response = await this.makeRequest('PUT', `/chat/updateProfilePicture/${instanceName}`, {
        imageUrl
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Erro ao atualizar foto do perfil:', {
        error: error.message,
        instanceName,
        status: error.response?.status
      });
      
      throw new Error(`Falha ao atualizar foto do perfil: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Validar número WhatsApp
  async validateNumber(number) {
    try {
      const response = await this.makeRequest('POST', '/utils/validate-number', {
        number: this.formatNumber(number)
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Erro ao validar número:', {
        error: error.message,
        number,
        status: error.response?.status
      });
      
      throw new Error(`Falha ao validar número: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Download de mídia
  async downloadMedia(mediaId) {
    try {
      const response = await this.makeRequest('GET', `/media/download/${mediaId}`);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Erro ao fazer download da mídia:', {
        error: error.message,
        mediaId,
        status: error.response?.status
      });
      
      throw new Error(`Falha ao fazer download da mídia: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Upload de mídia
  async uploadMedia(file) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await this.makeRequest('POST', '/media/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Erro ao fazer upload da mídia:', {
        error: error.message,
        fileName: file.name,
        status: error.response?.status
      });
      
      throw new Error(`Falha ao fazer upload da mídia: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Mensagens do ticket
  async getTicketMessages(ticketId, page = 1, limit = 50) {
    try {
      const response = await this.makeRequest('GET', `/messages/ticket/${ticketId}`, {
        params: { page, limit }
      });
      
      return {
        success: true,
        data: response.data.data,
        pagination: {
          page,
          limit,
          total: response.data.total,
          pages: Math.ceil(response.data.total / limit)
        }
      };
    } catch (error) {
      logger.error('Erro ao listar mensagens do ticket:', {
        error: error.message,
        ticketId,
        status: error.response?.status
      });
      
      throw new Error(`Falha ao listar mensagens do ticket: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // === MÉTODOS AUXILIARES ===
  
  // Fazer requisição com retry
  async makeRequest(method, endpoint, data = null, retryCount = 0) {
    try {
      const config = await this.getInstanceConfig();
      
      const response = await axios({
        method,
        url: `${config.baseUrl}${endpoint}`,
        data,
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.apiKey
        },
        timeout: this.defaultTimeout
      });
      
      return response;
    } catch (error) {
      if (this.shouldRetry(error) && retryCount < this.retryAttempts) {
        await this.delay(this.retryDelay * (retryCount + 1));
        return this.makeRequest(method, endpoint, data, retryCount + 1);
      }
      throw error;
    }
  }
  
  // Verificar se deve tentar novamente
  shouldRetry(error) {
    return (
      error.code === 'ECONNABORTED' ||
      error.code === 'ETIMEDOUT' ||
      error.response?.status >= 500
    );
  }
  
  // Aguardar delay
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Obter configuração da instância
  async getInstanceConfig() {
    return {
      baseUrl: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
      apiKey: process.env.EVOLUTION_API_KEY || 'your-api-key'
    };
  }
  
  // Formatar número
  formatNumber(number) {
    // Remover caracteres não numéricos
    let cleaned = number.replace(/\D/g, '');
    
    // Adicionar prefixo do país se não tiver
    if (!cleaned.startsWith('55')) {
      cleaned = '55' + cleaned;
    }
    
    // Adicionar sufixo @s.whatsapp.net se não tiver
    if (!cleaned.endsWith('@s.whatsapp.net') && !cleaned.endsWith('@g.us')) {
      cleaned = cleaned + '@s.whatsapp.net';
    }
    
    return cleaned;
  }
  
  // Validar instância
  async validateInstance(instanceName) {
    try {
      const status = await this.getInstanceStatus(instanceName);
      
      if (!status.success) {
        return {
          valid: false,
          error: 'Instância não encontrada'
        };
      }
      
      if (status.state !== 'open') {
        return {
          valid: false,
          error: 'Instância não está conectada'
        };
      }
      
      return {
        valid: true
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }
}

module.exports = new EvolutionService(); 
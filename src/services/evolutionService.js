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
            fileName: fileName
          };
          break;
          
        case 'video':
          endpoint = 'sendMedia';
          payload.mediaMessage = {
            media: url,
            caption: caption || '',
            fileName: fileName
          };
          break;
          
        case 'audio':
          endpoint = 'sendWhatsAppAudio';
          payload.audioMessage = {
            audio: url
          };
          break;
          
        case 'document':
          endpoint = 'sendMedia';
          payload.mediaMessage = {
            media: url,
            fileName: fileName || 'documento',
            caption: caption || ''
          };
          break;
          
        default:
          throw new Error('Tipo de mídia não suportado');
      }
      
      const response = await this.makeRequest('POST', `/message/${endpoint}/${instanceName}`, payload);
      
      logger.info('Mensagem de mídia enviada:', {
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
      logger.error('Erro ao enviar mensagem de mídia:', {
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
  
  // Enviar mensagem de localização
  async sendLocationMessage(instanceName, number, locationData, options = {}) {
    try {
      const payload = {
        number: this.formatNumber(number),
        locationMessage: {
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          name: locationData.name || '',
          address: locationData.address || ''
        },
        delay: options.delay || 0,
        quoted: options.quoted
      };
      
      const response = await this.makeRequest('POST', `/message/sendLocation/${instanceName}`, payload);
      
      logger.info('Mensagem de localização enviada:', {
        instanceName,
        number: payload.number,
        success: !!response.data?.key?.id
      });
      
      return {
        success: true,
        data: response.data,
        messageId: response.data?.key?.id
      };
    } catch (error) {
      logger.error('Erro ao enviar localização:', {
        error: error.message,
        instanceName,
        number
      });
      
      throw new Error(`Falha ao enviar localização: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Enviar mensagem com botões
  async sendButtonsMessage(instanceName, number, buttonsData, options = {}) {
    try {
      const payload = {
        number: this.formatNumber(number),
        buttonsMessage: {
          contentText: buttonsData.text,
          buttons: buttonsData.buttons.map(btn => ({
            buttonId: btn.id,
            buttonText: {
              displayText: btn.text
            }
          }))
        },
        delay: options.delay || 0,
        quoted: options.quoted
      };
      
      const response = await this.makeRequest('POST', `/message/sendButtons/${instanceName}`, payload);
      
      logger.info('Mensagem com botões enviada:', {
        instanceName,
        number: payload.number,
        buttonsCount: buttonsData.buttons.length,
        success: !!response.data?.key?.id
      });
      
      return {
        success: true,
        data: response.data,
        messageId: response.data?.key?.id
      };
    } catch (error) {
      logger.error('Erro ao enviar botões:', {
        error: error.message,
        instanceName,
        number
      });
      
      throw new Error(`Falha ao enviar botões: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Enviar mensagem de lista
  async sendListMessage(instanceName, number, listData, options = {}) {
    try {
      const payload = {
        number: this.formatNumber(number),
        listMessage: {
          title: listData.title,
          description: listData.description,
          sections: listData.sections.map(section => ({
            title: section.title,
            rows: section.rows.map(row => ({
              title: row.title,
              description: row.description || '',
              rowId: row.id
            }))
          }))
        },
        delay: options.delay || 0,
        quoted: options.quoted
      };
      
      const response = await this.makeRequest('POST', `/message/sendList/${instanceName}`, payload);
      
      logger.info('Mensagem de lista enviada:', {
        instanceName,
        number: payload.number,
        sectionsCount: listData.sections.length,
        success: !!response.data?.key?.id
      });
      
      return {
        success: true,
        data: response.data,
        messageId: response.data?.key?.id
      };
    } catch (error) {
      logger.error('Erro ao enviar lista:', {
        error: error.message,
        instanceName,
        number
      });
      
      throw new Error(`Falha ao enviar lista: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // === MÉTODOS DE CONFIGURAÇÃO ===
  
  // Configurar webhook
  async setWebhook(instanceName, webhookData) {
    try {
      const response = await this.makeRequest('POST', `/webhook/set/${instanceName}`, webhookData);
      
      logger.info('Webhook configurado:', {
        instanceName,
        url: webhookData.url,
        eventsCount: webhookData.events?.length || 0,
        success: !!response.data?.webhook
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Erro ao configurar webhook:', {
        error: error.message,
        instanceName,
        url: webhookData.url
      });
      
      throw new Error(`Falha ao configurar webhook: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Obter webhook
  async getWebhook(instanceName) {
    try {
      const response = await this.makeRequest('GET', `/webhook/find/${instanceName}`);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Erro ao obter webhook:', {
        error: error.message,
        instanceName
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // Configurar settings da instância
  async setSettings(instanceName, settings) {
    try {
      const response = await this.makeRequest('POST', `/settings/set/${instanceName}`, settings);
      
      logger.info('Configurações atualizadas:', {
        instanceName,
        settings: Object.keys(settings),
        success: !!response.data?.settings
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Erro ao configurar settings:', {
        error: error.message,
        instanceName,
        settings
      });
      
      throw new Error(`Falha ao configurar settings: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // === MÉTODOS DE CHAT ===
  
  // Marcar mensagem como lida
  async markMessageAsRead(instanceName, messageKey) {
    try {
      const response = await this.makeRequest('PUT', `/chat/markMessageAsRead/${instanceName}`, {
        readMessages: [messageKey]
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Erro ao marcar mensagem como lida:', {
        error: error.message,
        instanceName,
        messageKey
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // Definir presença (digitando, online, etc)
  async setPresence(instanceName, jid, presence) {
    try {
      const response = await this.makeRequest('PUT', `/chat/presence/${instanceName}`, {
        number: this.formatNumber(jid),
        presence: presence // 'unavailable', 'available', 'composing', 'recording', 'paused'
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
        presence
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // === MÉTODOS AUXILIARES ===
  
  // Fazer requisição HTTP com retry
  async makeRequest(method, endpoint, data = null, retryCount = 0) {
    try {
      const instance = await this.getInstanceConfig();
      const config = {
        method,
        url: `${instance.apiUrl}${endpoint}`,
        headers: {
          'apikey': instance.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: this.defaultTimeout
      };
      
      if (data && (method === 'POST' || method === 'PUT')) {
        config.data = data;
      }
      
      const response = await axios(config);
      return response;
      
    } catch (error) {
      if (retryCount < this.retryAttempts && this.shouldRetry(error)) {
        logger.warn(`Tentativa ${retryCount + 1}/${this.retryAttempts} falhou, tentando novamente...`, {
          endpoint,
          error: error.message
        });
        
        await this.delay(this.retryDelay * (retryCount + 1));
        return this.makeRequest(method, endpoint, data, retryCount + 1);
      }
      
      throw error;
    }
  }
  
  // Verificar se deve fazer retry
  shouldRetry(error) {
    const retryStatuses = [408, 429, 500, 502, 503, 504];
    return error.code === 'ECONNRESET' || 
           error.code === 'ETIMEDOUT' || 
           retryStatuses.includes(error.response?.status);
  }
  
  // Delay para retry
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Obter configuração da instância padrão
  async getInstanceConfig() {
    // Por enquanto, usar configuração padrão
    // Em produção, isso deveria vir do banco de dados
    return {
      apiUrl: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
      apiKey: process.env.EVOLUTION_API_KEY || 'default-key'
    };
  }
  
  // Formatar número para padrão WhatsApp
  formatNumber(number) {
    // Remove caracteres não numéricos
    const cleaned = number.replace(/\D/g, '');
    
    // Se não termina com @s.whatsapp.net, adiciona
    if (!number.includes('@')) {
      return `${cleaned}@s.whatsapp.net`;
    }
    
    return number;
  }
  
  // Validar instância antes de fazer requests
  async validateInstance(instanceName) {
    try {
      const statusResponse = await this.getInstanceStatus(instanceName);
      
      if (!statusResponse.success) {
        return {
          valid: false,
          error: 'Instância não encontrada ou erro de comunicação'
        };
      }
      
      if (statusResponse.state !== 'open') {
        return {
          valid: false,
          error: `Instância não conectada. Status: ${statusResponse.state}`
        };
      }
      
      return {
        valid: true,
        status: statusResponse.state
      };
    } catch (error) {
      return {
        valid: false,
        error: `Erro ao validar instância: ${error.message}`
      };
    }
  }
}

module.exports = new EvolutionService(); 
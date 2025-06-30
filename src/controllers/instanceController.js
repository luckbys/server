const logger = require('../config/logger');
const { 
  validateData, 
  createInstanceSchema, 
  setWebhookSchema, 
  updateSettingsSchema 
} = require('../config/validation');
const evolutionService = require('../services/evolutionService');
const instanceService = require('../services/instanceService');
const webhookConfig = require('../config/webhook');

class InstanceController {
  
  // === MÉTODOS COMPATÍVEIS COM EVOLUTION API ===
  
  // Criar instância (Evolution API compatible)
  async createInstance(req, res) {
    try {
      const validation = validateData(createInstanceSchema, req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Dados inválidos',
          details: validation.error
        });
      }
      
      const instanceData = validation.data;
      
      // Verificar se instância já existe
      const existingInstance = await instanceService.findByName(instanceData.instanceName);
      if (existingInstance) {
        return res.status(409).json({
          success: false,
          error: 'Instância já existe'
        });
      }
      
      // Gerar URL do webhook em produção
      instanceData.webhook = webhookConfig.getWebhookUrl(instanceData.instanceName);
      
      logger.info('Criando nova instância:', {
        instanceName: instanceData.instanceName,
        integration: instanceData.integration
      });
      
      // Criar instância na Evolution API
      const evolutionResponse = await evolutionService.createInstance(instanceData);
      
      // Salvar instância no banco local
      const localInstance = await instanceService.create({
        instance_name: instanceData.instanceName,
        integration_type: instanceData.integration,
        status: 'created',
        webhook_url: instanceData.webhook,
        api_key: instanceData.token,
        settings: {
          reject_call: instanceData.reject_call,
          msg_call: instanceData.msg_call,
          groups_ignore: instanceData.groups_ignore,
          always_online: instanceData.always_online,
          read_messages: instanceData.read_messages,
          read_status: instanceData.read_status,
          sync_full_history: instanceData.sync_full_history
        },
        integrations: {
          webhook_enabled: !!instanceData.webhook,
          webhook_events: instanceData.events || [],
          websocket_enabled: instanceData.websocket_enabled,
          rabbitmq_enabled: instanceData.rabbitmq_enabled,
          sqs_enabled: instanceData.sqs_enabled,
          typebot_enabled: !!instanceData.typebot_url,
          chatwoot_enabled: !!instanceData.chatwoot_url
        }
      });
      
      // Configurar webhook se fornecido
      if (instanceData.webhook) {
        try {
          await evolutionService.setWebhook(instanceData.instanceName, {
            url: instanceData.webhook,
            webhook_by_events: instanceData.webhook_by_events,
            webhook_base64: instanceData.webhook_base64,
            events: instanceData.events || ['MESSAGES_UPSERT', 'CONNECTION_UPDATE']
          });
        } catch (webhookError) {
          logger.warn('Erro ao configurar webhook automaticamente:', {
            instanceName: instanceData.instanceName,
            error: webhookError.message
          });
        }
      }
      
      res.status(201).json({
        success: true,
        data: {
          ...localInstance,
          webhook: instanceData.webhook
        },
        message: 'Instância criada com sucesso'
      });
      
    } catch (error) {
      logger.error('Erro ao criar instância:', {
        error: error.message,
        instanceName: req.body?.instanceName
      });
      
      res.status(500).json({
        success: false,
        error: error.message || 'Erro interno do servidor',
        instanceName: req.body?.instanceName
      });
    }
  }
  
  // Conectar instância
  async connectInstance(req, res) {
    try {
      const { instanceName } = req.params;
      
      logger.info('Conectando instância:', { instanceName });
      
      const result = await evolutionService.connectInstance(instanceName);
      
      // Atualizar status local
      await instanceService.updateStatus(instanceName, 'connecting');
      
      res.json({
        success: true,
        message: 'Instância conectada',
        instance: instanceName,
        data: result.data
      });
      
    } catch (error) {
      logger.error('Erro ao conectar instância:', {
        error: error.message,
        instanceName: req.params.instanceName
      });
      
      res.status(500).json({
        success: false,
        error: error.message,
        instance: req.params.instanceName
      });
    }
  }
  
  // Buscar instâncias
  async fetchInstances(req, res) {
    try {
      const { instanceName } = req.query;
      
      logger.info('Buscando instâncias:', { instanceName });
      
      // Buscar na Evolution API
      const evolutionResult = await evolutionService.fetchInstances(instanceName);
      
      // Buscar instâncias locais para enriquecer dados
      const localInstances = instanceName 
        ? [await instanceService.findByName(instanceName)].filter(Boolean)
        : await instanceService.findAll();
      
      // Combinar dados
      const instances = evolutionResult.instances.map(evolutionInstance => {
        const localInstance = localInstances.find(
          local => local.instance_name === evolutionInstance.instance?.instanceName
        );
        
        return {
          instance: {
            ...evolutionInstance.instance,
            localData: localInstance ? {
              id: localInstance.id,
              createdAt: localInstance.created_at,
              lastActivity: localInstance.last_activity,
              messageCount: localInstance.message_count || 0,
              settings: localInstance.settings || {}
            } : null
          }
        };
      });
      
      res.json(instances);
      
    } catch (error) {
      logger.error('Erro ao buscar instâncias:', {
        error: error.message,
        instanceName: req.query.instanceName
      });
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Obter estado da conexão
  async getConnectionState(req, res) {
    try {
      const { instanceName } = req.params;
      
      const result = await evolutionService.getInstanceStatus(instanceName);
      
      res.json({
        instance: {
          instanceName,
          state: result.state || 'unknown',
          ...result.data
        }
      });
      
    } catch (error) {
      logger.error('Erro ao obter estado da conexão:', {
        error: error.message,
        instanceName: req.params.instanceName
      });
      
      res.status(500).json({
        success: false,
        error: error.message,
        instance: req.params.instanceName
      });
    }
  }
  
  // Deletar instância
  async deleteInstance(req, res) {
    try {
      const { instanceName } = req.params;
      
      logger.info('Deletando instância:', { instanceName });
      
      // Deletar na Evolution API
      await evolutionService.deleteInstance(instanceName);
      
      // Deletar localmente
      await instanceService.delete(instanceName);
      
      res.json({
        success: true,
        message: 'Instância deletada com sucesso',
        instance: instanceName
      });
      
    } catch (error) {
      logger.error('Erro ao deletar instância:', {
        error: error.message,
        instanceName: req.params.instanceName
      });
      
      res.status(500).json({
        success: false,
        error: error.message,
        instance: req.params.instanceName
      });
    }
  }
  
  // Logout da instância
  async logoutInstance(req, res) {
    try {
      const { instanceName } = req.params;
      
      logger.info('Fazendo logout da instância:', { instanceName });
      
      // Por enquanto, usar o mesmo método de delete
      // Na Evolution API real, seria um endpoint diferente
      const result = await evolutionService.deleteInstance(instanceName);
      
      // Atualizar status local
      await instanceService.updateStatus(instanceName, 'disconnected');
      
      res.json({
        success: true,
        message: 'Logout realizado com sucesso',
        instance: instanceName,
        data: result.data
      });
      
    } catch (error) {
      logger.error('Erro ao fazer logout:', {
        error: error.message,
        instanceName: req.params.instanceName
      });
      
      res.status(500).json({
        success: false,
        error: error.message,
        instance: req.params.instanceName
      });
    }
  }
  
  // Reiniciar instância
  async restartInstance(req, res) {
    try {
      const { instanceName } = req.params;
      
      logger.info('Reiniciando instância:', { instanceName });
      
      // Atualizar status local
      await instanceService.updateStatus(instanceName, 'restarting');
      
      // Primeiro desconectar, depois reconectar
      try {
        await evolutionService.deleteInstance(instanceName);
      } catch (e) {
        // Ignorar erro de desconexão
      }
      
      const result = await evolutionService.connectInstance(instanceName);
      
      res.json({
        success: true,
        message: 'Instância reiniciada com sucesso',
        instance: instanceName,
        data: result.data
      });
      
    } catch (error) {
      logger.error('Erro ao reiniciar instância:', {
        error: error.message,
        instanceName: req.params.instanceName
      });
      
      res.status(500).json({
        success: false,
        error: error.message,
        instance: req.params.instanceName
      });
    }
  }
  
  // Configurar webhook
  async setWebhook(req, res) {
    try {
      const { instanceName } = req.params;
      
      const validation = validateData(setWebhookSchema, req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Dados inválidos',
          details: validation.error
        });
      }
      
      const webhookData = validation.data;
      
      // Usar URL de produção
      webhookData.url = webhookConfig.getWebhookUrl(instanceName);
      
      logger.info('Configurando webhook:', {
        instanceName,
        url: webhookData.url,
        events: webhookData.events
      });
      
      const result = await evolutionService.setWebhook(instanceName, webhookData);
      
      // Atualizar configuração local
      await instanceService.updateWebhook(instanceName, webhookData);
      
      res.status(201).json({
        webhook: {
          instanceName,
          webhook: {
            url: webhookData.url,
            events: webhookData.events,
            enabled: true,
            webhook_by_events: webhookData.webhook_by_events,
            webhook_base64: webhookData.webhook_base64
          }
        }
      });
      
    } catch (error) {
      logger.error('Erro ao configurar webhook:', {
        error: error.message,
        instanceName: req.params.instanceName
      });
      
      res.status(500).json({
        success: false,
        error: error.message,
        instance: req.params.instanceName
      });
    }
  }
  
  // Obter webhook
  async getWebhook(req, res) {
    try {
      const { instanceName } = req.params;
      
      const result = await evolutionService.getWebhook(instanceName);
      
      if (!result.success) {
        return res.status(404).json({
          success: false,
          error: 'Webhook não encontrado',
          instance: instanceName
        });
      }
      
      res.json({
        webhook: {
          instanceName,
          webhook: result.data
        }
      });
      
    } catch (error) {
      logger.error('Erro ao obter webhook:', {
        error: error.message,
        instanceName: req.params.instanceName
      });
      
      res.status(500).json({
        success: false,
        error: error.message,
        instance: req.params.instanceName
      });
    }
  }
  
  // Configurar settings
  async setSettings(req, res) {
    try {
      const { instanceName } = req.params;
      
      const validation = validateData(updateSettingsSchema, req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Dados inválidos',
          details: validation.error
        });
      }
      
      const settings = validation.data;
      
      logger.info('Configurando settings:', {
        instanceName,
        settings: Object.keys(settings)
      });
      
      const result = await evolutionService.setSettings(instanceName, settings);
      
      // Atualizar configuração local
      await instanceService.updateSettings(instanceName, settings);
      
      res.status(201).json({
        settings: {
          instanceName,
          settings: settings
        }
      });
      
    } catch (error) {
      logger.error('Erro ao configurar settings:', {
        error: error.message,
        instanceName: req.params.instanceName
      });
      
      res.status(500).json({
        success: false,
        error: error.message,
        instance: req.params.instanceName
      });
    }
  }
  
  // Obter settings
  async getSettings(req, res) {
    try {
      const { instanceName } = req.params;
      
      const instance = await instanceService.findByName(instanceName);
      
      if (!instance) {
        return res.status(404).json({
          success: false,
          error: 'Instância não encontrada',
          instance: instanceName
        });
      }
      
      res.json({
        settings: {
          instanceName,
          settings: instance.settings || {}
        }
      });
      
    } catch (error) {
      logger.error('Erro ao obter settings:', {
        error: error.message,
        instanceName: req.params.instanceName
      });
      
      res.status(500).json({
        success: false,
        error: error.message,
        instance: req.params.instanceName
      });
    }
  }
  
  // === MÉTODOS INTERNOS DO SERVIDOR ===
  
  // Listar instâncias internas
  async listInstances(req, res) {
    try {
      const instances = await instanceService.findAll();
      
      res.json({
        success: true,
        data: instances.map(instance => ({
          ...instance,
          serverUrl: `${req.protocol}://${req.get('host')}`
        }))
      });
      
    } catch (error) {
      logger.error('Erro ao listar instâncias:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Criar instância interna
  async createInternalInstance(req, res) {
    try {
      const instanceData = req.body;
      
      const instance = await instanceService.create(instanceData);
      
      res.status(201).json({
        success: true,
        data: instance,
        message: 'Instância criada com sucesso'
      });
      
    } catch (error) {
      logger.error('Erro ao criar instância interna:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Atualizar instância
  async updateInstance(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const instance = await instanceService.update(id, updateData);
      
      res.json({
        success: true,
        data: instance,
        message: 'Instância atualizada com sucesso'
      });
      
    } catch (error) {
      logger.error('Erro ao atualizar instância:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Deletar instância interna
  async deleteInternalInstance(req, res) {
    try {
      const { id } = req.params;
      
      await instanceService.deleteById(id);
      
      res.json({
        success: true,
        message: 'Instância deletada com sucesso'
      });
      
    } catch (error) {
      logger.error('Erro ao deletar instância interna:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Obter status da instância
  async getInstanceStatus(req, res) {
    try {
      const { id } = req.params;
      
      const instance = await instanceService.findById(id);
      if (!instance) {
        return res.status(404).json({
          success: false,
          error: 'Instância não encontrada'
        });
      }
      
      // Verificar status na Evolution API
      const evolutionStatus = await evolutionService.getInstanceStatus(instance.instance_name);
      
      res.json({
        success: true,
        data: {
          ...instance,
          evolutionStatus: evolutionStatus.data,
          currentState: evolutionStatus.state
        }
      });
      
    } catch (error) {
      logger.error('Erro ao obter status da instância:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Obter QR code
  async getQRCode(req, res) {
    try {
      const { id } = req.params;
      
      const instance = await instanceService.findById(id);
      if (!instance) {
        return res.status(404).json({
          success: false,
          error: 'Instância não encontrada'
        });
      }
      
      res.json({
        success: true,
        data: {
          instanceName: instance.instance_name,
          qrcode: instance.qr_code,
          pairingCode: instance.pairing_code,
          lastUpdated: instance.qr_updated_at
        }
      });
      
    } catch (error) {
      logger.error('Erro ao obter QR code:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Gerar QR code
  async generateQRCode(req, res) {
    try {
      const { instanceName } = req.params;
      
      // Conectar instância para gerar novo QR
      const result = await evolutionService.connectInstance(instanceName);
      
      res.json({
        success: true,
        data: {
          instanceName,
          qrcode: result.data?.qrcode,
          message: 'QR Code gerado, aguarde o webhook para atualização'
        }
      });
      
    } catch (error) {
      logger.error('Erro ao gerar QR code:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // === MÉTODOS DE INTEGRAÇÃO ===
  
  // Iniciar Typebot
  async startTypebot(req, res) {
    try {
      const { instanceName } = req.params;
      const { url, keyword, expire } = req.body;
      
      logger.info('Iniciando Typebot:', { instanceName, url, keyword, expire });
      
      // Atualizar no banco local
      await instanceService.updateIntegration(instanceName, {
        typebot_enabled: true,
        typebot_url: url,
        typebot_keyword: keyword,
        typebot_expire: expire
      });
      
      res.json({
        success: true,
        message: 'Typebot configurado com sucesso'
      });
    } catch (error) {
      logger.error('Erro ao configurar Typebot:', {
        error: error.message,
        instanceName: req.params.instanceName
      });
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Alterar status do Typebot
  async changeTypebotStatus(req, res) {
    try {
      const { instanceName } = req.params;
      const { enabled } = req.body;
      
      logger.info('Alterando status do Typebot:', { instanceName, enabled });
      
      // Atualizar no banco local
      await instanceService.updateIntegration(instanceName, {
        typebot_enabled: enabled
      });
      
      res.json({
        success: true,
        message: `Typebot ${enabled ? 'ativado' : 'desativado'} com sucesso`
      });
    } catch (error) {
      logger.error('Erro ao alterar status do Typebot:', {
        error: error.message,
        instanceName: req.params.instanceName
      });
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Configurar Chatwoot
  async setupChatwoot(req, res) {
    try {
      const { instanceName } = req.params;
      const { url, token, inbox_id } = req.body;
      
      logger.info('Configurando Chatwoot:', { instanceName });
      
      // Atualizar no banco local
      await instanceService.updateIntegration(instanceName, {
        chatwoot_enabled: true,
        chatwoot_url: url,
        chatwoot_token: token,
        chatwoot_inbox_id: inbox_id
      });
      
      res.json({
        success: true,
        message: 'Chatwoot configurado com sucesso'
      });
    } catch (error) {
      logger.error('Erro ao configurar Chatwoot:', {
        error: error.message,
        instanceName: req.params.instanceName
      });
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Obter status do Chatwoot
  async getChatwootStatus(req, res) {
    try {
      const { instanceName } = req.params;
      
      // Buscar instância
      const instance = await instanceService.findByName(instanceName);
      if (!instance) {
        return res.status(404).json({
          success: false,
          error: 'Instância não encontrada'
        });
      }
      
      // Verificar configuração do Chatwoot
      const chatwootConfig = instance.integrations?.chatwoot || {};
      
      res.json({
        success: true,
        data: {
          enabled: !!chatwootConfig.chatwoot_enabled,
          url: chatwootConfig.chatwoot_url || null,
          inbox_id: chatwootConfig.chatwoot_inbox_id || null,
          connected: !!chatwootConfig.chatwoot_enabled && !!chatwootConfig.chatwoot_url
        }
      });
      
    } catch (error) {
      logger.error('Erro ao obter status do Chatwoot:', {
        error: error.message,
        instanceName: req.params.instanceName
      });
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Configurar RabbitMQ
  async setupRabbitMQ(req, res) {
    try {
      const { instanceName } = req.params;
      const { url, queue } = req.body;
      
      // Atualizar no banco local
      await instanceService.updateIntegration(instanceName, {
        rabbitmq_enabled: true,
        rabbitmq_url: url,
        rabbitmq_queue: queue
      });
      
      res.json({
        success: true,
        message: 'RabbitMQ configurado com sucesso'
      });
    } catch (error) {
      logger.error('Erro ao configurar RabbitMQ:', {
        error: error.message,
        instanceName: req.params.instanceName
      });
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Configurar SQS
  async setupSQS(req, res) {
    try {
      const { instanceName } = req.params;
      const { queue_url, region, access_key, secret_key } = req.body;
      
      // Atualizar no banco local
      await instanceService.updateIntegration(instanceName, {
        sqs_enabled: true,
        sqs_queue_url: queue_url,
        sqs_region: region,
        sqs_access_key: access_key,
        sqs_secret_key: secret_key
      });
      
      res.json({
        success: true,
        message: 'SQS configurado com sucesso'
      });
    } catch (error) {
      logger.error('Erro ao configurar SQS:', {
        error: error.message,
        instanceName: req.params.instanceName
      });
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Configurar WebSocket
  async setupWebSocket(req, res) {
    try {
      const { instanceName } = req.params;
      const { enabled } = req.body;
      
      // Atualizar no banco local
      await instanceService.updateIntegration(instanceName, {
        websocket_enabled: enabled
      });
      
      res.json({
        success: true,
        message: `WebSocket ${enabled ? 'ativado' : 'desativado'} com sucesso`
      });
    } catch (error) {
      logger.error('Erro ao configurar WebSocket:', {
        error: error.message,
        instanceName: req.params.instanceName
      });
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new InstanceController(); 
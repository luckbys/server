const logger = require('./logger');

// Configuração do webhook
const webhookConfig = {
  // URL base do webhook em produção
  baseUrl: process.env.WEBHOOK_BASE_URL || 'https://webhook.bkcrm.devsible.com.br',
  
  // Gerar URL completa do webhook para uma instância
  getWebhookUrl: (instanceName) => {
    return `${webhookConfig.baseUrl}/api/webhook/evolution/${instanceName}`;
  }
};

module.exports = webhookConfig; 
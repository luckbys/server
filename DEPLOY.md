# 🚀 Guia de Deploy - Evolution Webhook Server

## ✅ Status do Build Corrigido

O erro no Docker build foi corrigido! As principais mudanças:

### 🔧 Problemas Resolvidos:
1. **npm ci --omit=dev** → **npm install --only=production** (melhor compatibilidade Docker)
2. **package.json simplificado** com dependências essenciais apenas
3. **package-lock.json regenerado** para consistência
4. **Multi-stage build** simplificado para single-stage
5. **Health check** melhorado com timeouts adequados
6. **Script de produção** robusto com error handling
7. **.dockerignore** otimizado para builds rápidos

## 📦 Dependências Simplificadas

O `package.json` foi otimizado para incluir apenas as dependências essenciais:

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.7.4", 
    "cors": "^2.8.5",
    "winston": "^3.11.0",
    "axios": "^1.6.7"
  }
}
```

**Removidas**: PostgreSQL, Redis, RabbitMQ, TypeScript e outras dependências complexas para reduzir problemas de build e acelerar deploys.

## 🐳 Deploy com Docker

### Build e Run Local:
```bash
# Build da imagem
docker build -t evolution-webhook-server .

# Run local para teste
docker run -p 3001:3001 \
  -e NODE_ENV=production \
  -e PORT=3001 \
  -e WEBHOOK_BASE_URL=https://webhook.bkcrm.devsible.com.br \
  evolution-webhook-server
```

### Deploy Easypanel/Produção:
```bash
# As variáveis de ambiente serão passadas automaticamente pelo Easypanel:
# - NODE_ENV=production
# - PORT=3001
# - WEBHOOK_BASE_URL=https://webhook.bkcrm.devsible.com.br/api
# - WEBHOOK_SECRET=prod_secret_123
# - ALLOWED_ORIGINS=*
```

## 🔧 Configuração da Evolution API

Configure o webhook na Evolution API para:

```json
{
  "webhook": {
    "url": "https://webhook.bkcrm.devsible.com.br/api/webhook/evolution/SUA_INSTANCIA",
    "enabled": true,
    "events": [
      "MESSAGES_UPSERT",
      "CONNECTION_UPDATE",
      "QRCODE_UPDATED"
    ]
  }
}
```

## 📋 Endpoints em Produção

- **API Root**: `https://webhook.bkcrm.devsible.com.br/`
- **Health Check**: `https://webhook.bkcrm.devsible.com.br/api/health`
- **Webhook Endpoint**: `https://webhook.bkcrm.devsible.com.br/api/webhook/evolution/:instanceName`
- **Stats**: `https://webhook.bkcrm.devsible.com.br/api/stats`

## ✅ Verificação de Deploy

Após o deploy, teste:

```bash
# 1. Health check
curl https://webhook.bkcrm.devsible.com.br/api/health

# 2. API info
curl https://webhook.bkcrm.devsible.com.br/

# 3. Teste de webhook (opcional)
curl -X POST https://webhook.bkcrm.devsible.com.br/api/webhook/evolution/test \
  -H "Content-Type: application/json" \
  -d '{"event": "MESSAGES_UPSERT", "data": {"test": true}}'
```

## 🔍 Logs e Monitoramento

```bash
# Ver logs do container
docker logs <container-id> -f

# Verificar health status
docker inspect <container-id> | grep Health -A 10
```

## 🚨 Troubleshooting

### Container não inicia:
```bash
# Verificar logs
docker logs <container-id>

# Executar interativamente para debug
docker run -it evolution-webhook-server /bin/sh
```

### Health check falhando:
```bash
# Testar health check manualmente
docker exec <container-id> curl -f http://localhost:3001/api/health
```

### Evolution API não consegue enviar webhooks:
1. Verificar se a URL está correta
2. Verificar se o container está rodando na porta 3001
3. Verificar logs para erros de rede/CORS
4. Testar com curl manual

## 📊 Performance Esperada

- **Startup time**: ~5-10 segundos
- **Memory usage**: ~50-100MB
- **Response time**: <100ms
- **Throughput**: 1000+ webhooks/minuto

## 🔄 Atualizações

Para atualizar o servidor:

1. Fazer push do código
2. Rebuild automático no Easypanel
3. Health check automático
4. Deploy zero-downtime

## 📝 Variáveis de Ambiente em Produção

```env
NODE_ENV=production
PORT=3001
LOG_LEVEL=info
WEBHOOK_BASE_URL=https://webhook.bkcrm.devsible.com.br
WEBHOOK_SECRET=prod_secret_123
ALLOWED_ORIGINS=*
```

**⚠️ Importante**: O servidor usa `src/server-simple.js` que é estável e testado, não requer PostgreSQL/Redis/RabbitMQ em produção básica. 
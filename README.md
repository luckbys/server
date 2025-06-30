# Evolution Webhook Server 🚀

Servidor Express.js completo para integração com Evolution API e WhatsApp, incluindo gerenciamento de tickets, clientes, mensagens e WebSocket em tempo real.

## ✨ Características

- 🔗 **Integração completa com Evolution API**
- 💬 **Sistema de tickets e mensagens**
- 👥 **Gerenciamento de clientes**
- 🔌 **WebSocket em tempo real**
- 📊 **Dashboard com estatísticas**
- 🛡️ **Segurança avançada**
- 📝 **Logs detalhados**
- 🗄️ **Integração com Supabase**

## 🛠️ Stack Tecnológica

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **WebSocket**: Socket.IO
- **Database**: Supabase (PostgreSQL)
- **Validação**: Zod
- **Logs**: Winston
- **Segurança**: Helmet, CORS, Rate Limiting

## 📋 Pré-requisitos

- Node.js 18 ou superior
- NPM ou Yarn
- Conta no Supabase
- Evolution API rodando

## 🚀 Instalação

1. **Clone o repositório**
```bash
git clone <repository-url>
cd server
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**
```bash
cp .env.example .env
```

4. **Configure o arquivo .env**
```env
# Configurações do Servidor
PORT=3000
NODE_ENV=development

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key

# Webhook Security
WEBHOOK_SECRET=your_webhook_secret_key

# Evolution API
EVOLUTION_API_BASE_URL=http://localhost:8080
EVOLUTION_DEFAULT_API_KEY=your_evolution_api_key

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

5. **Configure o banco de dados**

Execute os SQLs no Supabase para criar as tabelas:

```sql
-- Perfis de usuários/clientes
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT,
  role TEXT CHECK (role IN ('admin', 'agent', 'customer')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tickets/Conversas
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  status TEXT CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  customer_id UUID REFERENCES profiles(id),
  agent_id UUID REFERENCES profiles(id),
  department_id UUID,
  channel TEXT CHECK (channel IN ('whatsapp', 'email', 'chat')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Mensagens
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES tickets(id),
  content TEXT,
  sender_id UUID REFERENCES profiles(id),
  sender_name TEXT,
  sender_type TEXT CHECK (sender_type IN ('agent', 'customer', 'system')),
  message_type TEXT CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document')),
  is_internal BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Instâncias Evolution API
CREATE TABLE evolution_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE,
  instance_name TEXT,
  api_url TEXT,
  api_key TEXT,
  webhook_url TEXT,
  status TEXT CHECK (status IN ('connected', 'disconnected', 'error')),
  department_id UUID,
  is_default BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

6. **Inicie o servidor**
```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

## 📡 API Endpoints

### 🔧 Sistema
- `GET /api/health` - Health check
- `GET /api/info` - Informações da API
- `GET /api/stats` - Estatísticas gerais

### 📱 Instâncias
- `GET /api/instances` - Listar instâncias
- `POST /api/instances` - Criar instância
- `PUT /api/instances/:id` - Atualizar instância
- `DELETE /api/instances/:id` - Deletar instância
- `GET /api/instances/:id/status` - Status da instância
- `GET /api/instances/:id/qrcode` - QR Code da instância

### 💬 Mensagens
- `POST /api/send-message` - Enviar mensagem
- `GET /api/messages/ticket/:ticketId` - Mensagens do ticket
- `PUT /api/messages/:messageId/read` - Marcar como lida

### 🪝 Webhooks
- `POST /api/webhook/evolution/:instanceName` - Webhook da Evolution API

## 🔌 WebSocket Events

### 📨 Eventos Recebidos
- `new-message` - Nova mensagem recebida
- `ticket-created` - Novo ticket criado
- `ticket-updated` - Ticket atualizado
- `instance-status` - Status da instância mudou
- `qr-updated` - QR Code atualizado

### 📤 Eventos Enviados
- `subscribe-ticket` - Subscrever a ticket
- `subscribe-instance` - Subscrever a instância
- `typing` - Cliente digitando
- `ping` - Manter conexão ativa

## 🛡️ Segurança

### Headers de Segurança
- Helmet configurado
- CORS restritivo
- Rate limiting
- Validação de webhook signature

### Validação de Dados
- Esquemas Zod para todos os endpoints
- Sanitização de inputs
- Validação de tipos de arquivo

## 📊 Logs e Monitoramento

### Estrutura de Logs
```json
{
  "level": "info|warn|error",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "evolution-webhook",
  "message": "Mensagem do log",
  "metadata": {}
}
```

### Arquivos de Log
- `logs/app.log` - Todos os logs
- `logs/error.log` - Apenas erros

## 🚀 Fluxo de Processamento

### 1. Recebimento de Webhook
1. Webhook recebido da Evolution API
2. Validação de assinatura
3. Identificação do tipo de evento
4. Processamento baseado no evento

### 2. Processamento de Mensagem
1. Validação dos dados da mensagem
2. Busca ou criação do cliente
3. Busca ou criação do ticket
4. Salvamento da mensagem
5. Emissão via WebSocket

### 3. Gerenciamento de Instâncias
1. Registro de instâncias
2. Monitoramento de status
3. Atualização automática
4. Notificações em tempo real

## 🧪 Testes

```bash
# Executar testes
npm test

# Executar testes em modo watch
npm run test:watch
```

## 📦 Estrutura do Projeto

```
server/
├── src/
│   ├── config/          # Configurações
│   │   ├── logger.js
│   │   ├── supabase.js
│   │   ├── validation.js
│   │   └── websocket.js
│   ├── controllers/     # Controladores
│   │   ├── instanceController.js
│   │   ├── messageController.js
│   │   ├── statsController.js
│   │   └── webhookController.js
│   ├── middleware/      # Middlewares
│   │   └── security.js
│   ├── routes/         # Rotas
│   │   └── index.js
│   ├── services/       # Serviços
│   │   ├── customerService.js
│   │   ├── evolutionService.js
│   │   ├── instanceService.js
│   │   ├── messageService.js
│   │   └── ticketService.js
│   └── server.js       # Servidor principal
├── logs/              # Arquivos de log
├── uploads/           # Uploads de mídia
├── package.json
├── .env.example
└── README.md
```

## 🔧 Configuração da Evolution API

1. Configure o webhook na Evolution API:
```json
{
  "webhook": {
    "url": "http://localhost:3001/api",
    "enabled": true
  }
}
```

2. Verifique se a instância está conectada:
```
GET http://localhost:3001/api/instance/fetchInstances
```

## 📊 WebSocket

O servidor também disponibiliza eventos via WebSocket em:
```
ws://localhost:3001
```

## 🛠️ Scripts Disponíveis

- `npm run dev`: Inicia o servidor em modo desenvolvimento
- `npm run simple`: Inicia o servidor em modo simplificado
- `npm run test:evolution`: Testa a compatibilidade com Evolution API
- `npm test`: Executa os testes unitários

## 📝 Eventos Suportados

- `MESSAGES_UPSERT`: Novas mensagens
- `CONNECTION_UPDATE`: Atualizações de conexão
- `QRCODE_UPDATED`: QR Code atualizado
- `APPLICATION_STARTUP`: Inicialização da aplicação
- `CONTACTS_UPSERT`: Atualização de contatos
- `CHATS_UPSERT`: Atualização de chats
- `GROUPS_UPSERT`: Atualização de grupos
- `PRESENCE_UPDATE`: Atualização de presença
- `CALL`: Chamadas
- `TYPEBOT_START`: Início de fluxo Typebot

## 🔒 Variáveis de Ambiente

```env
NODE_ENV=development
PORT=3001
WEBHOOK_SECRET=seu_secret
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
WEBHOOK_BASE_URL=http://localhost:3001
```

## 📦 Dependências Principais

- Express.js
- Socket.IO
- Axios
- Winston (Logs)
- CORS

## 🤝 Contribuindo

1. Faça o fork do projeto
2. Crie sua feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a licença ISC.

## 📞 Suporte

Para suporte, entre em contato através dos issues do GitHub.

---

**Feito com ❤️ para integração WhatsApp/Evolution API** 
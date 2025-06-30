# 🌐 Integração Frontend ↔ Backend - Evolution Webhook Server

## 🚀 Visão Geral

O servidor webhook pode se comunicar com o frontend através de:
1. **WebSocket** (tempo real) - Recomendado
2. **API REST** (consultas pontuais)
3. **Server-Sent Events** (streaming)

## 📡 1. WebSocket (Tempo Real)

### Backend (Já Configurado)
O servidor já possui WebSocket na porta 3001:

```javascript
// Servidor emite eventos para clientes conectados
io.emit('new-message', {
  instance: 'minha-instancia',
  message: messageData,
  timestamp: new Date()
});

io.emit('connection-update', {
  instance: 'minha-instancia', 
  status: 'connected',
  qrCode: null
});
```

### Frontend (React/Next.js)
```javascript
// install: npm install socket.io-client

import { io } from 'socket.io-client';
import { useEffect, useState } from 'react';

function ChatComponent() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  useEffect(() => {
    // Conectar ao WebSocket
    const newSocket = io('https://webhook.bkcrm.devsible.com.br', {
      transports: ['websocket'],
      cors: {
        origin: "*"
      }
    });

    // Eventos de conexão
    newSocket.on('connect', () => {
      console.log('✅ Conectado ao webhook server');
      setConnectionStatus('connected');
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Desconectado do webhook server');
      setConnectionStatus('disconnected');
    });

    // Escutar mensagens do WhatsApp
    newSocket.on('new-message', (data) => {
      console.log('📨 Nova mensagem:', data);
      setMessages(prev => [...prev, data]);
    });

    // Escutar atualizações de conexão
    newSocket.on('connection-update', (data) => {
      console.log('🔗 Status atualizado:', data);
      if (data.qrCode) {
        // Mostrar QR Code no frontend
        showQRCode(data.qrCode);
      }
    });

    setSocket(newSocket);

    return () => newSocket.close();
  }, []);

  return (
    <div>
      <div>Status: {connectionStatus}</div>
      <div>
        {messages.map((msg, index) => (
          <div key={index}>
            <strong>{msg.pushName}:</strong> {msg.message}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Frontend (Vue.js)
```javascript
// install: npm install socket.io-client

import { io } from 'socket.io-client';

export default {
  data() {
    return {
      socket: null,
      messages: [],
      connectionStatus: 'disconnected'
    }
  },
  mounted() {
    this.socket = io('https://webhook.bkcrm.devsible.com.br');
    
    this.socket.on('connect', () => {
      this.connectionStatus = 'connected';
    });

    this.socket.on('new-message', (data) => {
      this.messages.push(data);
    });

    this.socket.on('connection-update', (data) => {
      if (data.qrCode) {
        this.showQRCode(data.qrCode);
      }
    });
  },
  beforeDestroy() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}
```

## 🔄 2. API REST

### Endpoints Disponíveis
```javascript
// Buscar status de saúde
GET https://webhook.bkcrm.devsible.com.br/api/health

// Buscar estatísticas  
GET https://webhook.bkcrm.devsible.com.br/api/stats

// Buscar instâncias
GET https://webhook.bkcrm.devsible.com.br/api/instance/fetchInstances

// Enviar mensagem (se implementado)
POST https://webhook.bkcrm.devsible.com.br/api/send-message
```

### Frontend (Fetch/Axios)
```javascript
// React Hook personalizado
import { useState, useEffect } from 'react';

function useWebhookAPI() {
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);

  const baseURL = 'https://webhook.bkcrm.devsible.com.br/api';

  // Buscar estatísticas
  const fetchStats = async () => {
    try {
      const response = await fetch(`${baseURL}/stats`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Erro ao buscar stats:', error);
    }
  };

  // Verificar saúde do servidor
  const checkHealth = async () => {
    try {
      const response = await fetch(`${baseURL}/health`);
      const data = await response.json();
      setHealth(data);
    } catch (error) {
      console.error('Erro no health check:', error);
    }
  };

  useEffect(() => {
    fetchStats();
    checkHealth();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(() => {
      fetchStats();
      checkHealth();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return { stats, health, fetchStats, checkHealth };
}

// Usar no componente
function Dashboard() {
  const { stats, health } = useWebhookAPI();

  return (
    <div>
      <h2>Server Status: {health?.status}</h2>
      <h3>Mensagens processadas: {stats?.totalMessages}</h3>
    </div>
  );
}
```

## 🎯 3. Implementação Completa (React + Socket.io)

### Hook Personalizado
```javascript
// hooks/useEvolutionWebhook.js
import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

export function useEvolutionWebhook() {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [instances, setInstances] = useState({});
  const [qrCodes, setQrCodes] = useState({});

  useEffect(() => {
    const newSocket = io('https://webhook.bkcrm.devsible.com.br', {
      transports: ['websocket']
    });

    // Eventos de conexão
    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('✅ Conectado ao Evolution Webhook Server');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('❌ Desconectado do Evolution Webhook Server');
    });

    // Eventos do WhatsApp
    newSocket.on('new-message', (data) => {
      setMessages(prev => [data, ...prev].slice(0, 100)); // Manter últimas 100
    });

    newSocket.on('connection-update', (data) => {
      setInstances(prev => ({
        ...prev,
        [data.instance]: {
          ...prev[data.instance],
          status: data.status,
          lastUpdate: new Date()
        }
      }));
    });

    newSocket.on('qr-updated', (data) => {
      setQrCodes(prev => ({
        ...prev,
        [data.instance]: data.qrCode
      }));
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const sendMessage = useCallback(async (instanceName, to, message) => {
    if (!socket) return false;
    
    try {
      // Emitir para o servidor via WebSocket
      socket.emit('send-message', {
        instance: instanceName,
        to,
        message
      });
      return true;
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      return false;
    }
  }, [socket]);

  return {
    isConnected,
    messages,
    instances,
    qrCodes,
    sendMessage
  };
}
```

### Componente de Chat
```javascript
// components/WhatsAppDashboard.jsx
import { useEvolutionWebhook } from '../hooks/useEvolutionWebhook';

function WhatsAppDashboard() {
  const { 
    isConnected, 
    messages, 
    instances, 
    qrCodes, 
    sendMessage 
  } = useEvolutionWebhook();

  return (
    <div className="dashboard">
      {/* Status de Conexão */}
      <div className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
        {isConnected ? '🟢 Conectado' : '🔴 Desconectado'}
      </div>

      {/* QR Codes */}
      <div className="qr-codes">
        {Object.entries(qrCodes).map(([instance, qr]) => (
          <div key={instance}>
            <h3>QR Code - {instance}</h3>
            <img src={qr} alt={`QR Code ${instance}`} />
          </div>
        ))}
      </div>

      {/* Status das Instâncias */}
      <div className="instances">
        <h3>Instâncias</h3>
        {Object.entries(instances).map(([name, info]) => (
          <div key={name} className="instance">
            <span>{name}</span>
            <span className={info.status}>{info.status}</span>
          </div>
        ))}
      </div>

      {/* Mensagens */}
      <div className="messages">
        <h3>Mensagens Recentes</h3>
        {messages.map((msg, index) => (
          <div key={index} className="message">
            <strong>{msg.pushName || msg.from}</strong>
            <p>{msg.message?.conversation || 'Mensagem de mídia'}</p>
            <small>{new Date(msg.timestamp).toLocaleString()}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

export default WhatsAppDashboard;
```

## 🔧 4. Melhorar o Backend para Frontend

Vou adicionar eventos específicos para o frontend no seu servidor:

```javascript
// Adicionar ao src/server-simple.js
app.post('/api/webhook/evolution/:instanceName', (req, res) => {
  // ... código existente ...
  
  // Emitir para frontend conectado
  if (req.body.event === 'MESSAGES_UPSERT') {
    io.emit('new-message', {
      instance: instanceName,
      messages: req.body.data,
      timestamp: new Date(),
      event: req.body.event
    });
  }

  if (req.body.event === 'CONNECTION_UPDATE') {
    io.emit('connection-update', {
      instance: instanceName,
      status: req.body.data?.state,
      timestamp: new Date()
    });
  }

  if (req.body.event === 'QRCODE_UPDATED') {
    io.emit('qr-updated', {
      instance: instanceName,
      qrCode: req.body.data?.qrcode,
      timestamp: new Date()
    });
  }
});
```

## 📦 Dependências Frontend

```json
{
  "dependencies": {
    "socket.io-client": "^4.7.4",
    "axios": "^1.6.7"
  }
}
```

## 🚀 5. Novos Endpoints REST Disponíveis

```javascript
// Estatísticas do servidor
GET https://webhook.bkcrm.devsible.com.br/api/stats

// Enviar mensagem via API
POST https://webhook.bkcrm.devsible.com.br/api/send-message
{
  "instance": "minha-instancia",
  "to": "5511999999999@s.whatsapp.net",
  "message": "Olá!",
  "type": "text"
}

// Buscar mensagens de uma instância
GET https://webhook.bkcrm.devsible.com.br/api/messages/minha-instancia?limit=50&offset=0
```

## 📡 6. Eventos WebSocket Específicos

O servidor agora emite eventos organizados:

```javascript
// Eventos que o servidor emite:
socket.on('new-message', (data) => {
  // Nova mensagem recebida
  console.log(data.content, data.pushName, data.instance);
});

socket.on('connection-update', (data) => {
  // Status de conexão atualizado
  console.log(data.instance, data.status);
});

socket.on('qr-updated', (data) => {
  // QR Code atualizado
  console.log(data.qrCode, data.instance);
});

socket.on('server-status', (data) => {
  // Status inicial do servidor
  console.log('Server online:', data.uptime);
});

// Eventos que você pode enviar:
socket.emit('join-instance', 'minha-instancia');
socket.emit('ping'); // Keepalive
socket.emit('get-instance-status', 'minha-instancia');
```

## 🧪 7. Teste Rápido (Arquivo HTML)

Criado `frontend-example.html` para testar a integração:

```bash
# 1. Iniciar o servidor
node start-production.js

# 2. Abrir o arquivo frontend-example.html no navegador
# 3. Testar os controles:
#    - Conectar à instância
#    - Simular mensagem
#    - Ver estatísticas
#    - Ping do servidor
```

## 🎯 8. Implementação Production-Ready

### React Hook Otimizado
```javascript
import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

export function useEvolutionAPI(serverUrl = 'https://webhook.bkcrm.devsible.com.br') {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [instances, setInstances] = useState({});
  const [qrCodes, setQrCodes] = useState({});
  const [serverStats, setServerStats] = useState(null);

  // API REST methods
  const api = {
    async getStats() {
      const response = await fetch(`${serverUrl}/api/stats`);
      return response.json();
    },
    
    async sendMessage(instance, to, message, type = 'text') {
      const response = await fetch(`${serverUrl}/api/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance, to, message, type })
      });
      return response.json();
    },
    
    async getMessages(instance, limit = 50, offset = 0) {
      const response = await fetch(`${serverUrl}/api/messages/${instance}?limit=${limit}&offset=${offset}`);
      return response.json();
    }
  };

  // WebSocket setup
  useEffect(() => {
    const newSocket = io(serverUrl, { transports: ['websocket'] });

    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => setIsConnected(false));
    
    newSocket.on('new-message', (data) => {
      setMessages(prev => [data, ...prev].slice(0, 100));
    });
    
    newSocket.on('connection-update', (data) => {
      setInstances(prev => ({
        ...prev,
        [data.instance]: { ...prev[data.instance], ...data }
      }));
    });
    
    newSocket.on('qr-updated', (data) => {
      setQrCodes(prev => ({ ...prev, [data.instance]: data.qrCode }));
    });

    setSocket(newSocket);
    return () => newSocket.close();
  }, [serverUrl]);

  // Methods
  const joinInstance = useCallback((instanceName) => {
    if (socket) socket.emit('join-instance', instanceName);
  }, [socket]);

  const refreshStats = useCallback(async () => {
    try {
      const stats = await api.getStats();
      setServerStats(stats);
    } catch (error) {
      console.error('Erro ao buscar stats:', error);
    }
  }, []);

  return {
    // Estado
    isConnected,
    messages,
    instances,
    qrCodes,
    serverStats,
    
    // Métodos WebSocket
    joinInstance,
    
    // Métodos API REST
    api,
    refreshStats
  };
}
```

### Componente Dashboard Completo
```javascript
import React, { useEffect } from 'react';
import { useEvolutionAPI } from './hooks/useEvolutionAPI';

function EvolutionDashboard() {
  const {
    isConnected,
    messages,
    instances,
    qrCodes,
    serverStats,
    joinInstance,
    api,
    refreshStats
  } = useEvolutionAPI();

  useEffect(() => {
    refreshStats();
    joinInstance('minha-instancia');
  }, []);

  const handleSendMessage = async () => {
    try {
      await api.sendMessage('minha-instancia', '5511999999999@s.whatsapp.net', 'Olá!');
      alert('Mensagem enviada!');
    } catch (error) {
      alert('Erro ao enviar mensagem');
    }
  };

  return (
    <div className="dashboard">
      {/* Status */}
      <div className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
        {isConnected ? '🟢 Conectado' : '🔴 Desconectado'}
      </div>

      {/* Estatísticas */}
      {serverStats && (
        <div className="stats">
          <h3>📊 Estatísticas do Servidor</h3>
          <p>Uptime: {Math.floor(serverStats.server.uptime)}s</p>
          <p>Memória: {Math.round(serverStats.server.memory.rss / 1024 / 1024)}MB</p>
          <p>Clientes WebSocket: {serverStats.websocket.connectedClients}</p>
        </div>
      )}

      {/* QR Codes */}
      <div className="qr-section">
        <h3>📱 QR Codes</h3>
        {Object.entries(qrCodes).map(([instance, qr]) => (
          <div key={instance}>
            <h4>{instance}</h4>
            <img src={qr} alt={`QR ${instance}`} style={{maxWidth: '200px'}} />
          </div>
        ))}
      </div>

      {/* Controles */}
      <div className="controls">
        <button onClick={() => joinInstance('nova-instancia')}>
          Conectar Nova Instância
        </button>
        <button onClick={handleSendMessage}>
          Enviar Mensagem Teste
        </button>
        <button onClick={refreshStats}>
          Atualizar Stats
        </button>
      </div>

      {/* Mensagens */}
      <div className="messages">
        <h3>💬 Mensagens Recentes</h3>
        {messages.map((msg, index) => (
          <div key={index} className="message">
            <strong>{msg.pushName || msg.from}</strong>
            <p>{msg.content}</p>
            <small>{new Date(msg.timestamp).toLocaleString()}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

export default EvolutionDashboard;
```

## 🎯 Próximos Passos

1. ✅ **Servidor configurado** com eventos WebSocket específicos
2. ✅ **Endpoints REST** para integração completa
3. ✅ **Exemplo HTML** funcional criado
4. **Escolher stack frontend** (React, Vue, Angular)
5. **Implementar design system** seguindo as regras BKCRM
6. **Adicionar autenticação** se necessário
7. **Deploy frontend** em produção

**🔗 URLs de Teste:**
- Servidor: `http://localhost:3001`
- Frontend exemplo: Abrir `frontend-example.html` no navegador
- API: `http://localhost:3001/api/stats`

Agora seu servidor está **100% pronto** para comunicação com qualquer frontend! 
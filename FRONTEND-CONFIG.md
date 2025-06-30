# 🎯 Configuração Frontend - Evolution Webhook Integration

## 📋 Pré-requisitos

- Node.js 16+ instalado
- Frontend já configurado (React, Vue, Angular, etc.)
- Acesso ao servidor webhook: `https://webhook.bkcrm.devsible.com.br`

## 📦 1. Instalação de Dependências

```bash
# Para comunicação WebSocket em tempo real
npm install socket.io-client

# Para requisições HTTP (se não tiver)
npm install axios
# ou usar fetch nativo do browser
```

## ⚙️ 2. Configuração de URLs

### Arquivo de configuração (config.js)
```javascript
// config/api.js
const config = {
  development: {
    API_BASE_URL: 'http://localhost:3001/api',
    WEBSOCKET_URL: 'http://localhost:3001'
  },
  production: {
    API_BASE_URL: 'https://webhook.bkcrm.devsible.com.br/api',
    WEBSOCKET_URL: 'https://webhook.bkcrm.devsible.com.br'
  }
};

const isDevelopment = process.env.NODE_ENV === 'development';
export const API_CONFIG = isDevelopment ? config.development : config.production;
```

## 🔌 3. Configuração WebSocket (Tempo Real)

### React Hook - useEvolutionWebhook.js
```javascript
// hooks/useEvolutionWebhook.js
import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { API_CONFIG } from '../config/api';

export function useEvolutionWebhook() {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [instances, setInstances] = useState({});
  const [qrCodes, setQrCodes] = useState({});

  useEffect(() => {
    // Conectar ao WebSocket
    const newSocket = io(API_CONFIG.WEBSOCKET_URL, {
      transports: ['websocket'],
      timeout: 5000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    // Eventos de conexão
    newSocket.on('connect', () => {
      console.log('✅ Conectado ao Evolution Webhook Server');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Desconectado do Evolution Webhook Server');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Erro de conexão WebSocket:', error);
    });

    // Status inicial do servidor
    newSocket.on('server-status', (data) => {
      console.log('📊 Status do servidor:', data);
    });

    // Nova mensagem recebida
    newSocket.on('new-message', (data) => {
      console.log('📨 Nova mensagem:', data);
      setMessages(prev => {
        // Evitar duplicatas
        const exists = prev.some(msg => msg.id === data.id);
        if (!exists) {
          return [data, ...prev].slice(0, 100); // Manter últimas 100 mensagens
        }
        return prev;
      });
    });

    // Atualização de conexão de instância
    newSocket.on('connection-update', (data) => {
      console.log('🔗 Status de conexão:', data);
      setInstances(prev => ({
        ...prev,
        [data.instance]: {
          ...prev[data.instance],
          status: data.status,
          statusReason: data.statusReason,
          lastUpdate: new Date()
        }
      }));
    });

    // QR Code atualizado
    newSocket.on('qr-updated', (data) => {
      console.log('📱 QR Code atualizado:', data.instance);
      if (data.qrCode) {
        setQrCodes(prev => ({
          ...prev,
          [data.instance]: data.qrCode
        }));
      }
    });

    // Startup da aplicação
    newSocket.on('application-startup', (data) => {
      console.log('🚀 Aplicação iniciada:', data.instance);
      setInstances(prev => ({
        ...prev,
        [data.instance]: {
          ...prev[data.instance],
          status: 'started',
          lastUpdate: new Date()
        }
      }));
    });

    // Eventos genéricos
    newSocket.on('generic-event', (data) => {
      console.log('📨 Evento genérico:', data.event, data.instance);
    });

    setSocket(newSocket);

    // Cleanup
    return () => {
      newSocket.close();
    };
  }, []);

  // Métodos para interagir com o WebSocket
  const joinInstance = useCallback((instanceName) => {
    if (socket && instanceName) {
      socket.emit('join-instance', instanceName);
      console.log(`🔌 Entrando na sala da instância: ${instanceName}`);
    }
  }, [socket]);

  const leaveInstance = useCallback((instanceName) => {
    if (socket && instanceName) {
      socket.emit('leave-instance', instanceName);
      console.log(`🔌 Saindo da sala da instância: ${instanceName}`);
    }
  }, [socket]);

  const pingServer = useCallback(() => {
    if (socket) {
      socket.emit('ping');
    }
  }, [socket]);

  const getInstanceStatus = useCallback((instanceName) => {
    if (socket && instanceName) {
      socket.emit('get-instance-status', instanceName);
    }
  }, [socket]);

  return {
    // Estado
    isConnected,
    messages,
    instances,
    qrCodes,
    
    // Métodos
    joinInstance,
    leaveInstance,
    pingServer,
    getInstanceStatus,
    
    // Socket raw (para uso avançado)
    socket
  };
}
```

### Vue Composable - useEvolutionWebhook.js
```javascript
// composables/useEvolutionWebhook.js
import { ref, onMounted, onUnmounted } from 'vue';
import { io } from 'socket.io-client';
import { API_CONFIG } from '../config/api';

export function useEvolutionWebhook() {
  const socket = ref(null);
  const isConnected = ref(false);
  const messages = ref([]);
  const instances = ref({});
  const qrCodes = ref({});

  const connect = () => {
    socket.value = io(API_CONFIG.WEBSOCKET_URL, {
      transports: ['websocket']
    });

    socket.value.on('connect', () => {
      isConnected.value = true;
    });

    socket.value.on('disconnect', () => {
      isConnected.value = false;
    });

    socket.value.on('new-message', (data) => {
      const exists = messages.value.some(msg => msg.id === data.id);
      if (!exists) {
        messages.value.unshift(data);
        messages.value = messages.value.slice(0, 100);
      }
    });

    socket.value.on('connection-update', (data) => {
      instances.value[data.instance] = {
        ...instances.value[data.instance],
        ...data
      };
    });

    socket.value.on('qr-updated', (data) => {
      if (data.qrCode) {
        qrCodes.value[data.instance] = data.qrCode;
      }
    });
  };

  const joinInstance = (instanceName) => {
    if (socket.value && instanceName) {
      socket.value.emit('join-instance', instanceName);
    }
  };

  onMounted(() => {
    connect();
  });

  onUnmounted(() => {
    if (socket.value) {
      socket.value.close();
    }
  });

  return {
    isConnected,
    messages,
    instances,
    qrCodes,
    joinInstance
  };
}
```

## 🔄 4. Configuração API REST

### Service para requisições HTTP
```javascript
// services/evolutionApi.js
import axios from 'axios';
import { API_CONFIG } from '../config/api';

class EvolutionApiService {
  constructor() {
    this.api = axios.create({
      baseURL: API_CONFIG.API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Interceptor para logs
    this.api.interceptors.request.use(
      config => {
        console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      error => {
        console.error('❌ API Request Error:', error);
        return Promise.reject(error);
      }
    );

    this.api.interceptors.response.use(
      response => {
        console.log(`✅ API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      error => {
        console.error('❌ API Response Error:', error.response?.status, error.message);
        return Promise.reject(error);
      }
    );
  }

  // Health check
  async checkHealth() {
    try {
      const response = await this.api.get('/health');
      return response.data;
    } catch (error) {
      throw new Error(`Health check failed: ${error.message}`);
    }
  }

  // Buscar estatísticas do servidor
  async getStats() {
    try {
      const response = await this.api.get('/stats');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get stats: ${error.message}`);
    }
  }

  // Buscar instâncias
  async fetchInstances(instanceName = '') {
    try {
      const url = instanceName ? `/instance/fetchInstances?instanceName=${instanceName}` : '/instance/fetchInstances';
      const response = await this.api.get(url);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch instances: ${error.message}`);
    }
  }

  // Buscar mensagens de uma instância
  async getMessages(instanceName, limit = 50, offset = 0) {
    try {
      const response = await this.api.get(`/messages/${instanceName}`, {
        params: { limit, offset }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get messages: ${error.message}`);
    }
  }

  // Enviar mensagem (simulado)
  async sendMessage(instance, to, message, type = 'text') {
    try {
      const response = await this.api.post('/send-message', {
        instance,
        to,
        message,
        type
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }
}

// Exportar instância única
export const evolutionApi = new EvolutionApiService();
```

## 🎯 5. Componentes de Exemplo

### React Component
```jsx
// components/EvolutionDashboard.jsx
import React, { useEffect, useState } from 'react';
import { useEvolutionWebhook } from '../hooks/useEvolutionWebhook';
import { evolutionApi } from '../services/evolutionApi';

function EvolutionDashboard() {
  const {
    isConnected,
    messages,
    instances,
    qrCodes,
    joinInstance
  } = useEvolutionWebhook();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  // Carregar estatísticas
  const loadStats = async () => {
    setLoading(true);
    try {
      const statsData = await evolutionApi.getStats();
      setStats(statsData);
    } catch (error) {
      console.error('Erro ao carregar stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Enviar mensagem de teste
  const sendTestMessage = async () => {
    try {
      const result = await evolutionApi.sendMessage(
        'minha-instancia',
        '5511999999999@s.whatsapp.net',
        'Mensagem de teste do frontend!'
      );
      console.log('Mensagem enviada:', result);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      alert('Erro ao enviar mensagem');
    }
  };

  useEffect(() => {
    loadStats();
    joinInstance('minha-instancia'); // Conectar à sua instância
  }, [joinInstance]);

  return (
    <div className="evolution-dashboard">
      {/* Status de Conexão */}
      <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
        {isConnected ? '🟢 Conectado ao Webhook Server' : '🔴 Desconectado'}
      </div>

      {/* Controles */}
      <div className="controls">
        <button onClick={loadStats} disabled={loading}>
          {loading ? 'Carregando...' : 'Atualizar Stats'}
        </button>
        <button onClick={sendTestMessage}>
          Enviar Mensagem Teste
        </button>
      </div>

      {/* Estatísticas */}
      {stats && (
        <div className="stats">
          <h3>📊 Estatísticas do Servidor</h3>
          <p>Uptime: {Math.floor(stats.server.uptime)}s</p>
          <p>Memória: {Math.round(stats.server.memory.rss / 1024 / 1024)}MB</p>
          <p>Clientes WebSocket: {stats.websocket.connectedClients}</p>
        </div>
      )}

      {/* QR Codes */}
      {Object.keys(qrCodes).length > 0 && (
        <div className="qr-codes">
          <h3>📱 QR Codes</h3>
          {Object.entries(qrCodes).map(([instance, qr]) => (
            <div key={instance} className="qr-code">
              <h4>{instance}</h4>
              <img src={qr} alt={`QR Code ${instance}`} style={{maxWidth: '200px'}} />
            </div>
          ))}
        </div>
      )}

      {/* Status das Instâncias */}
      <div className="instances">
        <h3>🔗 Status das Instâncias</h3>
        {Object.entries(instances).map(([name, info]) => (
          <div key={name} className="instance">
            <span>{name}</span>
            <span className={`status ${info.status}`}>{info.status}</span>
          </div>
        ))}
      </div>

      {/* Mensagens Recentes */}
      <div className="messages">
        <h3>💬 Mensagens Recentes ({messages.length})</h3>
        <div className="message-list">
          {messages.map((msg, index) => (
            <div key={msg.id || index} className="message">
              <div className="message-header">
                <strong>{msg.pushName || msg.from}</strong>
                <small>{msg.instance}</small>
                <small>{new Date(msg.timestamp).toLocaleString()}</small>
              </div>
              <div className="message-content">
                <span className="message-type">[{msg.messageType}]</span>
                {msg.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default EvolutionDashboard;
```

### Vue Component
```vue
<!-- components/EvolutionDashboard.vue -->
<template>
  <div class="evolution-dashboard">
    <!-- Status de Conexão -->
    <div :class="['connection-status', isConnected ? 'connected' : 'disconnected']">
      {{ isConnected ? '🟢 Conectado ao Webhook Server' : '🔴 Desconectado' }}
    </div>

    <!-- Controles -->
    <div class="controls">
      <button @click="loadStats" :disabled="loading">
        {{ loading ? 'Carregando...' : 'Atualizar Stats' }}
      </button>
      <button @click="sendTestMessage">
        Enviar Mensagem Teste
      </button>
    </div>

    <!-- Estatísticas -->
    <div v-if="stats" class="stats">
      <h3>📊 Estatísticas do Servidor</h3>
      <p>Uptime: {{ Math.floor(stats.server.uptime) }}s</p>
      <p>Memória: {{ Math.round(stats.server.memory.rss / 1024 / 1024) }}MB</p>
      <p>Clientes WebSocket: {{ stats.websocket.connectedClients }}</p>
    </div>

    <!-- QR Codes -->
    <div v-if="Object.keys(qrCodes).length > 0" class="qr-codes">
      <h3>📱 QR Codes</h3>
      <div v-for="[instance, qr] in Object.entries(qrCodes)" :key="instance" class="qr-code">
        <h4>{{ instance }}</h4>
        <img :src="qr" :alt="`QR Code ${instance}`" style="max-width: 200px" />
      </div>
    </div>

    <!-- Mensagens -->
    <div class="messages">
      <h3>💬 Mensagens Recentes ({{ messages.length }})</h3>
      <div class="message-list">
        <div v-for="(msg, index) in messages" :key="msg.id || index" class="message">
          <div class="message-header">
            <strong>{{ msg.pushName || msg.from }}</strong>
            <small>{{ msg.instance }}</small>
            <small>{{ new Date(msg.timestamp).toLocaleString() }}</small>
          </div>
          <div class="message-content">
            <span class="message-type">[{{ msg.messageType }}]</span>
            {{ msg.content }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useEvolutionWebhook } from '../composables/useEvolutionWebhook';
import { evolutionApi } from '../services/evolutionApi';

export default {
  name: 'EvolutionDashboard',
  setup() {
    const { isConnected, messages, instances, qrCodes, joinInstance } = useEvolutionWebhook();
    
    const stats = ref(null);
    const loading = ref(false);

    const loadStats = async () => {
      loading.value = true;
      try {
        const statsData = await evolutionApi.getStats();
        stats.value = statsData;
      } catch (error) {
        console.error('Erro ao carregar stats:', error);
      } finally {
        loading.value = false;
      }
    };

    const sendTestMessage = async () => {
      try {
        const result = await evolutionApi.sendMessage(
          'minha-instancia',
          '5511999999999@s.whatsapp.net',
          'Mensagem de teste do frontend!'
        );
        console.log('Mensagem enviada:', result);
      } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        alert('Erro ao enviar mensagem');
      }
    };

    onMounted(() => {
      loadStats();
      joinInstance('minha-instancia');
    });

    return {
      isConnected,
      messages,
      instances,
      qrCodes,
      stats,
      loading,
      loadStats,
      sendTestMessage,
      Math
    };
  }
};
</script>
```

## 🎨 6. CSS/Styling (Exemplo)

```css
/* styles/evolution-dashboard.css */
.evolution-dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.connection-status {
  padding: 12px 20px;
  border-radius: 8px;
  font-weight: 600;
  margin-bottom: 20px;
  text-align: center;
}

.connection-status.connected {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.connection-status.disconnected {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.controls {
  margin: 20px 0;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.controls button {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  background: #007bff;
  color: white;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

.controls button:hover {
  background: #0056b3;
}

.controls button:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.stats {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin: 20px 0;
  border: 1px solid #dee2e6;
}

.stats h3 {
  margin-top: 0;
  color: #495057;
}

.qr-codes {
  margin: 20px 0;
}

.qr-code {
  display: inline-block;
  margin: 10px;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
  text-align: center;
}

.instances {
  margin: 20px 0;
}

.instance {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  margin: 5px 0;
  background: white;
}

.status {
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.status.connected,
.status.open {
  background: #d4edda;
  color: #155724;
}

.status.disconnected,
.status.closed {
  background: #f8d7da;
  color: #721c24;
}

.messages {
  margin: 20px 0;
}

.message-list {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: white;
}

.message {
  padding: 15px;
  border-bottom: 1px solid #f0f0f0;
}

.message:last-child {
  border-bottom: none;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 14px;
}

.message-header strong {
  color: #007bff;
}

.message-header small {
  color: #6c757d;
}

.message-content {
  color: #495057;
}

.message-type {
  background: #e9ecef;
  color: #495057;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
  margin-right: 8px;
}
```

## 🔧 7. Configuração de Ambiente

### .env (Development)
```env
# .env.development
REACT_APP_API_BASE_URL=http://localhost:3001/api
REACT_APP_WEBSOCKET_URL=http://localhost:3001
```

### .env (Production)
```env
# .env.production
REACT_APP_API_BASE_URL=https://webhook.bkcrm.devsible.com.br/api
REACT_APP_WEBSOCKET_URL=https://webhook.bkcrm.devsible.com.br
```

## 🧪 8. Teste de Integração

```javascript
// utils/testIntegration.js
import { evolutionApi } from '../services/evolutionApi';

export async function testEvolutionIntegration() {
  console.log('🧪 Testando integração Evolution Webhook...');
  
  try {
    // Teste 1: Health check
    console.log('1. Testando health check...');
    const health = await evolutionApi.checkHealth();
    console.log('✅ Health check OK:', health.status);
    
    // Teste 2: Estatísticas
    console.log('2. Testando estatísticas...');
    const stats = await evolutionApi.getStats();
    console.log('✅ Stats OK:', stats.success);
    
    // Teste 3: Instâncias
    console.log('3. Testando busca de instâncias...');
    const instances = await evolutionApi.fetchInstances();
    console.log('✅ Instâncias OK:', instances.length);
    
    console.log('🎉 Todos os testes passaram!');
    return true;
  } catch (error) {
    console.error('❌ Teste falhou:', error.message);
    return false;
  }
}

// Usar no componente ou durante desenvolvimento
// testEvolutionIntegration();
```

## 🎯 9. Checklist de Implementação

- [ ] Instalar dependências (`socket.io-client`, `axios`)
- [ ] Configurar URLs de desenvolvimento e produção
- [ ] Implementar hook/composable WebSocket
- [ ] Criar service para API REST
- [ ] Implementar componente dashboard
- [ ] Adicionar estilos CSS
- [ ] Configurar variáveis de ambiente
- [ ] Testar integração
- [ ] Conectar à instância real do WhatsApp
- [ ] Deploy em produção

## 🚨 10. Troubleshooting

### Problema: WebSocket não conecta
```javascript
// Verificar CORS e URL
console.log('Tentando conectar em:', API_CONFIG.WEBSOCKET_URL);

// Testar manualmente
fetch(API_CONFIG.API_BASE_URL + '/health')
  .then(res => res.json())
  .then(data => console.log('API OK:', data))
  .catch(err => console.error('API Error:', err));
```

### Problema: CORS bloqueado
```javascript
// Verificar se o servidor está rodando com CORS habilitado
// O servidor já está configurado com: cors({ origin: "*" })
```

### Problema: Mensagens não aparecem
```javascript
// Verificar se está conectado à instância correta
useEffect(() => {
  if (isConnected) {
    joinInstance('SUA_INSTANCIA_AQUI'); // Nome correto da instância
  }
}, [isConnected, joinInstance]);
```

---

**✅ Agora você tem tudo configurado para integrar seu frontend com o Evolution Webhook Server!**

**URLs importantes:**
- **Desenvolvimento**: `http://localhost:3001`
- **Produção**: `https://webhook.bkcrm.devsible.com.br`
- **Health Check**: `/api/health`
- **WebSocket**: Mesma URL base 
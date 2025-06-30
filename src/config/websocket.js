const { Server } = require('socket.io');
const logger = require('./logger');

class WebSocketManager {
  constructor() {
    this.io = null;
    this.connectedClients = new Map();
  }
  
  // Inicializar WebSocket
  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS ? 
          process.env.ALLOWED_ORIGINS.split(',') : 
          ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });
    
    this.setupEventHandlers();
    logger.info('WebSocket inicializado com sucesso');
    
    return this.io;
  }
  
  // Configurar manipuladores de eventos
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      logger.info('Cliente WebSocket conectado:', { 
        socketId: socket.id,
        userAgent: socket.handshake.headers['user-agent'],
        ip: socket.handshake.address
      });
      
      // Armazenar informações do cliente
      this.connectedClients.set(socket.id, {
        socketId: socket.id,
        connectedAt: new Date(),
        userAgent: socket.handshake.headers['user-agent'],
        ip: socket.handshake.address,
        subscriptions: new Set()
      });
      
      // Eventos do cliente
      this.setupClientEvents(socket);
      
      // Enviar status inicial
      socket.emit('connection-status', {
        connected: true,
        timestamp: new Date().toISOString(),
        totalClients: this.io.engine.clientsCount
      });
      
      // Evento de desconexão
      socket.on('disconnect', (reason) => {
        logger.info('Cliente WebSocket desconectado:', { 
          socketId: socket.id,
          reason,
          duration: Date.now() - this.connectedClients.get(socket.id)?.connectedAt?.getTime()
        });
        
        this.connectedClients.delete(socket.id);
      });
    });
    
    // Eventos de sistema
    this.io.engine.on('connection_error', (err) => {
      logger.error('Erro de conexão WebSocket:', err);
    });
  }
  
  // Configurar eventos específicos do cliente
  setupClientEvents(socket) {
    // Subscrever a eventos de ticket
    socket.on('subscribe-ticket', (ticketId) => {
      socket.join(`ticket-${ticketId}`);
      
      const client = this.connectedClients.get(socket.id);
      if (client) {
        client.subscriptions.add(`ticket-${ticketId}`);
      }
      
      logger.debug('Cliente subscrito ao ticket:', { socketId: socket.id, ticketId });
    });
    
    // Desinscrever de eventos de ticket
    socket.on('unsubscribe-ticket', (ticketId) => {
      socket.leave(`ticket-${ticketId}`);
      
      const client = this.connectedClients.get(socket.id);
      if (client) {
        client.subscriptions.delete(`ticket-${ticketId}`);
      }
      
      logger.debug('Cliente desinscrito do ticket:', { socketId: socket.id, ticketId });
    });
    
    // Subscrever a eventos de instância
    socket.on('subscribe-instance', (instanceName) => {
      socket.join(`instance-${instanceName}`);
      
      const client = this.connectedClients.get(socket.id);
      if (client) {
        client.subscriptions.add(`instance-${instanceName}`);
      }
      
      logger.debug('Cliente subscrito à instância:', { socketId: socket.id, instanceName });
    });
    
    // Evento de digitação (typing)
    socket.on('typing', (data) => {
      const { ticketId, isTyping, agentName } = data;
      
      socket.to(`ticket-${ticketId}`).emit('user-typing', {
        ticketId,
        isTyping,
        agentName,
        timestamp: new Date().toISOString()
      });
    });
    
    // Ping/Pong para manter conexão ativa
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });
    
    // Solicitar estatísticas
    socket.on('request-stats', () => {
      socket.emit('stats-update', {
        connectedClients: this.io.engine.clientsCount,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    });
  }
  
  // Emitir nova mensagem
  emitNewMessage(messageData) {
    if (!this.io) return;
    
    const { message, ticket, customer, instance } = messageData;
    
    // Emitir para todos os clientes subscritos ao ticket
    this.io.to(`ticket-${ticket.id}`).emit('new-message', {
      message,
      ticket,
      customer,
      instance,
      timestamp: new Date().toISOString()
    });
    
    // Emitir notificação geral
    this.io.emit('notification', {
      type: 'new-message',
      title: `Nova mensagem de ${customer.name}`,
      message: message.content.substring(0, 100),
      ticketId: ticket.id,
      timestamp: new Date().toISOString()
    });
    
    logger.debug('Nova mensagem emitida via WebSocket:', {
      messageId: message.id,
      ticketId: ticket.id,
      clients: this.io.sockets.adapter.rooms.get(`ticket-${ticket.id}`)?.size || 0
    });
  }
  
  // Emitir atualização de ticket
  emitTicketUpdate(ticketData) {
    if (!this.io) return;
    
    const { ticket, previousStatus } = ticketData;
    
    this.io.to(`ticket-${ticket.id}`).emit('ticket-updated', {
      ticket,
      previousStatus,
      timestamp: new Date().toISOString()
    });
    
    // Se mudou de status, emitir notificação
    if (previousStatus !== ticket.status) {
      this.io.emit('notification', {
        type: 'ticket-status-changed',
        title: 'Status do ticket alterado',
        message: `Ticket #${ticket.id} mudou para ${ticket.status}`,
        ticketId: ticket.id,
        timestamp: new Date().toISOString()
      });
    }
    
    logger.debug('Atualização de ticket emitida via WebSocket:', {
      ticketId: ticket.id,
      status: ticket.status
    });
  }
  
  // Emitir atualização de status de instância
  emitInstanceStatus(statusData) {
    if (!this.io) return;
    
    const { instanceName, status, state } = statusData;
    
    this.io.to(`instance-${instanceName}`).emit('instance-status', {
      instanceName,
      status,
      state,
      timestamp: new Date().toISOString()
    });
    
    // Emitir para todos os clientes
    this.io.emit('instance-status-general', {
      instanceName,
      status,
      state,
      timestamp: new Date().toISOString()
    });
    
    logger.debug('Status de instância emitido via WebSocket:', {
      instanceName,
      status
    });
  }
  
  // Emitir QR Code atualizado
  emitQRUpdate(qrData) {
    if (!this.io) return;
    
    const { instanceName, qrcode } = qrData;
    
    this.io.to(`instance-${instanceName}`).emit('qr-updated', {
      instanceName,
      qrcode,
      timestamp: new Date().toISOString()
    });
    
    logger.debug('QR Code atualizado via WebSocket:', {
      instanceName,
      qrLength: qrcode.length
    });
  }
  
  // Obter estatísticas de conexão
  getConnectionStats() {
    return {
      totalConnections: this.io ? this.io.engine.clientsCount : 0,
      activeClients: this.connectedClients.size,
      connectedClients: Array.from(this.connectedClients.values()).map(client => ({
        socketId: client.socketId,
        connectedAt: client.connectedAt,
        subscriptions: Array.from(client.subscriptions),
        ip: client.ip
      }))
    };
  }
  
  // Broadcast para todos os clientes
  broadcast(event, data) {
    if (!this.io) return;
    
    this.io.emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
    
    logger.debug('Broadcast enviado:', { event, clients: this.io.engine.clientsCount });
  }
}

module.exports = new WebSocketManager(); 
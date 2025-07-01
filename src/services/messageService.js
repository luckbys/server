const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { MessageType, TicketStatus, TicketPriority } = require('../types');

class MessageService {
  constructor() {
    this.supabase = supabase;
  }

  async processWhatsAppMessage(message, instance) {
    try {
      logger.info('💬 Processando mensagem do WhatsApp', {
        messageId: message.id,
        instance: instance
      });

      // 1. Buscar ou criar perfil do cliente
      const profile = await this.findOrCreateProfile(message);

      // 2. Buscar ou criar ticket
      const ticket = await this.findOrCreateTicket(message, profile, instance);

      // 3. Salvar a mensagem
      await this.saveMessage(message, ticket.id, profile.id);

      // 4. Atualizar última interação do cliente
      await this.updateCustomerLastInteraction(profile.id);

      logger.info('✅ Mensagem processada com sucesso', {
        ticketId: ticket.id,
        profileId: profile.id
      });

      return { ticket, profile };
    } catch (error) {
      logger.error('❌ Erro ao processar mensagem', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async findOrCreateProfile(message) {
    const { data: existingProfile } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('phone', message.from)
      .single();

    if (existingProfile) {
      return existingProfile;
    }

    const { data: newProfile, error } = await this.supabase
      .from('profiles')
      .insert({
        phone: message.from,
        name: message.pushName || 'Cliente WhatsApp',
        role: 'customer',
        email: `${message.from.split('@')[0]}@whatsapp.customer.com`,
        metadata: {
          whatsapp: {
            number: message.from,
            name: message.pushName
          }
        }
      })
      .select()
      .single();

    if (error) throw error;
    return newProfile;
  }

  async findOrCreateTicket(message, profile, instance) {
    // Buscar ticket aberto existente
    const { data: existingTicket } = await this.supabase
      .from('tickets')
      .select('*')
      .eq('customer_id', profile.id)
      .eq('status', 'open')
      .eq('channel', 'whatsapp')
      .single();

    if (existingTicket) {
      // Atualizar última mensagem
      await this.supabase
        .from('tickets')
        .update({
          last_message_at: new Date().toISOString(),
          is_visualized: false
        })
        .eq('id', existingTicket.id);

      return existingTicket;
    }

    // Buscar departamento da instância
    const { data: evolutionInstance } = await this.supabase
      .from('evolution_instances')
      .select('department_id, department_name')
      .eq('instance_name', instance)
      .single();

    // Criar novo ticket
    const { data: newTicket, error } = await this.supabase
      .from('tickets')
      .insert({
        title: `Atendimento WhatsApp - ${profile.name || profile.phone}`,
        customer_id: profile.id,
        department_id: evolutionInstance?.department_id,
        department: evolutionInstance?.department_name,
        status: TicketStatus.OPEN,
        priority: TicketPriority.MEDIUM,
        channel: 'whatsapp',
        metadata: {
          whatsapp: {
            instance: instance,
            number: message.from
          }
        }
      })
      .select()
      .single();

    if (error) throw error;
    return newTicket;
  }

  async saveMessage(message, ticketId, profileId) {
    const messageType = this.getMessageType(message);
    
    const { error } = await this.supabase
      .from('messages')
      .insert({
        ticket_id: ticketId,
        sender_id: profileId,
        content: message.content || '',
        type: messageType,
        file_url: message.fileUrl,
        sender_type: 'customer',
        message_type: messageType,
        metadata: {
          whatsapp: {
            messageId: message.id,
            timestamp: message.messageTimestamp
          }
        }
      });

    if (error) throw error;
  }

  async updateCustomerLastInteraction(profileId) {
    const { data: customer } = await this.supabase
      .from('customers')
      .select('id')
      .eq('profile_id', profileId)
      .single();

    if (customer) {
      await this.supabase
        .from('customers')
        .update({
          last_interaction: new Date().toISOString()
        })
        .eq('id', customer.id);
    }
  }

  getMessageType(message) {
    switch (message.messageType) {
      case 'conversation':
        return MessageType.TEXT;
      case 'imageMessage':
        return MessageType.IMAGE;
      case 'videoMessage':
        return MessageType.VIDEO;
      case 'audioMessage':
        return MessageType.AUDIO;
      case 'documentMessage':
        return MessageType.DOCUMENT;
      case 'locationMessage':
        return MessageType.LOCATION;
      case 'contactMessage':
        return MessageType.CONTACT;
      case 'stickerMessage':
        return MessageType.STICKER;
      default:
        return MessageType.TEXT;
    }
  }
}

module.exports = new MessageService(); 
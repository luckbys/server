const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { MessageType, TicketStatus, TicketPriority } = require('../types');

class MessageService {
  constructor() {
    this.supabase = supabase;
    logger.info('✅ Serviço de mensagens inicializado');
  }

  async processWhatsAppMessage(message, instance) {
    try {
      logger.info('💬 Iniciando processamento de mensagem do WhatsApp', {
        messageId: message.id,
        instance,
        from: message.from,
        type: message.messageType,
        content: message.content,
        pushName: message.pushName,
        messageData: message
      });

      // Extrair número de telefone sem o sufixo @s.whatsapp.net
      const phone = message.from.split('@')[0];

      // 1. Buscar ou criar perfil do cliente
      logger.debug('🔍 Buscando perfil do cliente', { phone });
      const profile = await this.findOrCreateProfile(message, phone);
      logger.info('👤 Perfil encontrado/criado', { profileId: profile.id, name: profile.name });

      // 2. Buscar ou criar ticket
      logger.debug('🔍 Buscando ticket ativo', { profileId: profile.id });
      const ticket = await this.findOrCreateTicket(message, profile, instance);
      logger.info('🎫 Ticket encontrado/criado', { ticketId: ticket.id, status: ticket.status });

      // 3. Salvar a mensagem
      logger.debug('💾 Salvando mensagem', { 
        ticketId: ticket.id,
        content: message.content,
        type: message.messageType
      });
      await this.saveMessage(message, ticket.id, profile.id);
      logger.info('✅ Mensagem salva com sucesso');

      // 4. Atualizar última interação do cliente
      logger.debug('🔄 Atualizando última interação', { profileId: profile.id });
      await this.updateCustomerLastInteraction(profile.id);
      logger.info('✅ Última interação atualizada');

      logger.info('✅ Processamento de mensagem concluído com sucesso', {
        ticketId: ticket.id,
        profileId: profile.id,
        messageId: message.id
      });

      return { ticket, profile };
    } catch (error) {
      logger.error('❌ Erro ao processar mensagem', {
        error: error.message,
        stack: error.stack,
        messageData: {
          id: message.id,
          from: message.from,
          type: message.messageType,
          content: message.content,
          fullMessage: message
        }
      });
      throw error;
    }
  }

  async findOrCreateProfile(message, phone) {
    try {
      logger.debug('🔍 Buscando perfil existente', { phone });
      
      const { data: existingProfile, error: searchError } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('phone', phone)
        .single();

      if (searchError && searchError.code !== 'PGRST116') {
        logger.error('❌ Erro ao buscar perfil', { error: searchError });
        throw searchError;
      }

      if (existingProfile) {
        logger.info('✅ Perfil encontrado', { profileId: existingProfile.id });
        return existingProfile;
      }

      logger.info('➕ Criando novo perfil', { phone, name: message.pushName });
      const { data: newProfile, error: createError } = await this.supabase
        .from('profiles')
        .insert({
          phone: phone,
          name: message.pushName || 'Cliente WhatsApp',
          role: 'customer',
          email: `${phone}@whatsapp.customer.com`,
          metadata: {
            whatsapp: {
              number: message.from,
              name: message.pushName
            }
          }
        })
        .select()
        .single();

      if (createError) {
        logger.error('❌ Erro ao criar perfil', { error: createError });
        throw createError;
      }

      logger.info('✅ Novo perfil criado', { profileId: newProfile.id });
      return newProfile;
    } catch (error) {
      logger.error('❌ Erro em findOrCreateProfile', {
        error: error.message,
        stack: error.stack,
        phone,
        pushName: message.pushName
      });
      throw error;
    }
  }

  async findOrCreateTicket(message, profile, instance) {
    try {
      logger.debug('🔍 Buscando ticket aberto', { profileId: profile.id });

      const { data: existingTicket, error: searchError } = await this.supabase
        .from('tickets')
        .select('*')
        .eq('customer_id', profile.id)
        .eq('status', 'open')
        .eq('channel', 'whatsapp')
        .single();

      if (searchError && searchError.code !== 'PGRST116') {
        logger.error('❌ Erro ao buscar ticket', { error: searchError });
        throw searchError;
      }

      if (existingTicket) {
        logger.info('✅ Ticket existente encontrado', { ticketId: existingTicket.id });
        
        const { error: updateError } = await this.supabase
          .from('tickets')
          .update({
            last_message_at: new Date().toISOString(),
            is_visualized: false
          })
          .eq('id', existingTicket.id);

        if (updateError) {
          logger.error('❌ Erro ao atualizar ticket', { error: updateError });
          throw updateError;
        }

        return existingTicket;
      }

      // Em ambiente de teste, não buscar a instância
      let departmentId = null;
      let departmentName = null;

      if (instance !== 'test-instance') {
        logger.debug('🔍 Buscando informações da instância', { instance });
        const { data: evolutionInstance, error: instanceError } = await this.supabase
          .from('evolution_instances')
          .select('department_id, department_name')
          .eq('instance_name', instance)
          .single();

        if (instanceError) {
          logger.error('❌ Erro ao buscar instância', { error: instanceError });
          throw instanceError;
        }

        departmentId = evolutionInstance?.department_id;
        departmentName = evolutionInstance?.department_name;
      } else {
        departmentId = '00000000-0000-4000-a000-000000000000';
        departmentName = 'Departamento de Teste';
      }

      logger.info('➕ Criando novo ticket', {
        profileId: profile.id,
        departmentId: departmentId
      });

      const { data: newTicket, error: createError } = await this.supabase
        .from('tickets')
        .insert({
          title: `Atendimento WhatsApp - ${profile.name || profile.phone}`,
          customer_id: profile.id,
          department_id: departmentId,
          department: departmentName,
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

      if (createError) {
        logger.error('❌ Erro ao criar ticket', { error: createError });
        throw createError;
      }

      logger.info('✅ Novo ticket criado', { ticketId: newTicket.id });
      return newTicket;
    } catch (error) {
      logger.error('❌ Erro em findOrCreateTicket', {
        error: error.message,
        stack: error.stack,
        profileId: profile.id,
        instance: instance
      });
      throw error;
    }
  }

  async saveMessage(message, ticketId, profileId) {
    try {
      const messageType = this.getMessageType(message);
      
      logger.debug('💾 Iniciando salvamento da mensagem', {
        ticketId,
        profileId,
        type: messageType,
        content: message.content,
        messageId: message.id,
        messageData: message
      });

      const messageData = {
        ticket_id: ticketId,
        sender_id: profileId,
        content: message.content || message.message?.conversation || '',
        message_type: messageType,
        file_url: message.fileUrl,
        sender_type: 'customer',
        metadata: {
          whatsapp: {
            messageId: message.id,
            timestamp: message.messageTimestamp,
            jid: message.from,
            instance_name: message.metadata?.instance_name || 'test-instance',
            sender_phone: message.from.split('@')[0],
            is_from_whatsapp: true,
            enhanced_processing: true
          }
        }
      };

      logger.debug('📝 Dados da mensagem preparados:', {
        messageData,
        supabaseConfig: {
          url: !!process.env.SUPABASE_URL,
          key: !!process.env.SUPABASE_KEY
        }
      });

      const { data: savedMessage, error } = await this.supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();

      if (error) {
        logger.error('❌ Erro ao salvar mensagem no Supabase', { 
          error: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          messageData 
        });
        throw error;
      }

      logger.info('✅ Mensagem salva com sucesso', {
        ticketId,
        messageId: message.id,
        savedMessageId: savedMessage.id,
        messageData: messageData
      });

      return savedMessage;
    } catch (error) {
      logger.error('❌ Erro em saveMessage', {
        error: error.message,
        stack: error.stack,
        messageData: {
          ticketId,
          profileId,
          content: message.content,
          type: message.messageType,
          fullMessage: message
        }
      });
      throw error;
    }
  }

  async updateCustomerLastInteraction(profileId) {
    try {
      logger.debug('🔍 Buscando cliente', { profileId });
      
      const { data: customer, error: searchError } = await this.supabase
        .from('customers')
        .select('id')
        .eq('profile_id', profileId)
        .single();

      if (searchError && searchError.code !== 'PGRST116') {
        logger.error('❌ Erro ao buscar cliente', { error: searchError });
        throw searchError;
      }

      if (customer) {
        logger.debug('🔄 Atualizando última interação', { customerId: customer.id });
        
        const { error: updateError } = await this.supabase
          .from('customers')
          .update({
            last_interaction: new Date().toISOString()
          })
          .eq('id', customer.id);

        if (updateError) {
          logger.error('❌ Erro ao atualizar última interação', { error: updateError });
          throw updateError;
        }

        logger.info('✅ Última interação atualizada com sucesso');
      }
    } catch (error) {
      logger.error('❌ Erro em updateCustomerLastInteraction', {
        error: error.message,
        stack: error.stack,
        profileId: profileId
      });
      throw error;
    }
  }

  getMessageType(message) {
    if (!message) return 'unknown';

    if (message.messageType) {
      return message.messageType;
    }

    if (message.message?.conversation) {
      return 'text';
    }

    if (message.message?.imageMessage) {
      return 'image';
    }

    if (message.message?.videoMessage) {
      return 'video';
    }

    if (message.message?.audioMessage) {
      return 'audio';
    }

    if (message.message?.documentMessage) {
      return 'document';
    }

    if (message.message?.locationMessage) {
      return 'location';
    }

    if (message.message?.contactMessage) {
      return 'contact';
    }

    if (message.message?.stickerMessage) {
      return 'sticker';
    }

    if (message.message?.buttonsMessage) {
      return 'buttons';
    }

    if (message.message?.listMessage) {
      return 'list';
    }

    return 'unknown';
  }
}

module.exports = new MessageService(); 
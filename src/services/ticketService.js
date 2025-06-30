const { supabaseAdmin } = require('../config/supabase');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

class TicketService {
  
  // Buscar ticket ativo para um cliente
  async findActiveByCustomer(customerId, channel = 'whatsapp') {
    try {
      const { data, error } = await supabaseAdmin
        .from('tickets')
        .select('*')
        .eq('customer_id', customerId)
        .eq('channel', channel)
        .in('status', ['open', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        logger.error('Erro ao buscar ticket ativo:', { error, customerId, channel });
        throw error;
      }
      
      return data;
    } catch (error) {
      logger.error('Erro ao buscar ticket ativo:', { error, customerId, channel });
      throw error;
    }
  }
  
  // Criar novo ticket
  async create(ticketData) {
    try {
      const ticketId = uuidv4();
      
      const ticket = {
        id: ticketId,
        title: ticketData.title || 'Nova conversa WhatsApp',
        status: 'open',
        customer_id: ticketData.customerId,
        agent_id: ticketData.agentId || null,
        department_id: ticketData.departmentId || null,
        channel: ticketData.channel || 'whatsapp',
        metadata: {
          instance_name: ticketData.instanceName,
          whatsapp_jid: ticketData.whatsappJid,
          first_message_at: new Date().toISOString(),
          ...ticketData.metadata
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { data, error } = await supabaseAdmin
        .from('tickets')
        .insert(ticket)
        .select()
        .single();
      
      if (error) {
        logger.error('Erro ao criar ticket:', { error, ticketData });
        throw error;
      }
      
      logger.info('Ticket criado com sucesso:', { ticketId: data.id, customerId: ticketData.customerId });
      return data;
    } catch (error) {
      logger.error('Erro ao criar ticket:', { error, ticketData });
      throw error;
    }
  }
  
  // Atualizar ticket
  async update(ticketId, updateData) {
    try {
      const updates = {
        ...updateData,
        updated_at: new Date().toISOString()
      };
      
      const { data, error } = await supabaseAdmin
        .from('tickets')
        .update(updates)
        .eq('id', ticketId)
        .select()
        .single();
      
      if (error) {
        logger.error('Erro ao atualizar ticket:', { error, ticketId, updateData });
        throw error;
      }
      
      logger.info('Ticket atualizado com sucesso:', { ticketId });
      return data;
    } catch (error) {
      logger.error('Erro ao atualizar ticket:', { error, ticketId, updateData });
      throw error;
    }
  }
  
  // Atribuir agente ao ticket
  async assignAgent(ticketId, agentId) {
    try {
      const ticket = await this.update(ticketId, {
        agent_id: agentId,
        status: 'in_progress'
      });
      
      logger.info('Agente atribuído ao ticket:', { ticketId, agentId });
      return ticket;
    } catch (error) {
      logger.error('Erro ao atribuir agente:', { error, ticketId, agentId });
      throw error;
    }
  }
  
  // Fechar ticket
  async close(ticketId, reason = null) {
    try {
      const ticket = await this.update(ticketId, {
        status: 'closed',
        metadata: {
          closed_at: new Date().toISOString(),
          close_reason: reason
        }
      });
      
      logger.info('Ticket fechado:', { ticketId, reason });
      return ticket;
    } catch (error) {
      logger.error('Erro ao fechar ticket:', { error, ticketId, reason });
      throw error;
    }
  }
  
  // Reabrir ticket
  async reopen(ticketId) {
    try {
      const ticket = await this.update(ticketId, {
        status: 'open'
      });
      
      logger.info('Ticket reaberto:', { ticketId });
      return ticket;
    } catch (error) {
      logger.error('Erro ao reabrir ticket:', { error, ticketId });
      throw error;
    }
  }
  
  // Buscar ou criar ticket
  async findOrCreate(customerData, instanceData) {
    try {
      // Primeiro, buscar ticket ativo
      let ticket = await this.findActiveByCustomer(customerData.id, 'whatsapp');
      
      if (!ticket) {
        // Criar novo ticket
        ticket = await this.create({
          customerId: customerData.id,
          channel: 'whatsapp',
          instanceName: instanceData.name,
          whatsappJid: customerData.metadata?.whatsapp_jid,
          departmentId: instanceData.department_id
        });
      }
      
      return ticket;
    } catch (error) {
      logger.error('Erro ao buscar ou criar ticket:', { error, customerData, instanceData });
      throw error;
    }
  }
  
  // Listar tickets
  async list(filters = {}, page = 1, limit = 50) {
    try {
      let query = supabaseAdmin
        .from('tickets')
        .select(`
          *,
          customer:profiles!tickets_customer_id_fkey(id, name, email, metadata),
          agent:profiles!tickets_agent_id_fkey(id, name, email)
        `, { count: 'exact' })
        .order('updated_at', { ascending: false });
      
      // Aplicar filtros
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      
      if (filters.channel) {
        query = query.eq('channel', filters.channel);
      }
      
      if (filters.agentId) {
        query = query.eq('agent_id', filters.agentId);
      }
      
      if (filters.departmentId) {
        query = query.eq('department_id', filters.departmentId);
      }
      
      if (filters.search) {
        query = query.ilike('title', `%${filters.search}%`);
      }
      
      // Paginação
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);
      
      const { data, error, count } = await query;
      
      if (error) {
        logger.error('Erro ao listar tickets:', { error, filters, page, limit });
        throw error;
      }
      
      return {
        data,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      };
    } catch (error) {
      logger.error('Erro ao listar tickets:', { error, filters, page, limit });
      throw error;
    }
  }
  
  // Obter estatísticas de tickets
  async getStats() {
    try {
      const { data, error } = await supabaseAdmin
        .from('tickets')
        .select('status, created_at, channel');
      
      if (error) {
        logger.error('Erro ao obter estatísticas de tickets:', error);
        throw error;
      }
      
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const stats = {
        total: data.length,
        open: data.filter(t => t.status === 'open').length,
        inProgress: data.filter(t => t.status === 'in_progress').length,
        resolved: data.filter(t => t.status === 'resolved').length,
        closed: data.filter(t => t.status === 'closed').length,
        today: data.filter(t => new Date(t.created_at) >= today).length,
        thisWeek: data.filter(t => new Date(t.created_at) >= thisWeek).length,
        thisMonth: data.filter(t => new Date(t.created_at) >= thisMonth).length,
        byChannel: {
          whatsapp: data.filter(t => t.channel === 'whatsapp').length,
          email: data.filter(t => t.channel === 'email').length,
          chat: data.filter(t => t.channel === 'chat').length
        }
      };
      
      return stats;
    } catch (error) {
      logger.error('Erro ao obter estatísticas de tickets:', error);
      throw error;
    }
  }
  
  // Buscar ticket por ID
  async findById(ticketId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('tickets')
        .select(`
          *,
          customer:profiles!tickets_customer_id_fkey(id, name, email, metadata),
          agent:profiles!tickets_agent_id_fkey(id, name, email)
        `)
        .eq('id', ticketId)
        .single();
      
      if (error) {
        logger.error('Erro ao buscar ticket por ID:', { error, ticketId });
        throw error;
      }
      
      return data;
    } catch (error) {
      logger.error('Erro ao buscar ticket por ID:', { error, ticketId });
      throw error;
    }
  }
}

module.exports = new TicketService(); 
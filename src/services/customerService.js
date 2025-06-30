const { supabaseAdmin } = require('../config/supabase');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

class CustomerService {
  
  // Buscar cliente por telefone
  async findByPhone(phone) {
    try {
      // Limpar o número (remover caracteres especiais)
      const cleanPhone = phone.replace(/\D/g, '');
      
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('role', 'customer')
        .or(`metadata->>phone.eq.${phone},metadata->>phone.eq.${cleanPhone}`)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        logger.error('Erro ao buscar cliente por telefone:', { error, phone });
        throw error;
      }
      
      return data;
    } catch (error) {
      logger.error('Erro ao buscar cliente por telefone:', { error, phone });
      throw error;
    }
  }
  
  // Buscar cliente por WhatsApp JID
  async findByWhatsAppJid(jid) {
    try {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('role', 'customer')
        .eq('metadata->>whatsapp_jid', jid)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        logger.error('Erro ao buscar cliente por JID:', { error, jid });
        throw error;
      }
      
      return data;
    } catch (error) {
      logger.error('Erro ao buscar cliente por JID:', { error, jid });
      throw error;
    }
  }
  
  // Criar novo cliente
  async create(customerData) {
    try {
      const customerId = uuidv4();
      
      const customer = {
        id: customerId,
        name: customerData.name || 'Cliente',
        email: customerData.email || null,
        role: 'customer',
        metadata: {
          phone: customerData.phone,
          whatsapp_jid: customerData.whatsappJid,
          push_name: customerData.pushName,
          created_from: 'whatsapp',
          ...customerData.metadata
        }
      };
      
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .insert(customer)
        .select()
        .single();
      
      if (error) {
        logger.error('Erro ao criar cliente:', { error, customerData });
        throw error;
      }
      
      logger.info('Cliente criado com sucesso:', { customerId: data.id, phone: customerData.phone });
      return data;
    } catch (error) {
      logger.error('Erro ao criar cliente:', { error, customerData });
      throw error;
    }
  }
  
  // Atualizar cliente
  async update(customerId, updateData) {
    try {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update(updateData)
        .eq('id', customerId)
        .select()
        .single();
      
      if (error) {
        logger.error('Erro ao atualizar cliente:', { error, customerId, updateData });
        throw error;
      }
      
      logger.info('Cliente atualizado com sucesso:', { customerId });
      return data;
    } catch (error) {
      logger.error('Erro ao atualizar cliente:', { error, customerId, updateData });
      throw error;
    }
  }
  
  // Buscar ou criar cliente baseado em dados do WhatsApp
  async findOrCreate(whatsappData) {
    try {
      // Primeiro, tentar buscar por JID
      let customer = await this.findByWhatsAppJid(whatsappData.jid);
      
      if (!customer) {
        // Se não encontrou por JID, tentar por telefone
        const phone = whatsappData.jid.split('@')[0];
        customer = await this.findByPhone(phone);
        
        if (customer) {
          // Atualizar com o JID
          customer = await this.update(customer.id, {
            metadata: {
              ...customer.metadata,
              whatsapp_jid: whatsappData.jid,
              push_name: whatsappData.pushName
            }
          });
        }
      }
      
      if (!customer) {
        // Criar novo cliente
        const phone = whatsappData.jid.split('@')[0];
        customer = await this.create({
          name: whatsappData.pushName || `Cliente ${phone}`,
          phone: phone,
          whatsappJid: whatsappData.jid,
          pushName: whatsappData.pushName
        });
      }
      
      return customer;
    } catch (error) {
      logger.error('Erro ao buscar ou criar cliente:', { error, whatsappData });
      throw error;
    }
  }
  
  // Listar clientes
  async list(page = 1, limit = 50, search = null) {
    try {
      let query = supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact' })
        .eq('role', 'customer')
        .order('created_at', { ascending: false });
      
      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,metadata->>phone.ilike.%${search}%`);
      }
      
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);
      
      const { data, error, count } = await query;
      
      if (error) {
        logger.error('Erro ao listar clientes:', { error, page, limit, search });
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
      logger.error('Erro ao listar clientes:', { error, page, limit, search });
      throw error;
    }
  }
  
  // Obter estatísticas de clientes
  async getStats() {
    try {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('created_at, metadata')
        .eq('role', 'customer');
      
      if (error) {
        logger.error('Erro ao obter estatísticas de clientes:', error);
        throw error;
      }
      
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const stats = {
        total: data.length,
        today: data.filter(c => new Date(c.created_at) >= today).length,
        thisWeek: data.filter(c => new Date(c.created_at) >= thisWeek).length,
        thisMonth: data.filter(c => new Date(c.created_at) >= thisMonth).length,
        whatsappOnly: data.filter(c => c.metadata?.created_from === 'whatsapp').length
      };
      
      return stats;
    } catch (error) {
      logger.error('Erro ao obter estatísticas de clientes:', error);
      throw error;
    }
  }
}

module.exports = new CustomerService(); 
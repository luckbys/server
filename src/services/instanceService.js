const { supabaseAdmin } = require('../config/supabase');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

class InstanceService {
  
  // Buscar instância por nome
  async findByName(instanceName) {
    try {
      const { data, error } = await supabaseAdmin
        .from('evolution_instances')
        .select('*')
        .eq('instance_name', instanceName)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        logger.error('Erro ao buscar instância por nome:', { error, instanceName });
        throw error;
      }
      
      return data;
    } catch (error) {
      logger.error('Erro ao buscar instância por nome:', { error, instanceName });
      throw error;
    }
  }
  
  // Buscar instância por ID
  async findById(instanceId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('evolution_instances')
        .select('*')
        .eq('id', instanceId)
        .single();
      
      if (error) {
        logger.error('Erro ao buscar instância por ID:', { error, instanceId });
        throw error;
      }
      
      return data;
    } catch (error) {
      logger.error('Erro ao buscar instância por ID:', { error, instanceId });
      throw error;
    }
  }
  
  // Criar nova instância
  async create(instanceData) {
    try {
      const instanceId = uuidv4();
      
      const instance = {
        id: instanceId,
        name: instanceData.name,
        instance_name: instanceData.instanceName,
        api_url: instanceData.apiUrl,
        api_key: instanceData.apiKey,
        webhook_url: instanceData.webhookUrl || null,
        status: 'disconnected',
        department_id: instanceData.departmentId || null,
        is_default: instanceData.isDefault || false,
        metadata: {
          created_at: new Date().toISOString(),
          ...instanceData.metadata
        }
      };
      
      // Se esta instância deve ser padrão, desmarcar outras
      if (instance.is_default) {
        await this.unsetDefaultInstances();
      }
      
      const { data, error } = await supabaseAdmin
        .from('evolution_instances')
        .insert(instance)
        .select()
        .single();
      
      if (error) {
        logger.error('Erro ao criar instância:', { error, instanceData });
        throw error;
      }
      
      logger.info('Instância criada com sucesso:', { instanceId: data.id, name: data.name });
      return data;
    } catch (error) {
      logger.error('Erro ao criar instância:', { error, instanceData });
      throw error;
    }
  }
  
  // Atualizar instância
  async update(instanceId, updateData) {
    try {
      // Se marcando como padrão, desmarcar outras
      if (updateData.is_default) {
        await this.unsetDefaultInstances();
      }
      
      const { data, error } = await supabaseAdmin
        .from('evolution_instances')
        .update(updateData)
        .eq('id', instanceId)
        .select()
        .single();
      
      if (error) {
        logger.error('Erro ao atualizar instância:', { error, instanceId, updateData });
        throw error;
      }
      
      logger.info('Instância atualizada com sucesso:', { instanceId });
      return data;
    } catch (error) {
      logger.error('Erro ao atualizar instância:', { error, instanceId, updateData });
      throw error;
    }
  }
  
  // Deletar instância
  async delete(instanceId) {
    try {
      const { error } = await supabaseAdmin
        .from('evolution_instances')
        .delete()
        .eq('id', instanceId);
      
      if (error) {
        logger.error('Erro ao deletar instância:', { error, instanceId });
        throw error;
      }
      
      logger.info('Instância deletada com sucesso:', { instanceId });
      return true;
    } catch (error) {
      logger.error('Erro ao deletar instância:', { error, instanceId });
      throw error;
    }
  }
  
  // Atualizar status da instância
  async updateStatus(instanceName, status, metadata = {}) {
    try {
      const instance = await this.findByName(instanceName);
      if (!instance) {
        logger.warn('Tentativa de atualizar status de instância inexistente:', { instanceName });
        return null;
      }
      
      const updatedInstance = await this.update(instance.id, {
        status,
        metadata: {
          ...instance.metadata,
          last_status_update: new Date().toISOString(),
          ...metadata
        }
      });
      
      logger.info('Status da instância atualizado:', { instanceName, status });
      return updatedInstance;
    } catch (error) {
      logger.error('Erro ao atualizar status da instância:', { error, instanceName, status });
      throw error;
    }
  }
  
  // Desmarcar todas as instâncias como padrão
  async unsetDefaultInstances() {
    try {
      const { error } = await supabaseAdmin
        .from('evolution_instances')
        .update({ is_default: false })
        .eq('is_default', true);
      
      if (error) {
        logger.error('Erro ao desmarcar instâncias padrão:', error);
        throw error;
      }
    } catch (error) {
      logger.error('Erro ao desmarcar instâncias padrão:', error);
      throw error;
    }
  }
  
  // Buscar instância padrão
  async getDefault() {
    try {
      const { data, error } = await supabaseAdmin
        .from('evolution_instances')
        .select('*')
        .eq('is_default', true)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        logger.error('Erro ao buscar instância padrão:', error);
        throw error;
      }
      
      return data;
    } catch (error) {
      logger.error('Erro ao buscar instância padrão:', error);
      throw error;
    }
  }
  
  // Listar instâncias
  async list(page = 1, limit = 50, filters = {}) {
    try {
      let query = supabaseAdmin
        .from('evolution_instances')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });
      
      // Aplicar filtros
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      
      if (filters.departmentId) {
        query = query.eq('department_id', filters.departmentId);
      }
      
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,instance_name.ilike.%${filters.search}%`);
      }
      
      // Paginação
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);
      
      const { data, error, count } = await query;
      
      if (error) {
        logger.error('Erro ao listar instâncias:', { error, filters, page, limit });
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
      logger.error('Erro ao listar instâncias:', { error, filters, page, limit });
      throw error;
    }
  }
  
  // Buscar instâncias ativas
  async getActiveInstances() {
    try {
      const { data, error } = await supabaseAdmin
        .from('evolution_instances')
        .select('*')
        .eq('status', 'connected');
      
      if (error) {
        logger.error('Erro ao buscar instâncias ativas:', error);
        throw error;
      }
      
      return data;
    } catch (error) {
      logger.error('Erro ao buscar instâncias ativas:', error);
      throw error;
    }
  }
  
  // Obter estatísticas de instâncias
  async getStats() {
    try {
      const { data, error } = await supabaseAdmin
        .from('evolution_instances')
        .select('status, metadata');
      
      if (error) {
        logger.error('Erro ao obter estatísticas de instâncias:', error);
        throw error;
      }
      
      const stats = {
        total: data.length,
        connected: data.filter(i => i.status === 'connected').length,
        disconnected: data.filter(i => i.status === 'disconnected').length,
        error: data.filter(i => i.status === 'error').length,
        hasDefault: data.some(i => i.is_default)
      };
      
      return stats;
    } catch (error) {
      logger.error('Erro ao obter estatísticas de instâncias:', error);
      throw error;
    }
  }
  
  // Validar se instância existe e está ativa
  async validateInstance(instanceName) {
    try {
      const instance = await this.findByName(instanceName);
      
      if (!instance) {
        return { valid: false, error: 'Instância não encontrada' };
      }
      
      if (instance.status !== 'connected') {
        return { valid: false, error: 'Instância não está conectada' };
      }
      
      return { valid: true, instance };
    } catch (error) {
      logger.error('Erro ao validar instância:', { error, instanceName });
      return { valid: false, error: 'Erro interno' };
    }
  }
}

module.exports = new InstanceService(); 
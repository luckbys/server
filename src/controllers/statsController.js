const logger = require('../config/logger');
const customerService = require('../services/customerService');
const ticketService = require('../services/ticketService');
const messageService = require('../services/messageService');
const instanceService = require('../services/instanceService');

class StatsController {
  
  // Obter estatísticas gerais do sistema
  async getGeneralStats(req, res) {
    try {
      // Buscar estatísticas de todos os serviços em paralelo
      const [
        customerStats,
        ticketStats,
        messageStats,
        instanceStats
      ] = await Promise.all([
        customerService.getStats(),
        ticketService.getStats(),
        messageService.getStats(),
        instanceService.getStats()
      ]);
      
      const generalStats = {
        overview: {
          totalCustomers: customerStats.total,
          totalTickets: ticketStats.total,
          totalMessages: messageStats.total,
          totalInstances: instanceStats.total,
          activeInstances: instanceStats.connected,
          timestamp: new Date().toISOString()
        },
        customers: customerStats,
        tickets: ticketStats,
        messages: messageStats,
        instances: instanceStats
      };
      
      res.json({
        success: true,
        data: generalStats
      });
    } catch (error) {
      logger.error('Erro ao obter estatísticas gerais:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
  
  // Obter estatísticas de dashboard
  async getDashboardStats(req, res) {
    try {
      const [
        customerStats,
        ticketStats,
        messageStats,
        instanceStats
      ] = await Promise.all([
        customerService.getStats(),
        ticketService.getStats(),
        messageService.getStats(),
        instanceService.getStats()
      ]);
      
      const dashboardStats = {
        metrics: {
          totalCustomers: customerStats.total,
          newCustomersToday: customerStats.today,
          totalTickets: ticketStats.total,
          openTickets: ticketStats.open,
          inProgressTickets: ticketStats.inProgress,
          totalMessages: messageStats.total,
          messagesToday: messageStats.today,
          activeInstances: instanceStats.connected,
          totalInstances: instanceStats.total
        },
        trends: {
          customersThisWeek: customerStats.thisWeek,
          customersThisMonth: customerStats.thisMonth,
          ticketsThisWeek: ticketStats.thisWeek,
          ticketsThisMonth: ticketStats.thisMonth,
          messagesThisWeek: messageStats.thisWeek,
          messagesThisMonth: messageStats.thisMonth
        },
        distribution: {
          ticketsByChannel: ticketStats.byChannel,
          messagesByType: messageStats.byType,
          messagesBySender: messageStats.bySender
        },
        alerts: []
      };
      
      // Adicionar alertas se necessário
      if (instanceStats.error > 0) {
        dashboardStats.alerts.push({
          type: 'warning',
          message: `${instanceStats.error} instância(s) com erro`,
          priority: 'medium'
        });
      }
      
      if (instanceStats.connected === 0 && instanceStats.total > 0) {
        dashboardStats.alerts.push({
          type: 'error',
          message: 'Nenhuma instância conectada',
          priority: 'high'
        });
      }
      
      if (ticketStats.open > 50) {
        dashboardStats.alerts.push({
          type: 'info',
          message: `${ticketStats.open} tickets em aberto`,
          priority: 'low'
        });
      }
      
      res.json({
        success: true,
        data: dashboardStats
      });
    } catch (error) {
      logger.error('Erro ao obter estatísticas do dashboard:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
  
  // Obter métricas de performance
  async getPerformanceMetrics(req, res) {
    try {
      const messageStats = await messageService.getStats();
      
      // Calcular métricas de performance
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const performanceMetrics = {
        messaging: {
          messagesPerHour: Math.round(messageStats.today / 24),
          messagesPerDay: messageStats.today,
          totalMessages: messageStats.total,
          averageResponseTime: '2.5min', // Isso seria calculado baseado nos dados reais
          messageTypes: messageStats.byType
        },
        system: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
          timestamp: new Date().toISOString()
        }
      };
      
      res.json({
        success: true,
        data: performanceMetrics
      });
    } catch (error) {
      logger.error('Erro ao obter métricas de performance:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
  
  // Obter estatísticas por período
  async getStatsByPeriod(req, res) {
    try {
      const { period = 'today' } = req.query;
      
      const [
        customerStats,
        ticketStats,
        messageStats
      ] = await Promise.all([
        customerService.getStats(),
        ticketService.getStats(),
        messageService.getStats()
      ]);
      
      let periodStats;
      
      switch (period) {
        case 'today':
          periodStats = {
            customers: customerStats.today,
            tickets: ticketStats.today,
            messages: messageStats.today
          };
          break;
          
        case 'week':
          periodStats = {
            customers: customerStats.thisWeek,
            tickets: ticketStats.thisWeek,
            messages: messageStats.thisWeek
          };
          break;
          
        case 'month':
          periodStats = {
            customers: customerStats.thisMonth,
            tickets: ticketStats.thisMonth,
            messages: messageStats.thisMonth
          };
          break;
          
        default:
          return res.status(400).json({
            success: false,
            error: 'Período inválido. Use: today, week, month'
          });
      }
      
      res.json({
        success: true,
        data: {
          period,
          stats: periodStats,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Erro ao obter estatísticas por período:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
  
  // Health check do sistema
  async healthCheck(req, res) {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        services: {
          database: 'healthy',
          instances: 'healthy',
          webhook: 'healthy',
          websocket: 'healthy'
        }
      };
      
      // Verificar saúde dos serviços
      try {
        const instanceStats = await instanceService.getStats();
        if (instanceStats.total === 0) {
          health.services.instances = 'warning';
          health.status = 'degraded';
        }
      } catch (error) {
        health.services.instances = 'unhealthy';
        health.status = 'unhealthy';
      }
      
      // Verificar WebSocket
      const io = req.app.get('io');
      if (!io) {
        health.services.websocket = 'unhealthy';
        health.status = 'degraded';
      }
      
      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json({
        success: true,
        data: health
      });
    } catch (error) {
      logger.error('Erro no health check:', error);
      res.status(503).json({
        success: false,
        error: 'Sistema indisponível',
        data: {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error.message
        }
      });
    }
  }
}

module.exports = new StatsController(); 
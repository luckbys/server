-- Migration: Create events table
-- Version: 002
-- Description: Tabela para armazenar eventos da Evolution API

CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    instance_name VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para otimização
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_instance_name ON events(instance_name);
CREATE INDEX IF NOT EXISTS idx_events_processed ON events(processed);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_retry_count ON events(retry_count);

-- Índice GIN para consultas no JSON
CREATE INDEX IF NOT EXISTS idx_events_data_gin ON events USING GIN (event_data);

-- Índice composto para consultas comuns
CREATE INDEX IF NOT EXISTS idx_events_type_instance_created 
ON events(event_type, instance_name, created_at DESC);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_events_updated_at 
    BEFORE UPDATE ON events 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column(); 
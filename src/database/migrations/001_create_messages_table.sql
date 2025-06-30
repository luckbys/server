-- Migration: Create messages table
-- Version: 001
-- Description: Tabela principal para armazenar mensagens do WhatsApp

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evolution_id VARCHAR(255) NOT NULL,
    instance_name VARCHAR(100) NOT NULL,
    remote_jid VARCHAR(255) NOT NULL,
    from_me BOOLEAN NOT NULL DEFAULT FALSE,
    push_name VARCHAR(255),
    message_type VARCHAR(50) NOT NULL,
    content TEXT,
    media_url TEXT,
    media_type VARCHAR(50),
    media_caption TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para otimização
CREATE INDEX IF NOT EXISTS idx_messages_evolution_id ON messages(evolution_id);
CREATE INDEX IF NOT EXISTS idx_messages_instance_name ON messages(instance_name);
CREATE INDEX IF NOT EXISTS idx_messages_remote_jid ON messages(remote_jid);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_processed ON messages(processed);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Índice composto para consultas comuns
CREATE INDEX IF NOT EXISTS idx_messages_instance_jid_timestamp 
ON messages(instance_name, remote_jid, timestamp DESC);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_messages_updated_at 
    BEFORE UPDATE ON messages 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column(); 
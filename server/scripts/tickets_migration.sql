-- =============================================================
-- MIGRATION: Tickets System - Production Ready
-- Date: 2026-02-02
-- Description: Fix support_tickets FK, create message tables
-- =============================================================

-- 1. Drop existing support_tickets if exists (had wrong INTEGER FK)
DROP TABLE IF EXISTS support_tickets CASCADE;

-- 2. Create support_tickets with correct UUID types
CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_role VARCHAR(20) NOT NULL DEFAULT 'provider',  -- 'provider', 'admin', 'client'
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,  -- For admin-initiated tickets
    subject VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'Abierto',  -- Abierto, En Proceso, Resuelto, Cerrado
    priority VARCHAR(20) DEFAULT 'Media',  -- Baja, Media, Alta, Urgente
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for support_tickets
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_target_user_id ON support_tickets(target_user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

-- 3. Create ticket_messages table for chat
CREATE TABLE IF NOT EXISTS ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_role VARCHAR(20) NOT NULL,  -- 'provider', 'admin', 'client'
    message TEXT NOT NULL,
    attachment_url VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for ticket_messages
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_sender_id ON ticket_messages(sender_id);

-- 4. Create claim_messages table for claims chat
CREATE TABLE IF NOT EXISTS claim_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_role VARCHAR(20) NOT NULL,  -- 'client', 'admin'
    message TEXT NOT NULL,
    attachment_url VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for claim_messages
CREATE INDEX IF NOT EXISTS idx_claim_messages_claim_id ON claim_messages(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_messages_sender_id ON claim_messages(sender_id);

-- 5. Add resolution fields to claims if not exists
ALTER TABLE claims ADD COLUMN IF NOT EXISTS resolution VARCHAR(50);  -- 'client_favor', 'provider_favor', NULL
ALTER TABLE claims ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES users(id);

-- =============================================================
-- MIGRATION COMPLETE
-- =============================================================

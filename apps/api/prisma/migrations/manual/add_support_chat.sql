-- Support chat system: conversations, messages, visit requests

CREATE TYPE support_conversation_type AS ENUM ('visit', 'info_request', 'report', 'faq');
CREATE TYPE support_conversation_status AS ENUM ('active', 'resolved', 'cancelled');
CREATE TYPE support_message_sender AS ENUM ('user', 'bot', 'admin');
CREATE TYPE visit_request_status AS ENUM ('pending', 'confirmed', 'rejected', 'cancelled', 'completed');

CREATE TABLE IF NOT EXISTS support_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  type support_conversation_type NOT NULL,
  status support_conversation_status NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_conv_user ON support_conversations(user_id, created_at DESC);
CREATE INDEX idx_support_conv_status ON support_conversations(status);

CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
  sender support_message_sender NOT NULL,
  content TEXT NOT NULL,
  options JSONB,
  node_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_msg_conv ON support_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS visit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preferred_date DATE NOT NULL,
  preferred_time VARCHAR(10) NOT NULL,
  message TEXT,
  status visit_request_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_visit_req_user ON visit_requests(user_id, created_at DESC);
CREATE INDEX idx_visit_req_owner ON visit_requests(owner_id, status);
CREATE INDEX idx_visit_req_property ON visit_requests(property_id);

-- Grants solo si el rol de la app existe (en despliegues donde la app usa
-- el mismo usuario que ejecuta las migraciones, no hace falta)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'inmobiliaria_app') THEN
    GRANT ALL PRIVILEGES ON TABLE support_conversations TO inmobiliaria_app;
    GRANT ALL PRIVILEGES ON TABLE support_messages TO inmobiliaria_app;
    GRANT ALL PRIVILEGES ON TABLE visit_requests TO inmobiliaria_app;
  END IF;
END $$;

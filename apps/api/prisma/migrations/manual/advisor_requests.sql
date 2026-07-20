-- Solicitudes de asesor ("vende/alquila por mí"): nuevo tipo de conversación de soporte.
-- El propietario llena un formulario corto (qué necesita, nombre, whatsapp) en vez de
-- un chat en vivo; un asesor humano lo contacta por WhatsApp desde el panel admin.
ALTER TYPE support_conversation_type ADD VALUE IF NOT EXISTS 'advisor_request';

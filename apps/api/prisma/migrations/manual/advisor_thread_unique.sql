-- Un solo hilo de asesoría por usuario: evita que dos mensajes casi
-- simultáneos (dos pestañas, doble tap) creen dos support_conversations
-- de tipo advisor_request para el mismo usuario.
CREATE UNIQUE INDEX IF NOT EXISTS support_conversations_advisor_unique
  ON support_conversations (user_id)
  WHERE type = 'advisor_request';

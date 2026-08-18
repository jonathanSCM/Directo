import React, { createContext, useCallback, useContext, useState } from 'react';

interface SupportChatContextType {
  visible: boolean;
  openChat: () => void;
  closeChat: () => void;
}

const SupportChatContext = createContext<SupportChatContextType | null>(null);

export function useSupportChat() {
  const ctx = useContext(SupportChatContext);
  if (!ctx) throw new Error('useSupportChat must be inside SupportChatProvider');
  return ctx;
}

/** Estado compartido de visibilidad del chat de asistente — así se puede
 * abrir tanto desde el botón flotante como desde otros lugares (ej. perfil). */
export function SupportChatProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const openChat = useCallback(() => setVisible(true), []);
  const closeChat = useCallback(() => setVisible(false), []);

  return (
    <SupportChatContext.Provider value={{ visible, openChat, closeChat }}>
      {children}
    </SupportChatContext.Provider>
  );
}

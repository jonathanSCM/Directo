import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';
import api from '../../services/api';

const OWNER_PRIMARY = '#7C3AED';
const OWNER_LIGHT = '#EDE9FE';
const OWNER_DARK = '#6D28D9';

interface Message {
  id: string;
  sender: 'user' | 'bot' | 'admin';
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  type: string;
  status: string;
  created_at: string;
  support_messages?: Message[];
}

export default function OwnerSupportFAB() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  if (!user || user.active_role !== 'owner') return null;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.85, duration: 100, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    setVisible(true);
  };

  return (
    <>
      <Animated.View style={[styles.fabContainer, { transform: [{ scale }] }]}>
        <TouchableOpacity style={styles.fab} onPress={handlePress} activeOpacity={0.8}>
          <Ionicons name="headset" size={24} color={Colors.white} />
        </TouchableOpacity>
      </Animated.View>
      <OwnerChatScreen visible={visible} onClose={() => setVisible(false)} />
    </>
  );
}

function OwnerChatScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { isAuthenticated, user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [view, setView] = useState<'list' | 'chat'>('list');
  const flatListRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollDown = () => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

  const fetchConversations = useCallback(async () => {
    try {
      const { data } = await api.get('/support/conversations');
      setConversations(data);
    } catch {}
  }, []);

  const fetchMessages = useCallback(async (convId: string) => {
    try {
      const { data } = await api.get(`/support/conversations/${convId}/messages`);
      setMessages(data.messages ?? data);
      scrollDown();
    } catch {}
  }, []);

  useEffect(() => {
    if (visible) {
      fetchConversations();
      setView('list');
      setActiveConv(null);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [visible, fetchConversations]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (activeConv && view === 'chat') {
      pollRef.current = setInterval(() => fetchMessages(activeConv.id), 5000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeConv, view, fetchMessages]);

  const openConversation = async (conv: Conversation) => {
    setActiveConv(conv);
    setView('chat');
    setLoading(true);
    await fetchMessages(conv.id);
    setLoading(false);
  };

  const startNewConversation = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/support/conversations', { type: 'info_request' });
      setActiveConv(data);
      setView('chat');
      setMessages([]);
      await api.post(`/support/conversations/${data.id}/messages`, {
        content: `Hola, soy ${user?.name}. Necesito ayuda.`,
      });
      await fetchMessages(data.id);
    } catch {}
    setLoading(false);
  };

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || !activeConv || sending) return;
    setInputText('');
    setSending(true);
    try {
      await api.post(`/support/conversations/${activeConv.id}/messages`, { content: text });
      await fetchMessages(activeConv.id);
    } catch {}
    setSending(false);
  };

  if (!isAuthenticated) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.botAvatar}><Ionicons name="headset" size={18} color={Colors.white} /></View>
              <Text style={styles.headerTitle}>Soporte</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>
          <View style={styles.authPrompt}>
            <Ionicons name="headset-outline" size={64} color={Colors.gray[300]} />
            <Text style={styles.authTitle}>Inicia sesión</Text>
            <Text style={styles.authText}>Necesitas una cuenta para contactar soporte</Text>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {view === 'chat' && (
              <TouchableOpacity onPress={() => { setView('list'); fetchConversations(); }} hitSlop={8} style={{ marginRight: 8 }}>
                <Ionicons name="arrow-back" size={22} color={Colors.white} />
              </TouchableOpacity>
            )}
            <View style={styles.botAvatar}><Ionicons name="headset" size={18} color={Colors.white} /></View>
            <View>
              <Text style={styles.headerTitle}>{view === 'chat' ? 'Soporte DIRECTO' : 'Mis conversaciones'}</Text>
              {view === 'chat' && (
                <View style={styles.onlineRow}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.onlineText}>Soporte técnico</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>

        {view === 'list' ? (
          <View style={{ flex: 1 }}>
            <TouchableOpacity style={styles.newConvBtn} onPress={startNewConversation}>
              <Ionicons name="add-circle" size={22} color={Colors.white} />
              <Text style={styles.newConvText}>Nueva conversación</Text>
            </TouchableOpacity>

            {conversations.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={48} color={Colors.gray[300]} />
                <Text style={styles.emptyTitle}>Sin conversaciones</Text>
                <Text style={styles.emptyText}>Inicia una conversación con nuestro equipo de soporte</Text>
              </View>
            ) : (
              <FlatList
                data={conversations}
                keyExtractor={(c) => c.id}
                contentContainerStyle={{ padding: Spacing.md }}
                renderItem={({ item }) => {
                  const lastMsg = item.support_messages?.[item.support_messages.length - 1];
                  const isResolved = item.status === 'resolved';
                  return (
                    <TouchableOpacity style={styles.convItem} onPress={() => openConversation(item)} activeOpacity={0.7}>
                      <View style={[styles.convIcon, isResolved && { backgroundColor: Colors.gray[200] }]}>
                        <Ionicons name={isResolved ? 'checkmark-circle' : 'chatbubble'} size={18} color={isResolved ? Colors.gray[500] : Colors.white} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={styles.convType}>
                            {item.type === 'info_request' ? 'Consulta' : item.type === 'report' ? 'Reporte' : 'Soporte'}
                          </Text>
                          <Text style={styles.convDate}>
                            {new Date(item.created_at).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })}
                          </Text>
                        </View>
                        <Text style={styles.convPreview} numberOfLines={1}>
                          {lastMsg ? (lastMsg.sender === 'admin' ? 'Soporte: ' : '') + lastMsg.content : 'Sin mensajes'}
                        </Text>
                      </View>
                      {!isResolved && lastMsg?.sender === 'admin' && (
                        <View style={styles.unreadDot} />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        ) : (
          <>
            {loading ? (
              <View style={styles.emptyState}>
                <Text style={{ color: Colors.gray[400] }}>Cargando...</Text>
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(m) => m.id}
                contentContainerStyle={styles.messageList}
                onContentSizeChange={scrollDown}
                renderItem={({ item }) => {
                  const isUser = item.sender === 'user';
                  const isAdmin = item.sender === 'admin';
                  return (
                    <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
                      {!isUser && (
                        <View style={[styles.msgAvatar, isAdmin && styles.adminAvatar]}>
                          <Ionicons name={isAdmin ? 'person' : 'chatbubbles'} size={12} color={Colors.white} />
                        </View>
                      )}
                      <View style={[styles.bubbleContent, isUser && styles.userBubbleContent]}>
                        {isAdmin && <Text style={styles.adminLabel}>Soporte</Text>}
                        <Text style={[styles.msgText, isUser && styles.userMsgText]}>{item.content}</Text>
                        <Text style={[styles.timeText, isUser && { color: 'rgba(255,255,255,0.6)' }]}>
                          {new Date(item.created_at).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>
                  );
                }}
              />
            )}

            {activeConv?.status !== 'resolved' ? (
              <View style={styles.inputBar}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Escribe tu mensaje..."
                  placeholderTextColor={Colors.gray[400]}
                  value={inputText}
                  onChangeText={setInputText}
                  onSubmitEditing={sendMessage}
                  returnKeyType="send"
                  multiline
                  maxLength={1000}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, !inputText.trim() && styles.sendBtnOff]}
                  onPress={sendMessage}
                  disabled={!inputText.trim() || sending}
                >
                  <Ionicons name="send" size={18} color={Colors.white} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.resolvedBar}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                <Text style={styles.resolvedText}>Conversación resuelta</Text>
              </View>
            )}
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fabContainer: { position: 'absolute', bottom: 90, right: 16, zIndex: 999 },
  fab: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: OWNER_PRIMARY,
    justifyContent: 'center', alignItems: 'center',
    elevation: 6, shadowColor: OWNER_PRIMARY,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  container: { flex: 1, backgroundColor: '#F5F3FF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingTop: 54, paddingBottom: Spacing.md,
    backgroundColor: OWNER_PRIMARY,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  botAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.white },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' },
  onlineText: { fontSize: Fonts.sizes.xs, color: 'rgba(255,255,255,0.8)' },

  newConvBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: OWNER_PRIMARY, marginHorizontal: Spacing.lg, marginTop: Spacing.lg,
    paddingVertical: 14, borderRadius: Radius.lg,
  },
  newConvText: { color: Colors.white, fontWeight: '700', fontSize: Fonts.sizes.md },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxxl },
  emptyTitle: { fontSize: Fonts.sizes.lg, fontWeight: '600', color: Colors.gray[700], marginTop: Spacing.lg },
  emptyText: { fontSize: Fonts.sizes.md, color: Colors.gray[400], textAlign: 'center', marginTop: Spacing.sm },

  convItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.lg, marginBottom: Spacing.sm,
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  convIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: OWNER_PRIMARY,
    justifyContent: 'center', alignItems: 'center',
  },
  convType: { fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.gray[800] },
  convDate: { fontSize: Fonts.sizes.xs, color: Colors.gray[400] },
  convPreview: { fontSize: Fonts.sizes.sm, color: Colors.gray[500], marginTop: 2 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: OWNER_PRIMARY },

  messageList: { padding: Spacing.md, paddingBottom: 20 },
  bubble: { flexDirection: 'row', marginBottom: Spacing.sm, maxWidth: '88%' },
  botBubble: { alignSelf: 'flex-start' },
  userBubble: { alignSelf: 'flex-end' },
  msgAvatar: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.gray[400],
    justifyContent: 'center', alignItems: 'center', marginRight: 6, marginTop: 2,
  },
  adminAvatar: { backgroundColor: OWNER_PRIMARY },
  bubbleContent: {
    backgroundColor: Colors.white, padding: Spacing.md, borderRadius: 18,
    borderTopLeftRadius: 4, elevation: 1, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, flexShrink: 1,
  },
  userBubbleContent: {
    backgroundColor: OWNER_PRIMARY, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    borderBottomRightRadius: 4, borderBottomLeftRadius: 18,
  },
  adminLabel: { fontSize: 10, fontWeight: '700', color: OWNER_PRIMARY, marginBottom: 2 },
  msgText: { fontSize: Fonts.sizes.md, color: Colors.gray[800], lineHeight: 22 },
  userMsgText: { color: Colors.white },
  timeText: { fontSize: 10, color: Colors.gray[400], marginTop: 4, textAlign: 'right' },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', padding: Spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 30 : Spacing.sm, backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.gray[100], gap: Spacing.sm,
  },
  textInput: {
    flex: 1, minHeight: 42, maxHeight: 100, paddingHorizontal: Spacing.lg, paddingVertical: 10,
    borderRadius: 24, backgroundColor: '#F5F3FF', fontSize: Fonts.sizes.md, color: Colors.gray[800],
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: OWNER_PRIMARY,
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnOff: { backgroundColor: Colors.gray[300] },

  resolvedBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: Spacing.lg, backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.gray[100],
  },
  resolvedText: { fontSize: Fonts.sizes.sm, color: Colors.gray[500], fontWeight: '500' },

  authPrompt: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxxl },
  authTitle: { fontSize: Fonts.sizes.lg, fontWeight: '600', color: Colors.gray[700], marginTop: Spacing.lg },
  authText: { fontSize: Fonts.sizes.md, color: Colors.gray[400], textAlign: 'center', marginTop: Spacing.sm },
});

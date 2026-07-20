import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
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

// En escritorio web el chat es una ventana flotante, no pantalla completa
const isWeb = Platform.OS === 'web';
const floatingWeb = isWeb && Dimensions.get('window').width >= 768;

const OWNER_PRIMARY = '#7C3AED';

// Sugerencias rápidas: solo un atajo, escribir libre siempre funciona igual.
const NEED_OPTIONS: { id: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'sell', label: 'Vender mi propiedad', icon: 'cash-outline' },
  { id: 'rent', label: 'Alquilar mi propiedad', icon: 'key-outline' },
  { id: 'anticretico', label: 'Poner en anticrético', icon: 'swap-horizontal-outline' },
  { id: 'full_service', label: 'No tengo tiempo, quiero ayuda con todo', icon: 'time-outline' },
];

interface Message {
  id: string;
  sender: 'user' | 'bot' | 'admin';
  content: string;
  created_at: string;
}

interface Thread {
  id: string;
  status: string;
  metadata?: { need?: string; details?: string; contact_name?: string; contact_phone?: string };
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
      <AssistantScreen visible={visible} onClose={() => setVisible(false)} />
    </>
  );
}

// Un solo hilo persistente por propietario (no una lista de tickets): siempre
// se abre el mismo chat, con toda la memoria de lo ya conversado.
function AssistantScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { isAuthenticated } = useAuth();
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollDown = () => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

  const load = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    try {
      const { data } = await api.get('/support/advisor-thread');
      setThread(data.conversation);
      setMessages((prev) => {
        if (data.messages.length !== prev.length) scrollDown();
        return data.messages;
      });
    } catch {}
    if (showSpinner) setLoading(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    load(true);
  }, [visible, load]);

  // Polling suave para ver respuestas de un admin humano mientras el chat está abierto.
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!visible) return;
    pollRef.current = setInterval(() => load(false), 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [visible, load]);

  const send = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content || sending) return;
    setInputText('');
    setSending(true);
    // Optimista: se ve al instante, la respuesta real del asistente llega después.
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempId, sender: 'user', content, created_at: new Date().toISOString() },
    ]);
    scrollDown();
    try {
      const { data } = await api.post('/support/advisor-thread/messages', { content });
      setThread(data.conversation);
      setMessages(data.messages);
      scrollDown();
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInputText(content);
    }
    setSending(false);
  }, [sending]);

  if (!isAuthenticated) {
    return (
      <Modal visible={visible} transparent={floatingWeb} animationType={floatingWeb ? 'fade' : 'slide'} onRequestClose={onClose}>
        <View style={floatingWeb ? styles.webOverlay : styles.fill} pointerEvents="box-none">
        <View style={[styles.container, floatingWeb && styles.webFloating]}>
          <View style={[styles.header, floatingWeb && styles.webHeader]}>
            <View style={styles.headerLeft}>
              <View style={styles.botAvatar}><Ionicons name="headset" size={18} color={Colors.white} /></View>
              <Text style={styles.headerTitle}>Asistente DIRECTO</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>
          <View style={styles.authPrompt}>
            <Ionicons name="headset-outline" size={64} color={Colors.gray[300]} />
            <Text style={styles.authTitle}>Inicia sesión</Text>
            <Text style={styles.authText}>Necesitas una cuenta para hablar con el asistente</Text>
          </View>
        </View>
        </View>
      </Modal>
    );
  }

  const needKnown = !!thread?.metadata?.need;

  return (
    <Modal visible={visible} transparent={floatingWeb} animationType={floatingWeb ? 'fade' : 'slide'} onRequestClose={onClose}>
      <View style={floatingWeb ? styles.webOverlay : styles.fill} pointerEvents="box-none">
      <KeyboardAvoidingView style={[styles.container, floatingWeb && styles.webFloating]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, floatingWeb && styles.webHeader]}>
          <View style={styles.headerLeft}>
            <View style={styles.botAvatar}><Ionicons name="headset" size={18} color={Colors.white} /></View>
            <View>
              <Text style={styles.headerTitle}>Asistente DIRECTO</Text>
              <View style={styles.onlineRow}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>
                  {needKnown ? 'Un asesor te contactará por WhatsApp' : 'Cuéntame qué necesitas'}
                </Text>
              </View>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>

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
                    {isAdmin && <Text style={styles.adminLabel}>Asesor</Text>}
                    <Text style={[styles.msgText, isUser && styles.userMsgText]}>{item.content}</Text>
                    <Text style={[styles.timeText, isUser && { color: 'rgba(255,255,255,0.6)' }]}>
                      {new Date(item.created_at).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              );
            }}
            ListFooterComponent={
              !needKnown ? (
                <View style={styles.quickReplies}>
                  {NEED_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.id}
                      style={styles.needChip}
                      onPress={() => send(opt.label)}
                      activeOpacity={0.8}
                      disabled={sending}
                    >
                      <Ionicons name={opt.icon} size={16} color={OWNER_PRIMARY} />
                      <Text style={styles.needChipText}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null
            }
          />
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder="Escribe qué necesitas..."
            placeholderTextColor={Colors.gray[400]}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => send(inputText)}
            returnKeyType="send"
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnOff]}
            onPress={() => send(inputText)}
            disabled={!inputText.trim() || sending}
          >
            <Ionicons name="send" size={18} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      </View>
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
  fill: { flex: 1 },
  webOverlay: {
    // @ts-ignore — fixed existe en web
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  },
  webFloating: {
    position: 'absolute', bottom: 24, right: 24,
    width: 400, height: 640, maxHeight: '88%',
    borderRadius: 16, overflow: 'hidden',
    boxShadow: '0 16px 48px rgba(0,0,0,0.28)' as any,
  },
  webHeader: { paddingTop: Spacing.md },
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

  quickReplies: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, gap: 8 },
  needChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.gray[200],
    backgroundColor: Colors.white, alignSelf: 'flex-start',
  },
  needChipText: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.gray[700], flexShrink: 1 },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxxl },

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

  authPrompt: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxxl },
  authTitle: { fontSize: Fonts.sizes.lg, fontWeight: '600', color: Colors.gray[700], marginTop: Spacing.lg },
  authText: { fontSize: Fonts.sizes.md, color: Colors.gray[400], textAlign: 'center', marginTop: Spacing.sm },
});

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
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

const notice = (title: string, msg: string) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
};

const NEED_OPTIONS: { id: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'sell', label: 'Vender mi propiedad', icon: 'cash-outline' },
  { id: 'rent', label: 'Alquilar mi propiedad', icon: 'key-outline' },
  { id: 'anticretico', label: 'Poner en anticrético', icon: 'swap-horizontal-outline' },
  { id: 'full_service', label: 'No tengo tiempo, quiero ayuda con todo', icon: 'time-outline' },
  { id: 'other', label: 'Otro', icon: 'ellipsis-horizontal-outline' },
];

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
  metadata?: { contact_name?: string; contact_phone?: string; need?: string; details?: string };
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
      <AdvisorScreen visible={visible} onClose={() => setVisible(false)} />
    </>
  );
}

function AdvisorScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { isAuthenticated, user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [view, setView] = useState<'form' | 'chat' | 'list'>('form');
  const flatListRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Intake conversacional (reemplaza el formulario estático)
  const [intakeLog, setIntakeLog] = useState<{ id: string; sender: 'bot' | 'user'; text: string }[]>([]);
  const [intakePhase, setIntakePhase] = useState<'need' | 'gather'>('need');
  const [need, setNeed] = useState<string | null>(null);
  const [detailsMsgs, setDetailsMsgs] = useState<string[]>([]);
  const [intakeInput, setIntakeInput] = useState('');

  const scrollDown = () => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

  const fetchConversations = useCallback(async () => {
    try {
      const { data } = await api.get('/support/conversations');
      setConversations(data);
      return data as Conversation[];
    } catch {
      return [];
    }
  }, []);

  const fetchMessages = useCallback(async (convId: string) => {
    try {
      const { data } = await api.get(`/support/conversations/${convId}/messages`);
      const next: Message[] = data.messages ?? data;
      setMessages((prev) => {
        if (next.length > prev.length) scrollDown();
        return next;
      });
    } catch {}
  }, []);

  // Al abrir: si ya hay una solicitud de asesor activa, va directo a ese chat.
  // Si no, reinicia el intake conversacional.
  useEffect(() => {
    if (!visible) return;
    setIntakeLog([{
      id: 'greet',
      sender: 'bot',
      text: `¡Hola${user?.name ? ', ' + user.name.split(' ')[0] : ''}! ¿En qué te ayudamos hoy? Elige una opción o cuéntanos con tus palabras.`,
    }]);
    setIntakePhase('need');
    setNeed(null);
    setDetailsMsgs([]);
    setIntakeInput('');
    (async () => {
      setLoading(true);
      const convs = await fetchConversations();
      const pending = convs.find((c) => c.type === 'advisor_request' && c.status === 'active');
      if (pending) {
        setActiveConv(pending);
        setView('chat');
        await fetchMessages(pending.id);
      } else {
        setActiveConv(null);
        setMessages([]);
        setView('form');
      }
      setLoading(false);
    })();
  }, [visible, fetchConversations, fetchMessages, user?.name, user?.phone]);

  // Polling: mensajes del chat activo, o lista de conversaciones
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!visible) return;
    if (view === 'chat' && activeConv) {
      pollRef.current = setInterval(() => fetchMessages(activeConv.id), 4000);
    } else if (view === 'list') {
      pollRef.current = setInterval(fetchConversations, 8000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [visible, activeConv, view, fetchMessages, fetchConversations]);

  const openConversation = async (conv: Conversation) => {
    setActiveConv(conv);
    setView('chat');
    setLoading(true);
    await fetchMessages(conv.id);
    setLoading(false);
  };

  const pickNeed = (opt: { id: string; label: string }) => {
    setIntakeLog((prev) => [...prev, { id: `u-${Date.now()}`, sender: 'user', text: opt.label }]);
    setNeed(opt.id);
    setIntakeLog((prev) => [
      ...prev,
      {
        id: `b-${Date.now()}`,
        sender: 'bot',
        text: opt.id === 'other'
          ? 'Cuéntanos qué necesitas'
          : '¿Quieres contarnos algo más antes de enviar tu solicitud? Escribe abajo, o toca "Enviar solicitud".',
      },
    ]);
    setIntakePhase('gather');
  };

  const sendIntakeMessage = () => {
    const text = intakeInput.trim();
    if (!text) return;
    setIntakeInput('');
    setIntakeLog((prev) => [...prev, { id: `u-${Date.now()}`, sender: 'user', text }]);
    if (intakePhase === 'need') {
      // Escribió directo, sin tocar un chip: eso mismo es lo que necesita.
      setNeed('other');
      setDetailsMsgs([text]);
      setIntakeLog((prev) => [
        ...prev,
        { id: `b-${Date.now()}`, sender: 'bot', text: 'Gracias, recibido. ¿Algo más antes de enviar? Escribe abajo, o toca "Enviar solicitud".' },
      ]);
      setIntakePhase('gather');
    } else {
      setDetailsMsgs((prev) => [...prev, text]);
    }
  };

  const submitIntake = async () => {
    if (!need) {
      notice('Falta un dato', 'Cuéntanos qué necesitas');
      return;
    }
    const details = detailsMsgs.join('\n').trim();
    if (need === 'other' && !details) {
      notice('Falta un dato', 'Cuéntanos con más detalle qué necesitas');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post('/support/advisor-requests', {
        need,
        details: details || undefined,
      });
      setActiveConv(data);
      setView('chat');
      setMessages([]);
      await fetchMessages(data.id);
    } catch (e: any) {
      notice('Error', e.response?.data?.message ?? 'No se pudo enviar la solicitud');
    }
    setSubmitting(false);
  };

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || !activeConv || sending) return;
    setInputText('');
    setSending(true);
    // Optimista: mostrar el mensaje al instante, el poll lo reconcilia con el real
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempId, sender: 'user', content: text, created_at: new Date().toISOString() },
    ]);
    scrollDown();
    try {
      await api.post(`/support/conversations/${activeConv.id}/messages`, { content: text });
      await fetchMessages(activeConv.id);
    } catch {
      // Revertir el optimista si falló el envío
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInputText(text);
    }
    setSending(false);
  };

  if (!isAuthenticated) {
    return (
      <Modal visible={visible} transparent={floatingWeb} animationType={floatingWeb ? 'fade' : 'slide'} onRequestClose={onClose}>
        <View style={floatingWeb ? styles.webOverlay : styles.fill} pointerEvents="box-none">
        <View style={[styles.container, floatingWeb && styles.webFloating]}>
          <View style={[styles.header, floatingWeb && styles.webHeader]}>
            <View style={styles.headerLeft}>
              <View style={styles.botAvatar}><Ionicons name="headset" size={18} color={Colors.white} /></View>
              <Text style={styles.headerTitle}>Asesor DIRECTO</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>
          <View style={styles.authPrompt}>
            <Ionicons name="headset-outline" size={64} color={Colors.gray[300]} />
            <Text style={styles.authTitle}>Inicia sesión</Text>
            <Text style={styles.authText}>Necesitas una cuenta para solicitar un asesor</Text>
          </View>
        </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent={floatingWeb} animationType={floatingWeb ? 'fade' : 'slide'} onRequestClose={onClose}>
      <View style={floatingWeb ? styles.webOverlay : styles.fill} pointerEvents="box-none">
      <KeyboardAvoidingView style={[styles.container, floatingWeb && styles.webFloating]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, floatingWeb && styles.webHeader]}>
          <View style={styles.headerLeft}>
            {view === 'chat' && (
              <TouchableOpacity onPress={() => { setView('list'); fetchConversations(); }} hitSlop={8} style={{ marginRight: 8 }}>
                <Ionicons name="arrow-back" size={22} color={Colors.white} />
              </TouchableOpacity>
            )}
            {view === 'list' && (
              <TouchableOpacity onPress={() => setView('form')} hitSlop={8} style={{ marginRight: 8 }}>
                <Ionicons name="arrow-back" size={22} color={Colors.white} />
              </TouchableOpacity>
            )}
            <View style={styles.botAvatar}><Ionicons name="headset" size={18} color={Colors.white} /></View>
            <View>
              <Text style={styles.headerTitle}>
                {view === 'form' ? 'Habla con un asesor' : view === 'list' ? 'Mis solicitudes' : 'Tu asesor'}
              </Text>
              {view === 'chat' && (
                <View style={styles.onlineRow}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.onlineText}>Te contactará por WhatsApp</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>

        {view === 'form' ? (
          <IntakeView
            log={intakeLog}
            phase={intakePhase}
            onPickNeed={pickNeed}
            inputText={intakeInput}
            setInputText={setIntakeInput}
            onSend={sendIntakeMessage}
            submitting={submitting}
            onSubmit={submitIntake}
            hasPhone={!!user?.phone}
            onShowHistory={conversations.length > 0 ? () => setView('list') : undefined}
          />
        ) : view === 'list' ? (
          <View style={{ flex: 1 }}>
            <TouchableOpacity style={styles.newConvBtn} onPress={() => setView('form')}>
              <Ionicons name="add-circle" size={22} color={Colors.white} />
              <Text style={styles.newConvText}>Nueva solicitud</Text>
            </TouchableOpacity>

            {conversations.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={48} color={Colors.gray[300]} />
                <Text style={styles.emptyTitle}>Sin solicitudes</Text>
                <Text style={styles.emptyText}>Aún no pediste ayuda a un asesor</Text>
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
                            {item.type === 'advisor_request' ? 'Asesoría' : item.type === 'info_request' ? 'Consulta' : item.type === 'report' ? 'Reporte' : 'Soporte'}
                          </Text>
                          <Text style={styles.convDate}>
                            {new Date(item.created_at).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })}
                          </Text>
                        </View>
                        <Text style={styles.convPreview} numberOfLines={1}>
                          {lastMsg ? (lastMsg.sender === 'admin' ? 'Asesor: ' : '') + lastMsg.content : 'Sin mensajes'}
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
            {activeConv?.type === 'advisor_request' && (
              <View style={styles.sentBanner}>
                <Ionicons name="checkmark-circle" size={18} color="#059669" />
                <Text style={styles.sentBannerText}>
                  {(activeConv.metadata?.contact_phone || user?.phone)
                    ? `¡Solicitud enviada! Un asesor te va a contactar por WhatsApp al ${activeConv.metadata?.contact_phone || user?.phone} muy pronto.`
                    : '¡Solicitud enviada! No tienes un WhatsApp guardado en tu perfil — un asesor te va a contactar por otro medio.'}
                </Text>
              </View>
            )}
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
              />
            )}

            {activeConv?.status !== 'resolved' ? (
              <View style={styles.inputBar}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Agrega algo más si quieres..."
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
                <Text style={styles.resolvedText}>Solicitud resuelta</Text>
              </View>
            )}
          </>
        )}
      </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function IntakeView({
  log, phase, onPickNeed, inputText, setInputText, onSend, submitting, onSubmit, hasPhone, onShowHistory,
}: {
  log: { id: string; sender: 'bot' | 'user'; text: string }[];
  phase: 'need' | 'gather';
  onPickNeed: (opt: { id: string; label: string }) => void;
  inputText: string;
  setInputText: (v: string) => void;
  onSend: () => void;
  submitting: boolean;
  onSubmit: () => void;
  hasPhone: boolean;
  onShowHistory?: () => void;
}) {
  const listRef = useRef<FlatList>(null);
  const scrollDown = () => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        ref={listRef}
        data={log}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={scrollDown}
        renderItem={({ item }) => {
          const isUser = item.sender === 'user';
          return (
            <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
              {!isUser && (
                <View style={styles.msgAvatar}>
                  <Ionicons name="chatbubbles" size={12} color={Colors.white} />
                </View>
              )}
              <View style={[styles.bubbleContent, isUser && styles.userBubbleContent]}>
                <Text style={[styles.msgText, isUser && styles.userMsgText]}>{item.text}</Text>
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          phase === 'need' ? (
            <View style={styles.quickReplies}>
              {NEED_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={styles.needChip}
                  onPress={() => onPickNeed(opt)}
                  activeOpacity={0.8}
                >
                  <Ionicons name={opt.icon} size={16} color={OWNER_PRIMARY} />
                  <Text style={styles.needChipText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
              {onShowHistory && (
                <TouchableOpacity style={styles.historyLink} onPress={onShowHistory}>
                  <Text style={styles.historyLinkText}>Ver mis solicitudes anteriores</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.quickReplies}>
              {!hasPhone && (
                <View style={styles.noPhoneNote}>
                  <Ionicons name="information-circle" size={14} color="#92400E" />
                  <Text style={styles.noPhoneNoteText}>
                    No tienes un WhatsApp guardado en tu perfil, te contactaremos por otro medio.
                  </Text>
                </View>
              )}
              <TouchableOpacity style={styles.submitBtn} onPress={onSubmit} disabled={submitting}>
                <Ionicons name="paper-plane" size={18} color={Colors.white} />
                <Text style={styles.submitBtnText}>{submitting ? 'Enviando...' : 'Enviar solicitud'}</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          placeholder="Escribe qué necesitas..."
          placeholderTextColor={Colors.gray[400]}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={onSend}
          returnKeyType="send"
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !inputText.trim() && styles.sendBtnOff]}
          onPress={onSend}
          disabled={!inputText.trim()}
        >
          <Ionicons name="send" size={18} color={Colors.white} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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

  // Intake conversacional (quick replies + input persistente)
  quickReplies: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, gap: 8 },
  needChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.gray[200],
    backgroundColor: Colors.white, alignSelf: 'flex-start',
  },
  needChipText: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.gray[700], flexShrink: 1 },
  noPhoneNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFFBEB', padding: Spacing.sm, borderRadius: Radius.md,
  },
  noPhoneNoteText: { flex: 1, fontSize: Fonts.sizes.xs, color: '#92400E' },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: OWNER_PRIMARY, paddingVertical: 14, borderRadius: Radius.lg, marginTop: 4,
  },
  submitBtnText: { color: Colors.white, fontWeight: '700', fontSize: Fonts.sizes.md },
  historyLink: { alignItems: 'center', marginTop: Spacing.md },
  historyLinkText: { color: OWNER_PRIMARY, fontWeight: '600', fontSize: Fonts.sizes.sm },

  sentBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#D1FAE5', padding: Spacing.md, margin: Spacing.md, borderRadius: Radius.md,
  },
  sentBannerText: { flex: 1, fontSize: Fonts.sizes.xs, color: '#065F46', fontWeight: '600', lineHeight: 16 },

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

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';
import { getImageUrl } from '../../constants/api';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
  SUPPORT_PHONE,
  FAQ_ANSWERS,
  parseUserMessage,
  describeFilters,
  type PropertyCard,
  type QuickReply,
  type SearchFilters,
} from './chatFlows';

const CHAT_STORAGE_KEY = '@directo_chat_messages';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  quickReplies?: QuickReply[];
  properties?: PropertyCard[];
}

interface ChatScreenProps {
  visible: boolean;
  onClose: () => void;
  propertyId?: string;
  propertyTitle?: string;
}

type WaitingFor = 'none' | 'budget' | 'visit_date' | 'visit_time' | 'visit_message' | 'report_type' | 'report_detail';

const opLabel = (op: string) => {
  if (op === 'sale') return 'Venta';
  if (op === 'rent') return 'Alquiler';
  return 'Anticrético';
};

const opColor = (op: string) => {
  if (op === 'sale') return '#F59E0B';
  if (op === 'rent') return '#EF4444';
  return '#22C55E';
};

const formatPrice = (p: number, c: string) =>
  c === 'USD' ? `$${p.toLocaleString()}` : `Bs. ${p.toLocaleString()}`;

export default function ChatScreen({ visible, onClose, propertyId, propertyTitle }: ChatScreenProps) {
  const { isAuthenticated, user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [waitingFor, setWaitingFor] = useState<WaitingFor>('none');
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({});
  const [visitData, setVisitData] = useState<Record<string, string>>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const msgId = useRef(0);

  const nid = () => String(++msgId.current);
  const scrollDown = () => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

  const saveMessages = useCallback((msgs: ChatMessage[]) => {
    AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(msgs.slice(-50))).catch(() => {});
  }, []);

  const addBot = useCallback((text: string, quickReplies?: QuickReply[], properties?: PropertyCard[]) => {
    setIsTyping(false);
    setMessages((prev) => {
      const next = [...prev, { id: nid(), sender: 'bot' as const, text, quickReplies, properties }];
      saveMessages(next);
      return next;
    });
    scrollDown();
  }, [saveMessages]);

  const addUser = useCallback((text: string) => {
    setMessages((prev) => {
      const next = [...prev, { id: nid(), sender: 'user' as const, text }];
      saveMessages(next);
      return next;
    });
    scrollDown();
  }, [saveMessages]);

  const showTyping = useCallback(() => {
    setIsTyping(true);
    scrollDown();
  }, []);

  // Get user location silently on mount
  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        }
      } catch {}
    })();
  }, [visible]);

  // ── Search properties ──
  const buildSearchParams = useCallback((filters: SearchFilters, useGeo: boolean) => {
    const params: Record<string, any> = { limit: 6 };
    if (filters.operation) params.operation = filters.operation;
    if (filters.bedrooms) params.bedrooms = filters.bedrooms;
    if (filters.propertyType) params.type = filters.propertyType;
    if (filters.minPrice) params.min_price = filters.minPrice;
    if (filters.maxPrice) params.max_price = filters.maxPrice;
    if (filters.currency) params.currency = filters.currency;
    if (filters.searchText) params.q = filters.searchText;

    if (useGeo && userLocation && isFinite(userLocation.lat) && isFinite(userLocation.lng)) {
      params.lat = userLocation.lat;
      params.lng = userLocation.lng;
      params.radius_km = 50;
    }
    return params;
  }, [userLocation]);

  const doSearch = useCallback(async (filters: SearchFilters) => {
    showTyping();
    const desc = describeFilters(filters);
    await delay(800);

    try {
      let items: any[];
      try {
        const { data } = await api.get('/properties', { params: buildSearchParams(filters, true) });
        items = data.data ?? data ?? [];
      } catch {
        // Retry without geo if it failed
        const { data } = await api.get('/properties', { params: buildSearchParams(filters, false) });
        items = data.data ?? data ?? [];
      }

      if (items.length === 0) {
        addBot(
          `No encontré ${desc} por ahora 😕\n\n¿Quieres que busque algo diferente?`,
          [
            { label: '🔄 Buscar otra cosa', value: '__search' },
            { label: '💬 Hablar con alguien', value: '__human' },
          ],
        );
        return;
      }

      const cards: PropertyCard[] = items.map((p: any) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        price: Number(p.price),
        currency: p.currency,
        operation: p.operation,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        area_m2: p.area_m2 ? Number(p.area_m2) : undefined,
        address: p.address,
        zone: p.zones?.name ?? '',
        image: p.property_images?.[0]?.url ?? null,
      }));

      const responses = [
        `Encontré ${cards.length} ${desc} cerca de ti 🏡`,
        `Mira, tengo ${cards.length} ${desc} que te pueden interesar 👀`,
        `Aquí tienes ${cards.length} opciones de ${desc} 🔍`,
      ];
      addBot(responses[Math.floor(Math.random() * responses.length)], undefined, cards);
      await delay(600);
      addBot('¿Te interesa alguna? Puedo agendar una visita o seguir buscando.', [
        { label: '📅 Agendar visita', value: '__visit' },
        { label: '🔄 Buscar otra cosa', value: '__search' },
        { label: '💬 WhatsApp', value: '__human' },
      ]);
    } catch {
      addBot('Hubo un error al buscar. ¿Quieres intentar de nuevo?', [
        { label: '🔄 Reintentar', value: '__retry' },
      ]);
    }
  }, [addBot, showTyping, buildSearchParams]);

  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (!visible) return;

    setSearchFilters({});
    setVisitData({});
    setWaitingFor('none');
    setIsTyping(false);

    if (hasRestoredRef.current) {
      scrollDown();
      return;
    }

    (async () => {
      try {
        const saved = await AsyncStorage.getItem(CHAT_STORAGE_KEY);
        if (saved) {
          const parsed: ChatMessage[] = JSON.parse(saved);
          if (parsed.length > 0) {
            msgId.current = parsed.length;
            setMessages(parsed);
            hasRestoredRef.current = true;
            scrollDown();
            return;
          }
        }
      } catch {}

      hasRestoredRef.current = true;
      setTimeout(() => {
        const name = user?.name?.split(' ')[0];
        const greet = name ? `¡Hola ${name}!` : '¡Hola!';

        if (propertyTitle) {
          addBot(`${greet} Veo que estás viendo "${propertyTitle}" 👀\n\n¿Qué necesitas? Puedo buscar propiedades similares, agendar una visita, o lo que necesites.`);
        } else {
          addBot(`${greet} Soy tu asistente de DIRECTO 🏠\n\nDime qué buscas. Por ejemplo:\n• "Quiero un departamento en venta"\n• "Busco casa de 3 dormitorios"\n• "Agendar visita"\n\nO simplemente cuéntame qué necesitas 💬`);
        }
      }, 400);
    })();
  }, [visible, propertyTitle, user?.name, addBot]);

  // ── Handle incoming text (the brain) ──
  const processMessage = useCallback(async (text: string) => {
    // If we're waiting for specific input, handle it directly
    if (waitingFor !== 'none') {
      await handleWaitingInput(text);
      return;
    }

    const { intent, filters } = parseUserMessage(text);

    switch (intent) {
      case 'search':
        setSearchFilters(filters);
        // If we have enough to search (at least something), search immediately
        if (filters.operation || filters.propertyType || filters.bedrooms || filters.maxPrice) {
          await doSearch(filters);
        } else {
          // They said something vague like "busco algo" — ask what type
          addBot('¡Claro! ¿Qué tipo de propiedad te interesa?', [
            { label: 'Casa', value: '__type_casa' },
            { label: 'Departamento', value: '__type_departamento' },
            { label: 'Terreno', value: '__type_terreno' },
            { label: 'Local comercial', value: '__type_local-comercial' },
            { label: 'Oficina', value: '__type_oficina' },
            { label: 'Lo que sea', value: '__type_any' },
          ]);
        }
        break;

      case 'visit':
        if (propertyId) {
          setVisitData({ propertyId });
          addBot('¡Genial! ¿Qué fecha te viene bien para la visita? 📅');
          setShowDatePicker(true);
          setWaitingFor('visit_date');
        } else {
          addBot('¿Para qué propiedad quieres agendar? Escribe el nombre o busca primero una que te interese.', [
            { label: '🔍 Buscar propiedad', value: '__search' },
          ]);
        }
        break;

      case 'report':
        if (propertyId) {
          addBot('¿Qué tipo de problema quieres reportar?', [
            { label: 'Propiedad falsa', value: '__rtype_propiedad_falsa' },
            { label: 'Fotos incorrectas', value: '__rtype_fotos_incorrectas' },
            { label: 'Precio incorrecto', value: '__rtype_precio_incorrecto' },
            { label: 'Estafa', value: '__rtype_estafa' },
            { label: 'Otro', value: '__rtype_otro' },
          ]);
        } else {
          addBot('Para reportar un problema, ve a la propiedad en cuestión y abre el chat desde ahí. Así puedo saber cuál propiedad quieres reportar.');
        }
        break;

      case 'faq_publish':
      case 'faq_plans':
      case 'faq_payment':
      case 'faq_security':
        addBot(FAQ_ANSWERS[intent], [
          { label: '¿Otra pregunta?', value: '__faq' },
          { label: '🏠 Buscar propiedad', value: '__search' },
        ]);
        break;

      case 'human':
        connectHuman();
        break;

      case 'greeting':
        const name = user?.name?.split(' ')[0];
        addBot(`${name ? `¡Hola ${name}!` : '¡Hola!'} ¿En qué te puedo ayudar? 😊`);
        break;

      case 'thanks':
        addBot('¡De nada! Si necesitas algo más, aquí estaré 😊👋', [
          { label: '👋 Cerrar', value: '__close' },
        ]);
        break;

      case 'unknown':
      default:
        // Try a search with the raw text
        if (text.length > 3) {
          addBot(`Déjame buscar "${text}" para ti...`);
          await doSearch({ ...filters, searchText: text });
        } else {
          addBot('No te entendí bien 🤔 Puedes decirme qué buscas, por ejemplo:\n\n• "Departamento en venta"\n• "Casas de 3 dormitorios"\n• "Agendar visita"', [
            { label: '🏠 Buscar propiedad', value: '__search' },
            { label: '📅 Agendar visita', value: '__visit' },
            { label: '💬 WhatsApp', value: '__human' },
          ]);
        }
        break;
    }
  }, [waitingFor, doSearch, addBot, propertyId, user?.name]);

  const handleWaitingInput = useCallback(async (text: string) => {
    switch (waitingFor) {
      case 'budget': {
        const num = parseFloat(text.replace(/[^\d.]/g, ''));
        const isBob = /bs|bob|bolivian/i.test(text);
        const filters = { ...searchFilters };
        if (!isNaN(num)) {
          filters.maxPrice = num;
          filters.currency = isBob ? 'BOB' : 'USD';
        }
        setSearchFilters(filters);
        setWaitingFor('none');
        await doSearch(filters);
        break;
      }
      case 'visit_date': {
        setVisitData((prev) => ({ ...prev, date: text }));
        setWaitingFor('visit_time');
        addBot('¿A qué hora? ⏰', [
          { label: '09:00', value: '__time_09:00' },
          { label: '10:00', value: '__time_10:00' },
          { label: '11:00', value: '__time_11:00' },
          { label: '14:00', value: '__time_14:00' },
          { label: '15:00', value: '__time_15:00' },
          { label: '16:00', value: '__time_16:00' },
          { label: '17:00', value: '__time_17:00' },
          { label: '18:00', value: '__time_18:00' },
        ]);
        break;
      }
      case 'visit_time': {
        setVisitData((prev) => ({ ...prev, time: text }));
        setWaitingFor('visit_message');
        addBot('¿Quieres dejarle un mensaje al propietario? Si no, solo escribe "no".', [
          { label: 'No, enviar así', value: '__no_msg' },
        ]);
        break;
      }
      case 'visit_message': {
        const msg = /^no$/i.test(text) ? undefined : text;
        await submitVisit(msg);
        break;
      }
      case 'report_type': {
        setVisitData((prev) => ({ ...prev, reportType: text }));
        setWaitingFor('report_detail');
        addBot('Cuéntame más sobre el problema. Mientras más detalle, mejor:');
        break;
      }
      case 'report_detail': {
        await submitReport(text);
        break;
      }
    }
  }, [waitingFor, searchFilters, doSearch, addBot]);

  const submitVisit = useCallback(async (message?: string) => {
    showTyping();
    try {
      const pid = visitData.propertyId ?? propertyId;
      if (!pid) throw new Error('Sin propiedad');
      await api.post('/support/visit-requests', {
        propertyId: pid,
        date: visitData.date,
        time: visitData.time,
        message,
      });
      setWaitingFor('none');
      addBot('✅ ¡Solicitud enviada!\n\nEl propietario recibirá una notificación con tus datos y podrá contactarte por WhatsApp. Te avisaremos cuando responda.', [
        { label: '🏠 Buscar más', value: '__search' },
        { label: '👋 Cerrar', value: '__close' },
      ]);
    } catch (e: any) {
      const msg = e.response?.data?.message;
      addBot(typeof msg === 'string' ? msg : 'No se pudo enviar la solicitud. Intenta de nuevo.');
      setWaitingFor('none');
    }
  }, [visitData, propertyId, addBot, showTyping]);

  const submitReport = useCallback(async (description: string) => {
    showTyping();
    try {
      const pid = propertyId;
      if (pid) {
        await api.post('/support/reports', {
          propertyId: pid,
          reportType: visitData.reportType ?? 'otro',
          description,
        });
      }
      setWaitingFor('none');
      addBot('✅ ¡Reporte enviado! Nuestro equipo lo revisará pronto. Gracias por ayudarnos a mantener una comunidad segura 🛡️', [
        { label: '👋 Cerrar', value: '__close' },
      ]);
    } catch {
      addBot('No se pudo enviar el reporte. Intenta de nuevo.');
      setWaitingFor('none');
    }
  }, [propertyId, visitData, addBot, showTyping]);

  const connectHuman = useCallback(() => {
    const summary = [
      'Hola, vengo desde la app DIRECTO.',
      propertyTitle ? `Propiedad: "${propertyTitle}".` : '',
      '¿Me pueden ayudar?',
    ].filter(Boolean).join(' ');

    addBot('Te conecto con nuestro equipo por WhatsApp 📱', [
      { label: '📱 Abrir WhatsApp', value: '__whatsapp' },
    ]);
    setVisitData((prev) => ({ ...prev, whatsappSummary: summary }));
  }, [addBot, propertyTitle]);

  // ── Quick reply handler ──
  const processQuickReply = useCallback(async (reply: QuickReply) => {
    addUser(reply.label);
    const v = reply.value;

    if (v === '__close') { onClose(); return; }
    if (v === '__search') { addBot('¿Qué estás buscando? Descríbemelo 😊'); return; }
    if (v === '__visit') {
      if (propertyId) {
        setVisitData({ propertyId });
        addBot('¡Genial! ¿Qué fecha te viene bien? 📅');
        setShowDatePicker(true);
        setWaitingFor('visit_date');
      } else {
        addBot('Primero busquemos una propiedad. ¿Qué te interesa?');
      }
      return;
    }
    if (v === '__human' || v === '__whatsapp_open') { connectHuman(); return; }
    if (v === '__whatsapp') {
      const summary = visitData.whatsappSummary ?? 'Hola, vengo desde DIRECTO. ¿Me pueden ayudar?';
      Linking.openURL(`https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent(summary)}`);
      return;
    }
    if (v === '__retry') {
      await doSearch(searchFilters);
      return;
    }
    if (v === '__faq') {
      addBot('¿Sobre qué tema tienes dudas?', [
        { label: 'Cómo publicar', value: '__faq_publish' },
        { label: 'Planes y precios', value: '__faq_plans' },
        { label: 'Cómo pagar', value: '__faq_payment' },
        { label: 'Seguridad', value: '__faq_security' },
      ]);
      return;
    }
    if (v.startsWith('__faq_')) {
      const key = v.replace('__', '');
      if (FAQ_ANSWERS[key]) {
        addBot(FAQ_ANSWERS[key], [
          { label: '¿Otra pregunta?', value: '__faq' },
          { label: '🏠 Buscar propiedad', value: '__search' },
        ]);
      }
      return;
    }
    if (v === '__no_msg') {
      await submitVisit(undefined);
      return;
    }
    if (v.startsWith('__type_')) {
      const type = v.replace('__type_', '');
      const filters = { ...searchFilters, propertyType: type === 'any' ? undefined : type };
      setSearchFilters(filters);
      if (!filters.operation) {
        addBot('¿Comprar, alquilar o anticrético?', [
          { label: 'Comprar', value: '__op_sale' },
          { label: 'Alquilar', value: '__op_rent' },
          { label: 'Anticrético', value: '__op_anticretico' },
          { label: 'Cualquiera', value: '__op_any' },
        ]);
      } else {
        await doSearch(filters);
      }
      return;
    }
    if (v.startsWith('__op_')) {
      const op = v.replace('__op_', '');
      const filters = { ...searchFilters, operation: op === 'any' ? undefined : op as any };
      setSearchFilters(filters);
      await doSearch(filters);
      return;
    }
    if (v.startsWith('__time_')) {
      const time = v.replace('__time_', '');
      setVisitData((prev) => ({ ...prev, time }));
      setWaitingFor('visit_message');
      addBot('¿Quieres dejarle un mensaje al propietario? Si no, solo escribe "no".', [
        { label: 'No, enviar así', value: '__no_msg' },
      ]);
      return;
    }
    if (v.startsWith('__rtype_')) {
      const rtype = v.replace('__rtype_', '');
      setVisitData((prev) => ({ ...prev, reportType: rtype }));
      setWaitingFor('report_detail');
      addBot('Cuéntame más sobre el problema:');
      return;
    }
  }, [addUser, addBot, onClose, propertyId, doSearch, searchFilters, connectHuman, submitVisit, visitData]);

  // ── Text input handler ──
  const handleTextInput = useCallback(async () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText('');
    addUser(text);
    await delay(300);
    await processMessage(text);
  }, [inputText, addUser, processMessage]);

  const handleDateSelect = useCallback((_event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (!selectedDate) return;
    const dateStr = selectedDate.toISOString().split('T')[0];
    const display = selectedDate.toLocaleDateString('es-BO', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    setVisitData((prev) => ({ ...prev, date: dateStr }));
    addUser(display);
    setWaitingFor('visit_time');
    setTimeout(() => {
      addBot('¿A qué hora? ⏰', [
        { label: '09:00', value: '__time_09:00' },
        { label: '10:00', value: '__time_10:00' },
        { label: '11:00', value: '__time_11:00' },
        { label: '14:00', value: '__time_14:00' },
        { label: '15:00', value: '__time_15:00' },
        { label: '16:00', value: '__time_16:00' },
        { label: '17:00', value: '__time_17:00' },
        { label: '18:00', value: '__time_18:00' },
      ]);
    }, 300);
  }, [addUser, addBot]);

  const handlePropertyTap = useCallback((prop: PropertyCard) => {
    onClose();
    const { router } = require('expo-router');
    router.push(`/property/${prop.slug}`);
  }, [onClose]);

  if (!isAuthenticated) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.botAvatar}>
                <Ionicons name="chatbubbles" size={18} color={Colors.white} />
              </View>
              <Text style={styles.headerTitle}>Asistente DIRECTO</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close-circle" size={28} color={Colors.gray[400]} />
            </TouchableOpacity>
          </View>
          <View style={styles.authPrompt}>
            <Ionicons name="chatbubbles-outline" size={64} color={Colors.gray[300]} />
            <Text style={styles.authTitle}>Inicia sesión</Text>
            <Text style={styles.authText}>Necesitas una cuenta para usar el asistente</Text>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.botAvatar}>
              <Ionicons name="chatbubbles" size={18} color={Colors.white} />
            </View>
            <View>
              <Text style={styles.headerTitle}>Asistente DIRECTO</Text>
              <View style={styles.onlineRow}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>En línea</Text>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {messages.length > 0 && (
              <TouchableOpacity onPress={() => {
                AsyncStorage.removeItem(CHAT_STORAGE_KEY).catch(() => {});
                hasRestoredRef.current = false;
                setMessages([]);
                msgId.current = 0;
                setTimeout(() => {
                  const name = user?.name?.split(' ')[0];
                  const greet = name ? `¡Hola ${name}!` : '¡Hola!';
                  addBot(`${greet} Soy tu asistente de DIRECTO 🏠\n\nDime qué buscas. Por ejemplo:\n• "Quiero un departamento en venta"\n• "Busco casa de 3 dormitorios"\n• "Agendar visita"\n\nO simplemente cuéntame qué necesitas 💬`);
                  hasRestoredRef.current = true;
                }, 200);
              }} hitSlop={8}>
                <Ionicons name="refresh" size={22} color={Colors.gray[400]} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close-circle" size={28} color={Colors.gray[400]} />
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={scrollDown}
          ListFooterComponent={
            isTyping ? (
              <View style={[styles.bubble, styles.botBubble, styles.typingBubble]}>
                <View style={styles.typingDots}>
                  <View style={[styles.dot, styles.dot1]} />
                  <View style={[styles.dot, styles.dot2]} />
                  <View style={[styles.dot, styles.dot3]} />
                </View>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View>
              <View style={[styles.bubble, item.sender === 'user' ? styles.userBubble : styles.botBubble]}>
                {item.sender === 'bot' && (
                  <View style={styles.botAvatarSmall}>
                    <Ionicons name="chatbubbles" size={12} color={Colors.white} />
                  </View>
                )}
                <View style={[styles.bubbleContent, item.sender === 'user' && styles.userBubbleContent]}>
                  <Text style={[styles.msgText, item.sender === 'user' && styles.userMsgText]}>
                    {item.text}
                  </Text>
                </View>
              </View>

              {item.properties && item.properties.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.cardsRow}
                >
                  {item.properties.map((p: PropertyCard) => (
                    <TouchableOpacity
                      key={p.id}
                      style={styles.propCard}
                      activeOpacity={0.85}
                      onPress={() => handlePropertyTap(p)}
                    >
                      {p.image ? (
                        <Image source={{ uri: getImageUrl(p.image)! }} style={styles.propImg} />
                      ) : (
                        <View style={[styles.propImg, styles.propImgPlaceholder]}>
                          <Ionicons name="image-outline" size={24} color={Colors.gray[300]} />
                        </View>
                      )}
                      <View style={styles.propInfo}>
                        <View style={[styles.opBadge, { backgroundColor: opColor(p.operation) }]}>
                          <Text style={styles.opBadgeText}>{opLabel(p.operation)}</Text>
                        </View>
                        <Text style={styles.propTitle} numberOfLines={2}>{p.title}</Text>
                        {p.zone ? <Text style={styles.propZone} numberOfLines={1}>📍 {p.zone}</Text> : null}
                        <View style={styles.propMeta}>
                          {p.bedrooms ? <Text style={styles.propMetaText}>🛏️ {p.bedrooms}</Text> : null}
                          {p.bathrooms ? <Text style={styles.propMetaText}>🚿 {p.bathrooms}</Text> : null}
                          {p.area_m2 ? <Text style={styles.propMetaText}>📐 {p.area_m2}m²</Text> : null}
                        </View>
                        <Text style={styles.propPrice}>{formatPrice(p.price, p.currency)}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {item.quickReplies && item.quickReplies.length > 0 && (
                <View style={styles.quickRepliesWrap}>
                  {item.quickReplies.map((qr: QuickReply, i: number) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.quickReply}
                      onPress={() => processQuickReply(qr)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.quickReplyText}>{qr.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        />

        {showDatePicker && (
          <DateTimePicker
            value={new Date()}
            mode="date"
            minimumDate={new Date()}
            onChange={handleDateSelect}
          />
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder="Escribe lo que necesitas..."
            placeholderTextColor={Colors.gray[400]}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleTextInput}
            returnKeyType="send"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnOff]}
            onPress={handleTextInput}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={18} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F2F5' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingTop: 54, paddingBottom: Spacing.md,
    backgroundColor: Colors.primary,
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

  messageList: { padding: Spacing.md, paddingBottom: 20 },

  bubble: { flexDirection: 'row', marginBottom: Spacing.sm, maxWidth: '88%' },
  botBubble: { alignSelf: 'flex-start' },
  userBubble: { alignSelf: 'flex-end' },
  botAvatarSmall: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center', marginRight: 6, marginTop: 2,
  },
  bubbleContent: {
    backgroundColor: Colors.white, padding: Spacing.md, borderRadius: 18,
    borderTopLeftRadius: 4, elevation: 1, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, flexShrink: 1,
  },
  userBubbleContent: {
    backgroundColor: Colors.primary, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    borderBottomRightRadius: 4, borderBottomLeftRadius: 18,
  },
  msgText: { fontSize: Fonts.sizes.md, color: Colors.gray[800], lineHeight: 22 },
  userMsgText: { color: Colors.white },

  typingBubble: { width: 72, padding: Spacing.md },
  typingDots: { flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.gray[400] },
  dot1: { opacity: 0.4 },
  dot2: { opacity: 0.6 },
  dot3: { opacity: 0.8 },

  quickRepliesWrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, paddingLeft: 34, marginBottom: Spacing.md,
  },
  quickReply: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.white,
  },
  quickReplyText: { fontSize: Fonts.sizes.sm, color: Colors.primary, fontWeight: '600' },

  cardsRow: { paddingLeft: 34, paddingRight: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.md },
  propCard: {
    width: 200, backgroundColor: Colors.white, borderRadius: Radius.lg, overflow: 'hidden',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 4,
  },
  propImg: { width: '100%', height: 120 },
  propImgPlaceholder: { backgroundColor: Colors.gray[100], justifyContent: 'center', alignItems: 'center' },
  propInfo: { padding: Spacing.sm },
  opBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginBottom: 4 },
  opBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.white },
  propTitle: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.gray[800] },
  propZone: { fontSize: Fonts.sizes.xs, color: Colors.gray[500], marginTop: 2 },
  propMeta: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  propMetaText: { fontSize: Fonts.sizes.xs, color: Colors.gray[500] },
  propPrice: { fontSize: Fonts.sizes.md, fontWeight: '800', color: Colors.gray[900], marginTop: 4 },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', padding: Spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 30 : Spacing.sm, backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.gray[100], gap: Spacing.sm,
  },
  textInput: {
    flex: 1, minHeight: 42, maxHeight: 100, paddingHorizontal: Spacing.lg, paddingVertical: 10,
    borderRadius: 24, backgroundColor: '#F0F2F5', fontSize: Fonts.sizes.md, color: Colors.gray[800],
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnOff: { backgroundColor: Colors.gray[300] },
  authPrompt: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxxl },
  authTitle: { fontSize: Fonts.sizes.lg, fontWeight: '600', color: Colors.gray[700], marginTop: Spacing.lg },
  authText: { fontSize: Fonts.sizes.md, color: Colors.gray[400], textAlign: 'center', marginTop: Spacing.sm },
});

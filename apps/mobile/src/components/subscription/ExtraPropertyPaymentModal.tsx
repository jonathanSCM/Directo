import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { getImageUrl } from '../../constants/api';
import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';
import api from '../../services/api';
import { guessImageMimeType } from '../../utils/mime';

interface Props {
  visible: boolean;
  propertyId: string | null;
  propertyTitle?: string;
  amount?: number;
  currency?: string;
  /** Si ya existe un cobro pendiente/en revisión para esta propiedad, se reanuda en vez de pedir confirmar uno nuevo. */
  resumePaymentId?: string | null;
  onClose: () => void;
  onPaid: () => void;
}

type Phase = 'confirm' | 'loading' | 'ready' | 'uploading' | 'in_review' | 'confirmed' | 'rejected' | 'error';

const fmtMoney = (n?: number, c?: string) =>
  n == null ? '' : `${c === 'USD' ? '$' : 'Bs.'} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/**
 * Cobro puntual por "propiedad extra": genera el QR (mismo flujo manual que
 * ya usan las suscripciones), deja subir el comprobante ahí mismo, y va
 * consultando el estado hasta que un admin lo confirma (la propiedad se
 * publica sola) o lo rechaza.
 */
const phaseForStatus = (status: string): Phase => {
  if (status === 'confirmed') return 'confirmed';
  if (status === 'rejected') return 'rejected';
  if (status === 'in_review') return 'in_review';
  return 'ready';
};

export default function ExtraPropertyPaymentModal({
  visible, propertyId, propertyTitle, amount, currency, resumePaymentId, onClose, onPaid,
}: Props) {
  const [phase, setPhase] = useState<Phase>('confirm');
  const [payment, setPayment] = useState<{ id: string; metadata: any } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const createCharge = useCallback(async () => {
    if (!propertyId) return;
    setPhase('loading');
    setErrorMsg('');
    try {
      const { data } = await api.post(`/payments/property/${propertyId}/extra-charge`);
      setPayment(data.payment);
      setPhase(phaseForStatus(data.payment.status));
    } catch (e: any) {
      const msg = e.response?.data?.message;
      setErrorMsg(typeof msg === 'string' ? msg : Array.isArray(msg) ? msg[0] : 'No se pudo generar el cobro');
      setPhase('error');
    }
  }, [propertyId]);

  const loadExisting = useCallback(async (id: string) => {
    setPhase('loading');
    setErrorMsg('');
    try {
      const { data } = await api.get(`/payments/${id}`);
      setPayment(data);
      setPhase(phaseForStatus(data.status));
    } catch {
      setErrorMsg('No se pudo cargar el estado del pago');
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      setPayment(null);
      setPhase('confirm');
      return;
    }
    // Ya hay un cobro para esta propiedad: reanudarlo en vez de ofrecer
    // "confirmar" uno nuevo (evita que parezca que se puede pagar de nuevo).
    if (resumePaymentId) loadExisting(resumePaymentId);
  }, [visible, resumePaymentId, loadExisting]);

  // Sondeo del estado del pago mientras el modal está abierto.
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!visible || !payment || phase === 'confirmed' || phase === 'rejected') return;
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/payments/${payment.id}`);
        if (data.status === 'confirmed') {
          setPhase('confirmed');
          onPaid();
        } else if (data.status === 'rejected') {
          setPhase('rejected');
        }
      } catch {}
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [visible, payment, phase, onPaid]);

  const pickAndUpload = async () => {
    if (!payment) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const img = result.assets[0];
    setPhase('uploading');
    try {
      const formData = new FormData();
      if (Platform.OS === 'web') {
        const resp = await fetch(img.uri);
        const blob = await resp.blob();
        const ext = img.fileName?.split('.').pop() ?? 'jpg';
        formData.append('proof', blob, img.fileName ?? `comprobante.${ext}`);
        await api.post(`/payments/${payment.id}/upload-proof`, formData, {
          headers: { 'Content-Type': undefined },
        });
      } else {
        const ext = (img.uri.split('.').pop() ?? 'jpg').toLowerCase();
        formData.append('proof', {
          uri: img.uri,
          type: guessImageMimeType(img.uri, img.mimeType),
          name: img.fileName ?? `comprobante.${ext}`,
        } as any);
        await api.post(`/payments/${payment.id}/upload-proof`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      setPhase('in_review');
    } catch (e: any) {
      const msg = e.response?.data?.message;
      setErrorMsg(typeof msg === 'string' ? msg : 'No se pudo subir el comprobante');
      setPhase('ready');
    }
  };

  const qrPayload: string | undefined = payment?.metadata?.qrPayload;
  const qrImageUrl: string | undefined = payment?.metadata?.qrImageUrl;
  const instructions: string | undefined = payment?.metadata?.instructions;
  const bankName: string | undefined = payment?.metadata?.bankName;
  const accountHolder: string | undefined = payment?.metadata?.accountHolder;
  const accountNumber: string | undefined = payment?.metadata?.accountNumber;
  const bankLine = [bankName, accountHolder, accountNumber].filter(Boolean).join(' · ');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Publicar propiedad extra</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={Colors.gray[500]} />
            </TouchableOpacity>
          </View>

          {!!propertyTitle && (
            <Text style={styles.propertyName} numberOfLines={1}>{propertyTitle}</Text>
          )}
          {amount != null && (
            <Text style={styles.amount}>{fmtMoney(amount, currency)}</Text>
          )}

          {phase === 'confirm' && (
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={40} color="#D97706" />
              <Text style={styles.statusTitle}>Esta propiedad es extra a tu plan</Text>
              <Text style={styles.statusText}>
                Ya usaste el cupo de propiedades incluido en tu plan. Publicar esta se te cobrará por separado.
                {amount != null ? ` ¿Confirmas el pago de ${fmtMoney(amount, currency)}?` : ' ¿Confirmas?'}
              </Text>
              <TouchableOpacity style={styles.uploadBtn} onPress={createCharge}>
                <Text style={styles.uploadBtnText}>Sí, confirmar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.retryBtn} onPress={onClose}>
                <Text style={styles.retryBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === 'loading' && (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          )}

          {phase === 'error' && (
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={40} color="#DC2626" />
              <Text style={styles.errorText}>{errorMsg}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={createCharge}>
                <Text style={styles.retryBtnText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          )}

          {(phase === 'ready' || phase === 'uploading') && (qrImageUrl || qrPayload) && (
            <>
              <Text style={styles.hint}>
                Escanea el QR con tu app bancaria o transfiere el monto indicado, y sube el comprobante.
              </Text>
              <View style={styles.qrWrap}>
                {qrImageUrl ? (
                  <Image
                    source={{ uri: getImageUrl(qrImageUrl) ?? undefined }}
                    style={styles.qrImage}
                    resizeMode="contain"
                  />
                ) : (
                  <QRCode value={qrPayload!} size={200} />
                )}
              </View>
              {!!bankLine && <Text style={styles.bankLine}>{bankLine}</Text>}
              {!!instructions && <Text style={styles.instructions}>{instructions}</Text>}
              {!!errorMsg && <Text style={styles.errorTextSmall}>{errorMsg}</Text>}
              <TouchableOpacity
                style={[styles.uploadBtn, phase === 'uploading' && styles.uploadBtnDisabled]}
                onPress={pickAndUpload}
                disabled={phase === 'uploading'}
              >
                {phase === 'uploading' ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Ionicons name="camera-outline" size={18} color={Colors.white} />
                )}
                <Text style={styles.uploadBtnText}>
                  {phase === 'uploading' ? 'Subiendo...' : 'Subir comprobante'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {phase === 'in_review' && (
            <View style={styles.center}>
              <Ionicons name="time-outline" size={40} color="#D97706" />
              <Text style={styles.statusTitle}>Comprobante recibido</Text>
              <Text style={styles.statusText}>
                Estamos revisando tu pago. En cuanto se confirme, tu propiedad se publica sola.
              </Text>
            </View>
          )}

          {phase === 'confirmed' && (
            <View style={styles.center}>
              <Ionicons name="checkmark-circle" size={40} color={Colors.success} />
              <Text style={styles.statusTitle}>¡Pago confirmado!</Text>
              <Text style={styles.statusText}>Tu propiedad ya está publicada.</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={onClose}>
                <Text style={styles.retryBtnText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === 'rejected' && (
            <View style={styles.center}>
              <Ionicons name="close-circle" size={40} color="#DC2626" />
              <Text style={styles.statusTitle}>Pago rechazado</Text>
              <Text style={styles.statusText}>Revisa el comprobante e intenta de nuevo.</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={createCharge}>
                <Text style={styles.retryBtnText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  sheet: { width: '100%', maxWidth: 380, backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  title: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.gray[900] },
  propertyName: { fontSize: Fonts.sizes.sm, color: Colors.gray[500], marginBottom: 2 },
  amount: { fontSize: Fonts.sizes.xxl, fontWeight: '800', color: Colors.primary, marginBottom: Spacing.md },
  hint: { fontSize: Fonts.sizes.sm, color: Colors.gray[600], textAlign: 'center', marginBottom: Spacing.lg, lineHeight: 20 },
  qrWrap: { alignItems: 'center', padding: Spacing.lg, backgroundColor: Colors.gray[50], borderRadius: Radius.lg, marginBottom: Spacing.md },
  qrImage: { width: 220, height: 220 },
  bankLine: { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.gray[700], textAlign: 'center', marginBottom: 4 },
  instructions: { fontSize: Fonts.sizes.xs, color: Colors.gray[500], textAlign: 'center', marginBottom: Spacing.lg },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: Radius.lg },
  uploadBtnDisabled: { opacity: 0.6 },
  uploadBtnText: { color: Colors.white, fontWeight: '700', fontSize: Fonts.sizes.md },
  center: { alignItems: 'center', paddingVertical: Spacing.xl, gap: 8 },
  statusTitle: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.gray[900] },
  statusText: { fontSize: Fonts.sizes.sm, color: Colors.gray[500], textAlign: 'center' },
  errorText: { fontSize: Fonts.sizes.sm, color: '#DC2626', textAlign: 'center' },
  errorTextSmall: { fontSize: Fonts.sizes.xs, color: '#DC2626', textAlign: 'center', marginBottom: Spacing.sm },
  retryBtn: { marginTop: Spacing.md, paddingVertical: 10, paddingHorizontal: Spacing.xl, borderRadius: Radius.lg, backgroundColor: Colors.gray[100] },
  retryBtnText: { color: Colors.gray[700], fontWeight: '700', fontSize: Fonts.sizes.sm },
});

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import api from '../services/api';
import { Colors, Fonts, Radius, Spacing } from '../constants/theme';

const REASONS = [
  { key: 'fake', label: 'Propiedad falsa' },
  { key: 'misleading', label: 'Información engañosa' },
  { key: 'already_sold', label: 'Ya fue vendida o alquilada' },
  { key: 'inappropriate', label: 'Contenido inapropiado' },
  { key: 'spam', label: 'Spam' },
  { key: 'other', label: 'Otro motivo' },
];

interface Props {
  visible: boolean;
  propertyId: string;
  onClose: () => void;
}

export default function ReportPropertyModal({ visible, propertyId, onClose }: Props) {
  const [reason, setReason] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setReason(null);
    setMessage('');
    setSent(false);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/properties/${propertyId}/report`, {
        reason,
        message: message.trim() || undefined,
      });
      setSent(true);
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'No se pudo enviar el reporte');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Reportar propiedad</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color={Colors.gray[600]} />
            </TouchableOpacity>
          </View>

          {sent ? (
            <View style={styles.sentBox}>
              <Ionicons name="checkmark-circle" size={48} color={Colors.primary} />
              <Text style={styles.sentTitle}>Reporte enviado</Text>
              <Text style={styles.sentText}>
                Gracias, nuestro equipo revisará esta publicación.
              </Text>
              <TouchableOpacity style={styles.applyBtn} onPress={handleClose}>
                <Text style={styles.applyBtnText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>¿Cuál es el problema?</Text>
              <View style={styles.reasonList}>
                {REASONS.map((r) => (
                  <TouchableOpacity
                    key={r.key}
                    style={[styles.reasonRow, reason === r.key && styles.reasonRowActive]}
                    onPress={() => setReason(r.key)}
                  >
                    <View style={[styles.radio, reason === r.key && styles.radioActive]}>
                      {reason === r.key && <View style={styles.radioDot} />}
                    </View>
                    <Text style={[styles.reasonText, reason === r.key && styles.reasonTextActive]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionTitle}>Detalles (opcional)</Text>
              <TextInput
                style={styles.messageInput}
                placeholder="Cuéntanos más sobre el problema..."
                placeholderTextColor={Colors.gray[400]}
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={3}
                maxLength={500}
              />

              {error && <Text style={styles.errorText}>{error}</Text>}

              <TouchableOpacity
                style={[styles.applyBtn, !reason && styles.applyBtnDisabled]}
                onPress={handleSubmit}
                disabled={!reason || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.applyBtnText}>Enviar reporte</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.xxl,
    paddingBottom: 36,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.gray[300],
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: { fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.gray[900] },
  sectionTitle: {
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
    color: Colors.gray[700],
    marginBottom: Spacing.md,
  },
  reasonList: { gap: Spacing.sm, marginBottom: Spacing.lg },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.gray[200],
  },
  reasonRowActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.gray[300],
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: { borderColor: Colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  reasonText: { fontSize: Fonts.sizes.sm, color: Colors.gray[700], fontWeight: '500' },
  reasonTextActive: { color: Colors.primary, fontWeight: '700' },
  messageInput: {
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    fontSize: Fonts.sizes.md,
    color: Colors.gray[900],
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: Spacing.lg,
  },
  errorText: { color: '#EF4444', fontSize: Fonts.sizes.sm, marginBottom: Spacing.md },
  applyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  applyBtnDisabled: { backgroundColor: Colors.gray[300] },
  applyBtnText: { color: Colors.white, fontWeight: '700', fontSize: Fonts.sizes.md },
  sentBox: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  sentTitle: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.gray[900] },
  sentText: { fontSize: Fonts.sizes.sm, color: Colors.gray[500], textAlign: 'center', marginBottom: Spacing.lg },
});

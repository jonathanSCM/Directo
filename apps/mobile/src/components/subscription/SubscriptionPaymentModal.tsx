import React from 'react';
import api from '../../services/api';
import QrPaymentModal from '../payments/QrPaymentModal';

interface Props {
  visible: boolean;
  subscriptionId: string | null;
  planName?: string;
  amount?: number;
  currency?: string;
  /** Si ya existe un cobro pendiente/en revisión para esta suscripción, se reanuda en vez de pedir confirmar uno nuevo. */
  resumePaymentId?: string | null;
  onClose: () => void;
  onPaid: () => void;
}

/**
 * Cobro por QR bancario para activar o renovar una suscripción — mismo
 * flujo manual (QR + comprobante + aprobación de admin) que ya usan las
 * propiedades extra.
 */
export default function SubscriptionPaymentModal({
  visible, subscriptionId, planName, amount, currency, resumePaymentId, onClose, onPaid,
}: Props) {
  return (
    <QrPaymentModal
      visible={visible}
      title="Pagar suscripción"
      subject={planName}
      amount={amount}
      currency={currency}
      resumePaymentId={resumePaymentId}
      confirmTitle="Confirma el pago de tu suscripción"
      confirmText="Para activarla, generamos un cobro por QR."
      reviewText="Estamos revisando tu pago. En cuanto se confirme, tu suscripción se activa sola."
      successText="Tu suscripción ya está activa."
      requestCharge={async () => {
        const { data } = await api.post('/payments/create', {
          subscription_id: subscriptionId,
          method: 'qr',
        });
        return data;
      }}
      onClose={onClose}
      onPaid={onPaid}
    />
  );
}

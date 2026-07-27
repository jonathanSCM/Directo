import React from 'react';
import api from '../../services/api';
import QrPaymentModal from '../payments/QrPaymentModal';

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

/**
 * Cobro puntual por "propiedad extra": genera el QR (mismo flujo manual que
 * usan las suscripciones), deja subir el comprobante ahí mismo, y va
 * consultando el estado hasta que un admin lo confirma (la propiedad se
 * publica sola) o lo rechaza.
 */
export default function ExtraPropertyPaymentModal({
  visible, propertyId, propertyTitle, amount, currency, resumePaymentId, onClose, onPaid,
}: Props) {
  return (
    <QrPaymentModal
      visible={visible}
      title="Publicar propiedad extra"
      subject={propertyTitle}
      amount={amount}
      currency={currency}
      resumePaymentId={resumePaymentId}
      confirmTitle="Esta propiedad es extra a tu plan"
      confirmText="Ya usaste el cupo de propiedades incluido en tu plan. Publicar esta se te cobrará por separado."
      reviewText="Estamos revisando tu pago. En cuanto se confirme, tu propiedad se publica sola."
      successText="Tu propiedad ya está publicada."
      requestCharge={async () => {
        const { data } = await api.post(`/payments/property/${propertyId}/extra-charge`);
        return data;
      }}
      onClose={onClose}
      onPaid={onPaid}
    />
  );
}

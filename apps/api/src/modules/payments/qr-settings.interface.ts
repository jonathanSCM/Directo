/**
 * Configuración del QR bancario para pagos manuales, editable por el admin.
 * Se guarda en la tabla genérica `settings` bajo la key QR_SETTINGS_KEY.
 */
export interface QrSettings {
  qrImageUrl?: string;
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  instructions?: string;
}

export const QR_SETTINGS_KEY = 'payments.manual_qr';

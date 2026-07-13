export interface QuickReply {
  label: string;
  value: string;
}

export interface PropertyCard {
  id: string;
  title: string;
  slug: string;
  price: number;
  currency: string;
  operation: string;
  bedrooms?: number;
  bathrooms?: number;
  area_m2?: number;
  address?: string;
  zone?: string;
  image?: string;
}

export const SUPPORT_PHONE = '59178912345';

// ── Extracted search filters from free text ──

export interface ParsedIntent {
  intent: 'search' | 'visit' | 'report' | 'faq' | 'faq_publish' | 'faq_plans' | 'faq_payment' | 'faq_security' | 'human' | 'greeting' | 'thanks' | 'unknown';
  filters: SearchFilters;
}

export interface SearchFilters {
  operation?: 'sale' | 'rent' | 'anticretico';
  propertyType?: string;
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  bedrooms?: number;
  searchText?: string;
}

const OP_KEYWORDS: Record<string, 'sale' | 'rent' | 'anticretico'> = {
  comprar: 'sale', compra: 'sale', venta: 'sale', 'en venta': 'sale', vendiendo: 'sale',
  alquilar: 'sale', alquiler: 'rent', alquilo: 'rent', rentar: 'rent', renta: 'rent', arrendar: 'rent', arriendo: 'rent',
  'anticrético': 'anticretico', anticretico: 'anticretico', anticresis: 'anticretico',
};

const TYPE_KEYWORDS: Record<string, string> = {
  casa: 'casa', casas: 'casa', casita: 'casa',
  departamento: 'departamento', depa: 'departamento', depas: 'departamento', departamentos: 'departamento', dpto: 'departamento',
  terreno: 'terreno', terrenos: 'terreno', lote: 'terreno', lotes: 'terreno',
  oficina: 'oficina', oficinas: 'oficina',
  local: 'local-comercial', 'local comercial': 'local-comercial', locales: 'local-comercial', tienda: 'local-comercial',
  galpon: 'galpon-deposito', deposito: 'galpon-deposito', 'galpón': 'galpon-deposito',
  garaje: 'garaje', cochera: 'garaje', estacionamiento: 'garaje',
  propiedad: '', propiedades: '', inmueble: '', inmuebles: '',
};

const VISIT_WORDS = /\b(visita|agendar|agenda|cita|ver la|conocer|recorrer|ir a ver)\b/i;
const REPORT_WORDS = /\b(reportar|reporte|denunciar|denuncia|problema|falsa|estafa|fraude)\b/i;
const HUMAN_WORDS = /\b(persona|humano|agente|hablar con|soporte|ayuda|whatsapp)\b/i;
const GREETING_WORDS = /^(hola|buenas|hey|qué tal|buenos dias|buenas tardes|buenas noches|saludos)\b/i;
const THANKS_WORDS = /^(gracias|muchas gracias|chau|adiós|bye|adios|nos vemos|hasta luego)\b/i;
const FAQ_WORDS = /\b(publicar|como publico|cómo publico|subir propiedad)\b/i;
const PLANS_WORDS = /\b(precio|precios|plan|planes|costo|costos|cuánto cuesta|cuanto cuesta|tarifas|suscripción|suscripcion)\b/i;
const PAYMENT_WORDS = /\b(pagar|pago|pagos|qr|transferencia|como pago|cómo pago)\b/i;
const SECURITY_WORDS = /\b(seguridad|seguro|confiable|verificad)\b/i;

export function parseUserMessage(text: string): ParsedIntent {
  const lower = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const original = text.toLowerCase();
  const filters: SearchFilters = {};

  // Detect operation
  for (const [kw, op] of Object.entries(OP_KEYWORDS)) {
    if (original.includes(kw)) {
      filters.operation = op;
      break;
    }
  }
  // fix: "alquilar" was mapped to 'sale' by mistake — re-check
  if (/alquil|rent|arriend/i.test(original)) filters.operation = 'rent';

  // Detect property type
  for (const [kw, type] of Object.entries(TYPE_KEYWORDS)) {
    if (lower.includes(kw)) {
      if (type) filters.propertyType = type;
      break;
    }
  }

  // Detect bedrooms
  const brMatch = lower.match(/(\d+)\s*(dormitorio|habitacion|cuarto|recamara|pieza)/);
  if (brMatch) filters.bedrooms = parseInt(brMatch[1], 10);

  // Detect budget
  const priceMatch = original.match(/(\d[\d.,]*)\s*(dolares|usd|\$|bolivianos|bs|bob)/i);
  if (priceMatch) {
    const val = parseFloat(priceMatch[1].replace(/[.,]/g, ''));
    const isBob = /bs|bob|bolivian/i.test(priceMatch[2]);
    filters.maxPrice = val;
    filters.currency = isBob ? 'BOB' : 'USD';
  }
  const rangeMatch = original.match(/(\d[\d.,]*)\s*(?:a|y|-)\s*(\d[\d.,]*)\s*(dolares|usd|\$|bolivianos|bs|bob)?/i);
  if (rangeMatch) {
    filters.minPrice = parseFloat(rangeMatch[1].replace(/[.,]/g, ''));
    filters.maxPrice = parseFloat(rangeMatch[2].replace(/[.,]/g, ''));
    if (rangeMatch[3]) {
      filters.currency = /bs|bob|bolivian/i.test(rangeMatch[3]) ? 'BOB' : 'USD';
    }
  }

  // Determine intent
  if (GREETING_WORDS.test(original)) return { intent: 'greeting', filters };
  if (THANKS_WORDS.test(original)) return { intent: 'thanks', filters };
  if (REPORT_WORDS.test(original)) return { intent: 'report', filters };
  if (VISIT_WORDS.test(original)) return { intent: 'visit', filters };
  if (PAYMENT_WORDS.test(original)) return { intent: 'faq_payment', filters };
  if (PLANS_WORDS.test(original)) return { intent: 'faq_plans', filters };
  if (FAQ_WORDS.test(original)) return { intent: 'faq_publish', filters };
  if (SECURITY_WORDS.test(original)) return { intent: 'faq_security', filters };
  if (HUMAN_WORDS.test(original)) return { intent: 'human', filters };

  // If we detected any search-related filter, it's a search intent
  if (filters.operation || filters.propertyType || filters.bedrooms || filters.maxPrice) {
    return { intent: 'search', filters };
  }

  // Broad search keywords
  if (/buscar|busco|quiero|necesito|tienen|hay|mostrar|ver|encuentra|consegu/i.test(original)) {
    return { intent: 'search', filters };
  }

  return { intent: 'unknown', filters };
}

const TYPE_DISPLAY: Record<string, string> = {
  casa: 'casas', departamento: 'departamentos', terreno: 'terrenos',
  oficina: 'oficinas', 'local-comercial': 'locales comerciales',
  'galpon-deposito': 'galpones', garaje: 'garajes',
};

export function describeFilters(f: SearchFilters): string {
  const parts: string[] = [];
  if (f.propertyType) parts.push(TYPE_DISPLAY[f.propertyType] ?? f.propertyType);
  if (f.operation) {
    const labels: Record<string, string> = { sale: 'en venta', rent: 'en alquiler', anticretico: 'en anticrético' };
    parts.push(labels[f.operation] ?? f.operation);
  }
  if (f.bedrooms) parts.push(`de ${f.bedrooms} dormitorio${f.bedrooms > 1 ? 's' : ''}`);
  if (f.maxPrice) {
    const cur = f.currency === 'BOB' ? 'Bs.' : '$';
    if (f.minPrice) {
      parts.push(`entre ${cur}${f.minPrice.toLocaleString()} y ${cur}${f.maxPrice.toLocaleString()}`);
    } else {
      parts.push(`hasta ${cur}${f.maxPrice.toLocaleString()}`);
    }
  }
  return parts.length > 0 ? parts.join(' ') : 'propiedades';
}

export const FAQ_ANSWERS: Record<string, string> = {
  faq_publish: '📝 Para publicar:\n\n1️⃣ Cambia tu rol a "Propietario" en tu perfil\n2️⃣ Ve a "Mis Propiedades"\n3️⃣ Toca + para crear una nueva\n4️⃣ Completa datos, fotos y ubicación\n5️⃣ Envíala para revisión\n\nAprobamos en menos de 24 horas ⚡',
  faq_plans: '💎 Nuestros planes:\n\n🔹 Básico — Bs. 29/mes\n   5 propiedades, 5 fotos c/u\n\n🔸 Profesional — Bs. 79/mes\n   20 propiedades, 15 fotos, destacadas\n\n🔶 Agencia — Bs. 199/mes\n   Ilimitadas, 30 fotos, prioridad\n\n🎁 Todos incluyen 30 días gratis de prueba',
  faq_payment: '💳 Aceptamos pago por QR bancario:\n\n1️⃣ Selecciona tu plan\n2️⃣ Escanea el código QR con tu app bancaria\n3️⃣ Sube el comprobante\n4️⃣ Verificamos y activamos tu plan\n\n⏱️ El proceso toma 1-12 horas hábiles',
  faq_security: '🔒 Tu seguridad es prioridad:\n\n✅ Revisamos todas las publicaciones\n✅ Puedes reportar publicaciones sospechosas\n✅ Tu información personal es privada\n✅ Las visitas se agendan por la app\n\nSi ves algo sospechoso, reportalo desde aquí.',
};

import { Plan } from '../context/SubscriptionContext';

/**
 * Arma una frase de "por qué mejorar tu plan" a partir de las características
 * REALES del plan pago sugerido (no de una lista fija) — si el catálogo de
 * planes cambia (se agregan/quitan beneficios), el copy de las promos se
 * actualiza solo, sin tocar código.
 */
export function describeUpgradeBenefits(plan: Plan | null): string {
  if (!plan) return 'Más beneficios para vender o alquilar más rápido';

  const perks: string[] = [];
  if (plan.included_properties > 1) {
    perks.push(`hasta ${plan.included_properties} propiedades`);
  }
  if (plan.allows_featured) perks.push('propiedad destacada');
  if (plan.includes_statistics) perks.push('estadísticas de visitas');

  if (perks.length === 0) {
    return `Publicá con el plan ${plan.name} y seguí vendiendo`;
  }
  return `Con el plan ${plan.name}: ${perks.join(', ')}`;
}

import { alertUnit, describeCondition, fmtEur, fmtPct, type AlertType } from '@bourse/core';

import type { Message } from '@bourse/providers';

export type { Message };

export { describeCondition, fmtEur, fmtPct };

export const fmtSigned = (n: number) => `${n > 0 ? '+' : ''}${fmtEur(n)}`;

export interface AlertMessageInput {
  type: AlertType;
  threshold: number;
  /** Nom du titre, ou « Portefeuille » */
  name: string;
  /** Symbole et cours : alertes de titre seulement */
  symbol?: string;
  price?: number;
  /** Valeur mesurée : prix ou montant, ou pourcentage selon le type */
  value: number;
  note?: string | null;
}

export function alertMessage(a: AlertMessageInput): Message {
  const measured = alertUnit(a.type) === 'eur' ? fmtEur(a.value) : fmtPct(a.value);
  const quote = a.symbol && a.price !== undefined ? `${a.symbol} cote ${fmtEur(a.price)}. ` : '';
  return {
    title: `🔔 ${a.name} : ${describeCondition(a.type, a.threshold)}`,
    body: `${quote}Valeur mesurée : ${measured}.${a.note ? ` Note : ${a.note}` : ''}`,
    level: 'info',
  };
}

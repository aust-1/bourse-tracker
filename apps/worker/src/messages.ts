import { describeCondition, fmtEur, fmtPct, type AlertType } from '@bourse/core';

import type { Message } from '@bourse/providers';

export type { Message };

export { describeCondition, fmtEur, fmtPct };

export const fmtSigned = (n: number) => `${n > 0 ? '+' : ''}${fmtEur(n)}`;

export interface AlertMessageInput {
  type: AlertType;
  threshold: number;
  name: string;
  symbol: string;
  price: number;
  /** Valeur mesurée : prix, ou pourcentage selon le type */
  value: number;
}

export function alertMessage(a: AlertMessageInput): Message {
  const measured = a.type.startsWith('price') ? fmtEur(a.value) : fmtPct(a.value);
  return {
    title: `🔔 ${a.name} : ${describeCondition(a.type, a.threshold)}`,
    body: `${a.symbol} cote ${fmtEur(a.price)}. Valeur mesurée : ${measured}.`,
    level: 'info',
  };
}

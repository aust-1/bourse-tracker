import { fmtEur } from './describe';
import { capStatus, PEA_CAP, PEA_PME_COMBINED_CAP, type CashKind } from './cash';
import { estimatePeaTax } from './tax';

export type EnvelopeKind = 'pea' | 'pea_pme' | 'cto';

export interface MovementCheck {
  kind: CashKind;
  amount: number;
  /** Date du mouvement YYYY-MM-DD */
  occurredOn: string;
  /** Enveloppe qui reçoit le mouvement */
  portfolio: { kind: EnvelopeKind; openedOn: string | null };
  /** Versements déjà enregistrés sur les PEA et PEA-PME du compte */
  deposits: { pea: number; pea_pme: number };
}

export interface MovementWarning {
  code: 'pea_cap' | 'combined_cap' | 'early_withdrawal' | 'unknown_opening';
  message: string;
}

const frDate = (d: string) => d.split('-').reverse().join('/');

/**
 * Règles du PEA rappelées à la saisie d'un mouvement : versement au-delà d'un plafond (150 000 €
 * pour le PEA, 225 000 € pour PEA + PEA-PME), retrait avant 5 ans (le plan est clos) ou sur un
 * plan dont la date d'ouverture est inconnue. Rien pour un compte-titres ni pour les dividendes
 * et frais. Un avertissement n'interdit rien : le mouvement peut être une régularisation.
 */
export function peaMovementWarnings(m: MovementCheck): MovementWarning[] {
  const { kind: envelope, openedOn } = m.portfolio;
  if (envelope === 'cto') return [];
  const warnings: MovementWarning[] = [];

  if (m.kind === 'deposit') {
    const before = capStatus(m.deposits);
    const after = capStatus({
      pea: m.deposits.pea + (envelope === 'pea' ? m.amount : 0),
      pea_pme: m.deposits.pea_pme + (envelope === 'pea_pme' ? m.amount : 0),
    });
    const over = (cap: number, used: number) => used - cap;
    if (envelope === 'pea' && after.pea.used > PEA_CAP) {
      warnings.push({
        code: 'pea_cap',
        message: `Ce versement dépasse le plafond du PEA (${fmtEur(PEA_CAP)}) : il restait ${fmtEur(before.pea.remaining)}, dépassement de ${fmtEur(over(PEA_CAP, after.pea.used))}.`,
      });
    }
    if (after.combined.used > PEA_PME_COMBINED_CAP) {
      warnings.push({
        code: 'combined_cap',
        message: `Ce versement dépasse le plafond commun PEA + PEA-PME (${fmtEur(PEA_PME_COMBINED_CAP)}) : il restait ${fmtEur(before.combined.remaining)}, dépassement de ${fmtEur(over(PEA_PME_COMBINED_CAP, after.combined.used))}.`,
      });
    }
  }

  if (m.kind === 'withdrawal') {
    if (!openedOn) {
      warnings.push({
        code: 'unknown_opening',
        message:
          'Date d’ouverture du plan inconnue : un retrait avant 5 ans entraîne la clôture du plan. Renseigne-la dans Portefeuilles.',
      });
    } else {
      const { maturityOn, matured } = estimatePeaTax({
        openedOn,
        today: m.occurredOn,
        value: 0,
        deposits: 0,
        withdrawals: 0,
        socialRate: 0,
        incomeRate: 0,
      });
      if (!matured && maturityOn) {
        warnings.push({
          code: 'early_withdrawal',
          message: `Retrait avant les 5 ans du plan (le ${frDate(maturityOn)}) : il entraîne la clôture du plan.`,
        });
      }
    }
  }
  return warnings;
}

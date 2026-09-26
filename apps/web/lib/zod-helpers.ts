import { z } from 'zod';

/** Accepte la virgule décimale française ("12,5") et les espaces ("1 000"). */
export const num = (
  label: string,
  opts: { min?: number; positive?: boolean; optional?: boolean } = {},
) =>
  z
    .string()
    .transform((s) => s.replace(/\s/g, '').replace(',', '.'))
    .transform((s, ctx) => {
      if (s === '' && opts.optional) return 0;
      const n = Number(s);
      if (s === '' || !Number.isFinite(n)) {
        ctx.addIssue({ code: 'custom', message: `${label} : nombre invalide` });
        return z.NEVER;
      }
      if (opts.positive && n <= 0) {
        ctx.addIssue({ code: 'custom', message: `${label} doit être supérieur à 0` });
        return z.NEVER;
      }
      if (opts.min !== undefined && n < opts.min) {
        ctx.addIssue({ code: 'custom', message: `${label} doit être ≥ ${opts.min}` });
        return z.NEVER;
      }
      return n;
    });

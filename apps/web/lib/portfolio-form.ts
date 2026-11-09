import { z } from 'zod';

export const portfolioSchema = z.object({
  name: z.string().trim().min(1, 'Nom requis').max(60, 'Nom trop long (60 caractères maximum)'),
  kind: z.enum(['pea', 'pea_pme', 'cto'], { error: 'Type invalide' }),
  openedOn: z
    .string()
    .trim()
    .refine((s) => s === '' || /^\d{4}-\d{2}-\d{2}$/.test(s), 'Date d’ouverture invalide')
    .refine(
      (s) => s === '' || s <= new Date().toISOString().slice(0, 10),
      'La date d’ouverture ne peut pas être dans le futur',
    )
    .transform((s) => (s === '' ? null : s)),
});

export type PortfolioInput = z.infer<typeof portfolioSchema>;

export function parsePortfolioForm(formData: FormData): { data?: PortfolioInput; error?: string } {
  const parsed = portfolioSchema.safeParse({
    name: String(formData.get('name') ?? ''),
    kind: String(formData.get('kind') ?? ''),
    openedOn: String(formData.get('openedOn') ?? ''),
  });
  if (parsed.success) return { data: parsed.data };
  return { error: parsed.error.issues[0]?.message ?? 'Saisie invalide' };
}

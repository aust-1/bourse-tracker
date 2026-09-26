const eurFmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const numFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 6 });
const pctFmt = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});
const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  dateStyle: 'short',
  timeStyle: 'short',
});

export const eur = (n: number) => eurFmt.format(n);
export const num = (n: number) => numFmt.format(n);
export const pct = (n: number) => `${pctFmt.format(n)} %`;
export const dateTime = (d: string | Date) => dateFmt.format(new Date(d));

/** Classe Tailwind selon le signe (vert / rouge / neutre). */
export const signClass = (n: number | null) =>
  n === null || n === 0
    ? 'text-slate-500'
    : n > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-red-600 dark:text-red-400';

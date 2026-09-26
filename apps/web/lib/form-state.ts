/**
 * React 19 réinitialise les champs non contrôlés à la fin d'une action de formulaire, même en
 * cas d'erreur : sans précaution, l'utilisateur perd sa saisie. Les actions renvoient donc
 * les valeurs soumises, que le formulaire réutilise comme valeurs par défaut.
 */
export type FormValues = Record<string, string>;

export function snapshot(formData: FormData): FormValues {
  const out: FormValues = {};
  for (const key of new Set(formData.keys())) {
    out[key] = formData.getAll(key).map(String).join(',');
  }
  return out;
}

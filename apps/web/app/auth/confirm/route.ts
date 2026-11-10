import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { safeNext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * Retour d'un lien reçu par email (réinitialisation du mot de passe…). Deux formes :
 * - `?code=` (flux PKCE par défaut : même navigateur que la demande) ;
 * - `?token_hash=&type=` (modèle d'email personnalisé : fonctionne depuis n'importe quel appareil).
 * La session ouverte, on redirige vers `next` (chemin local uniquement).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNext(searchParams.get('next'));
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  const supabase = await createClient();
  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  // Location relatif : dans un gestionnaire de route, request.nextUrl porte l'adresse d'écoute du
  // conteneur (HOSTNAME=0.0.0.0, port 3000) et non le domaine public servi par Caddy. Le proxy
  // n'a pas ce défaut : Next y relativise lui-même les redirections vers le même hôte.
  const location = ok ? next : '/login?error=link';
  return new NextResponse(null, { status: 303, headers: { Location: location } });
}

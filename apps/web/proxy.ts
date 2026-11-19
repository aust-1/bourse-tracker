import type { NextRequest } from 'next/server';
import { buildCsp, cspHeaderName, newNonce } from '@/lib/csp';
import { updateSession } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  // CSP : un nonce par requête. Next.js le lit dans l'en-tête de la requête et l'applique à ses
  // scripts ; le layout racine le passe au script de statistiques (x-nonce).
  const nonce = newNonce();
  const header = cspHeaderName(process.env.CSP_ENFORCE);
  const csp = buildCsp({
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    dev: process.env.NODE_ENV === 'development',
  });
  request.headers.set('x-nonce', nonce);
  request.headers.set(header, csp);

  const response = await updateSession(request);
  response.headers.set(header, csp);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};

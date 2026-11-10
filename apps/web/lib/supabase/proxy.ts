import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { needsSecondFactor, routeAccess } from '@/lib/auth';

/** Rafraîchit la session Supabase et redirige les visiteurs non connectés vers /login. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet)
            response.cookies.set(name, value, options);
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const access = routeAccess(request.nextUrl.pathname);

  if (!data?.claims && access === 'private') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  if (data?.claims && access === 'guest') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }
  // second facteur enrôlé mais pas encore présenté : tout passe par /mfa (la base refuse
  // de toute façon les données à un jeton aal1, voir la migration mfa)
  if (data?.claims && access === 'private' && request.nextUrl.pathname !== '/mfa') {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (needsSecondFactor(aal)) {
      const url = request.nextUrl.clone();
      url.search = '';
      url.searchParams.set('next', request.nextUrl.pathname);
      url.pathname = '/mfa';
      return NextResponse.redirect(url);
    }
  }
  return response;
}

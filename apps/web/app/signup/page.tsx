import Link from 'next/link';
import { SignUpForm } from '@/components/signup-form';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const supabase = await createClient();
  const valid = code ? (await supabase.rpc('invitation_is_valid', { p_code: code })).data : false;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Bourse Tracker</h1>
      {code && valid ? (
        <>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Invitation valable : choisis ton email et ton mot de passe pour créer ton compte.
          </p>
          <SignUpForm code={code} />
        </>
      ) : (
        <p role="alert" className="text-sm text-red-600">
          Ce lien d’invitation est invalide, expiré ou déjà utilisé. Demande un nouveau lien à la
          personne qui t’a invité.
        </p>
      )}
      <Link href="/login" className="text-sm underline">
        J’ai déjà un compte
      </Link>
    </main>
  );
}

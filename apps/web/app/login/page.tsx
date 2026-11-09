import Link from 'next/link';
import { LoginForm } from '@/components/login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <h1>
        BOURSE TRACKER
        <span className="ml-2 inline-block h-9 w-4 translate-y-1 bg-phosphor" aria-hidden />
      </h1>
      {error === 'link' && (
        <p role="alert" className="text-sm text-red-600">
          Ce lien est invalide ou a expiré. Demande-en un nouveau.
        </p>
      )}
      <LoginForm />
      <Link href="/forgot" className="text-sm underline">
        Mot de passe oublié ?
      </Link>
    </main>
  );
}

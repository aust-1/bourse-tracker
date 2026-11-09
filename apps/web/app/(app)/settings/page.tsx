import Link from 'next/link';
import { AccountData } from '@/components/account-data';
import { MfaSettings } from '@/components/mfa-settings';
import { SettingsForm } from '@/components/settings-form';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('settings').select('*').maybeSingle();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Réglages</h1>
        <Link href="/settings/password" className="btn-secondary">
          Changer le mot de passe
        </Link>
      </div>
      <SettingsForm
        values={{
          discordWebhookUrl: data?.discord_webhook_url ?? '',
          email: data?.email ?? '',
          summaryEnabled: data?.summary_enabled ?? true,
          // la base renvoie HH:MM:SS ; le champ time attend HH:MM
          summaryTime: (data?.summary_time ?? '17:45').slice(0, 5),
        }}
      />
      <MfaSettings />
      <AccountData />
    </div>
  );
}

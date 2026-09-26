import { SettingsForm } from '@/components/settings-form';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('settings').select('*').maybeSingle();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Réglages</h1>
      <SettingsForm
        values={{
          discordWebhookUrl: data?.discord_webhook_url ?? '',
          email: data?.email ?? '',
          summaryEnabled: data?.summary_enabled ?? true,
          // la base renvoie HH:MM:SS ; le champ time attend HH:MM
          summaryTime: (data?.summary_time ?? '17:45').slice(0, 5),
        }}
      />
    </div>
  );
}

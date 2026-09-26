import { AlertForm } from '@/components/alert-form';
import { createClient } from '@/lib/supabase/server';

export default async function NewAlertPage({
  searchParams,
}: {
  searchParams: Promise<{ instrument?: string }>;
}) {
  const { instrument } = await searchParams;
  const supabase = await createClient();

  const [inst, settings] = await Promise.all([
    instrument
      ? supabase.from('instruments').select('yahoo_symbol, name').eq('id', instrument).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('settings').select('discord_webhook_url, email').maybeSingle(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Nouvelle alerte</h1>
      <AlertForm
        defaultSymbol={inst.data?.yahoo_symbol ?? ''}
        defaultLabel={inst.data ? `${inst.data.name} (${inst.data.yahoo_symbol})` : ''}
        configured={{
          discord: Boolean(settings.data?.discord_webhook_url),
          email: Boolean(settings.data?.email),
        }}
      />
    </div>
  );
}

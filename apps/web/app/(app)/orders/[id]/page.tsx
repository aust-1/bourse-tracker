import { toParisLocal } from '@bourse/core';
import { notFound } from 'next/navigation';
import { OrderForm } from '@/components/order-form';
import { createClient } from '@/lib/supabase/server';
import { deleteOrder } from '../actions';

export default async function EditOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: o } = await supabase
    .from('orders')
    .select(
      'id, side, quantity, unit_price, fees, executed_at, note, instruments(yahoo_symbol, name)',
    )
    .eq('id', id)
    .maybeSingle();
  if (!o) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Modifier l&apos;ordre</h1>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <OrderForm
        id={o.id}
        values={{
          symbol: o.instruments?.yahoo_symbol ?? '',
          label: `${o.instruments?.name ?? ''} (${o.instruments?.yahoo_symbol ?? ''})`,
          side: o.side,
          quantity: String(o.quantity),
          unitPrice: String(o.unit_price),
          fees: String(o.fees),
          executedAt: toParisLocal(o.executed_at),
          note: o.note ?? '',
        }}
      />
      <form action={deleteOrder.bind(null, o.id)}>
        <button className="btn-danger">Supprimer cet ordre</button>
      </form>
    </div>
  );
}

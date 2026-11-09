import { toParisLocal } from '@bourse/core';
import { OrderForm } from '@/components/order-form';
import { portfolioScope } from '@/lib/portfolios';
import { createClient } from '@/lib/supabase/server';

export default async function NewOrderPage() {
  const supabase = await createClient();
  const { portfolios, selected } = await portfolioScope(supabase);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Nouvel ordre</h1>
      <OrderForm
        id={null}
        portfolios={portfolios}
        values={{
          symbol: '',
          label: '',
          side: 'buy',
          quantity: '',
          unitPrice: '',
          fees: '',
          executedAt: toParisLocal(new Date()),
          note: '',
          portfolioId: selected?.id ?? portfolios[0]?.id ?? '',
        }}
      />
    </div>
  );
}

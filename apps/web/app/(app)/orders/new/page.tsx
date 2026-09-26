import { toParisLocal } from '@bourse/core';
import { OrderForm } from '@/components/order-form';

export default function NewOrderPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Nouvel ordre</h1>
      <OrderForm
        id={null}
        values={{
          symbol: '',
          label: '',
          side: 'buy',
          quantity: '',
          unitPrice: '',
          fees: '',
          executedAt: toParisLocal(new Date()),
          note: '',
        }}
      />
    </div>
  );
}

import { NextResponse } from 'next/server';
import { ordersToCsv } from '@/lib/orders';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('orders')
    .select('side, quantity, unit_price, fees, executed_at, note, instruments(yahoo_symbol, name)')
    .order('executed_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const csv = ordersToCsv(
    data.map((o) => ({
      executed_at: o.executed_at,
      symbol: o.instruments?.yahoo_symbol ?? '',
      name: o.instruments?.name ?? '',
      side: o.side,
      quantity: o.quantity,
      unit_price: o.unit_price,
      fees: o.fees,
      note: o.note,
    })),
  );
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="ordres.csv"',
    },
  });
}

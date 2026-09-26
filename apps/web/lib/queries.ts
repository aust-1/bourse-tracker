import { fetchAll, type Database } from '@bourse/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { InstrumentRow, OrderRow, QuoteRow } from '@bourse/core';

type Client = SupabaseClient<Database>;

export interface PortfolioData {
  orders: OrderRow[];
  instruments: InstrumentRow[];
  quotes: QuoteRow[];
}

export const toQuoteRow = (r: {
  instrument_id: string;
  price: number | string;
  prev_close: number | string | null;
  quoted_at: string;
  fetched_at: string;
}): QuoteRow => ({
  instrumentId: r.instrument_id,
  price: Number(r.price),
  prevClose: r.prev_close === null ? null : Number(r.prev_close),
  quotedAt: r.quoted_at,
  fetchedAt: r.fetched_at,
});

export async function loadQuotes(supabase: Client): Promise<QuoteRow[]> {
  const { data, error } = await supabase.from('quotes_latest').select('*');
  if (error) throw new Error(error.message);
  return data.map(toQuoteRow);
}

export async function loadPortfolioData(supabase: Client): Promise<PortfolioData> {
  const [orders, instruments, quotes] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from('orders')
        .select('id, instrument_id, side, quantity, unit_price, fees, executed_at')
        .order('executed_at')
        .order('id')
        .range(from, to),
    ),
    supabase.from('instruments').select('id, yahoo_symbol, name'),
    loadQuotes(supabase),
  ]);
  if (instruments.error) throw new Error(instruments.error.message);

  return {
    orders: orders.map((o) => ({
      id: o.id,
      instrumentId: o.instrument_id,
      side: o.side,
      quantity: o.quantity,
      unitPrice: o.unit_price,
      fees: o.fees,
      executedAt: o.executed_at,
    })),
    instruments: instruments.data.map((i) => ({ id: i.id, symbol: i.yahoo_symbol, name: i.name })),
    quotes,
  };
}

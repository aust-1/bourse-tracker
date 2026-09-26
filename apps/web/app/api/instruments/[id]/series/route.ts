import { NextResponse, type NextRequest } from 'next/server';
import type { SeriesRange } from '@bourse/providers';
import { createClient } from '@/lib/supabase/server';
import { yahoo } from '@/lib/yahoo';

const RANGES: SeriesRange[] = ['1d', '1mo', '1y'];

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const range = request.nextUrl.searchParams.get('range') as SeriesRange | null;
  if (!range || !RANGES.includes(range)) {
    return NextResponse.json({ error: 'range invalide' }, { status: 400 });
  }

  // la lecture passe par la RLS : seul un utilisateur connecté obtient l'instrument
  const supabase = await createClient();
  const { data: inst } = await supabase
    .from('instruments')
    .select('yahoo_symbol')
    .eq('id', id)
    .maybeSingle();
  if (!inst) return NextResponse.json({ error: 'instrument introuvable' }, { status: 404 });

  try {
    const points = await yahoo.getSeries(inst.yahoo_symbol, range);
    return NextResponse.json({ points: points.map((p) => ({ t: p.t.getTime(), v: p.close })) });
  } catch {
    return NextResponse.json({ error: 'source de prix indisponible' }, { status: 502 });
  }
}

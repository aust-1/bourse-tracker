import { NextResponse, type NextRequest } from 'next/server';
import { yahoo } from '@/lib/yahoo';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') ?? '';
  try {
    return NextResponse.json({ hits: await yahoo.search(q) });
  } catch {
    return NextResponse.json({ hits: [], error: 'Recherche indisponible' }, { status: 502 });
  }
}

import type { Metadata } from 'next';
import { PassThrough } from '@/lib/page-title';
import { createClient } from '@/lib/supabase/server';

/** Onglet au nom du titre (lecture filtrée par la RLS : seulement les titres suivis). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('instruments').select('name').eq('id', id).maybeSingle();
  return { title: data?.name ?? 'Titre' };
}

export default PassThrough;

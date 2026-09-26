import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Retrouve ou crée un compte de test. La base n'accepte sans invitation que le tout premier
 * compte ; les suivants sont créés avec une invitation émise au nom d'un compte existant.
 */
export async function ensureUser(
  admin: SupabaseClient,
  email: string,
  password: string,
): Promise<string> {
  const list = await admin.auth.admin.listUsers();
  if (list.error) throw list.error;
  const existing = list.data.users.find((u) => u.email === email);
  if (existing) return existing.id;

  let inviteCode: string | undefined;
  const inviter = list.data.users[0];
  if (inviter) {
    const inv = await admin
      .from('invitations')
      .insert({ created_by: inviter.id, note: 'test' })
      .select('code')
      .single();
    if (inv.error) throw inv.error;
    inviteCode = inv.data.code;
  }
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: inviteCode ? { invite_code: inviteCode } : undefined,
  });
  if (created.error) throw created.error;
  return created.data.user.id;
}

'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import { PROTOTYPE_VIEWER_COOKIE } from '@/data/prototype-viewer-session';

/**
 * Switches the prototype viewer. Grants no Postgres/RLS authority; see
 * prototype-viewer-session.ts. Least privilege on any unrecognized input,
 * matching that file's own default: only an explicit 'founder' elevates.
 */
export async function switchPrototypeViewer(formData: FormData): Promise<void> {
  const requested = formData.get('role');
  const value = requested === 'founder' ? 'founder' : 'member';

  const store = await cookies();
  store.set(PROTOTYPE_VIEWER_COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });

  revalidatePath('/', 'layout');
}

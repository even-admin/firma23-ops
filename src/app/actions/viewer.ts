'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import { PROTOTYPE_VIEWER_COOKIE } from '@/data/prototype-viewer-session';

/** Switches the prototype viewer. Grants nothing; see prototype-viewers.ts. */
export async function switchPrototypeViewer(formData: FormData): Promise<void> {
  const requested = formData.get('role');
  const value = requested === 'member' ? 'member' : 'founder';

  const store = await cookies();
  store.set(PROTOTYPE_VIEWER_COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });

  revalidatePath('/', 'layout');
}

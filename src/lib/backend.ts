/**
 * Backend availability.
 *
 * The whole point of the repository-interface boundary is that a route never
 * has to know which implementation answered it. The one place that *does*
 * need to know — the active-repository selector under
 * src/data/repositories/active/** — asks here instead of reading
 * process.env directly, so the condition for "is the real backend live" is
 * defined exactly once.
 *
 * Never returns true from a browser bundle checking a secret: every variable
 * read here is NEXT_PUBLIC_ by necessity (the URL and publishable key are
 * not secrets), and nothing service-role-scoped is read on this path.
 */

export function isSupabaseConfigured(): boolean {
  return (
    typeof process.env.NEXT_PUBLIC_SUPABASE_URL === 'string' &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
    typeof process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY === 'string' &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.length > 0
  );
}

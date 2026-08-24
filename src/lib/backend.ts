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

/**
 * True only when it is safe to fall back to the synthetic/prototype viewer
 * in place of a real Supabase session (M2 Auth adversarial review, H1).
 *
 * This is deliberately a *different* question from isSupabaseConfigured():
 * a Vercel Preview or Production deployment that is simply missing its
 * Supabase env vars must fail closed — never silently grant the synthetic
 * founder viewer to an anonymous visitor. NODE_ENV and VERCEL are both
 * platform-set, server-only variables that a misconfigured deployment
 * cannot accidentally leave in the "yes, this is local dev" state, unlike a
 * custom opt-in flag someone could copy into a Preview's environment by
 * mistake. Every caller that would otherwise treat "Supabase not
 * configured" as "use the synthetic viewer" must check this first.
 */
export function isSyntheticModeAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1';
}

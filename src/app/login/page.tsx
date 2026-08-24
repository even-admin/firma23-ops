import { redirect } from 'next/navigation';

import { sendMagicLinkAction, signOutAction } from '@/app/login/actions';
import { EmptyState } from '@/components/state/EmptyState';
import { ErrorState } from '@/components/state/ErrorState';
import { copy } from '@/copy/es-MX';
import { getViewerSessionState } from '@/data/viewer-session';
import { isSupabaseConfigured, isSyntheticModeAllowed } from '@/lib/backend';

interface LoginSearchParams {
  readonly sent?: string;
  readonly state?: string;
}

/**
 * Login: magic link only, invite-only.
 *
 * Every honest state this product can be in after an auth attempt is
 * rendered here, from the *real* session state (getViewerSessionState),
 * never from the URL alone — a query param only ever flips a boolean
 * ("sent=1", never the address itself: emails do not belong in a query
 * string, which lands in server access logs, browser history, and Referer
 * headers), never whether a form or a sign-out control is shown.
 */
export default async function LoginPage({
  searchParams,
}: {
  readonly searchParams: Promise<LoginSearchParams>;
}) {
  const query = await searchParams;

  if (!isSupabaseConfigured() && isSyntheticModeAllowed()) {
    // Nothing to log into in genuine local synthetic mode — the prototype
    // viewer switcher already covers local, no-backend iteration (M2 Auth
    // brief, item 7). A misconfigured Preview/Production deployment is a
    // different case (isSyntheticModeAllowed() is false there) and must
    // fall through to the real state below instead of bouncing home — that
    // state is 'backend-unavailable', rendered further down, not a loop
    // back to a page that will immediately redirect here again (H1).
    redirect('/');
  }

  const state = await getViewerSessionState();
  if (state.kind === 'viewer') {
    redirect('/');
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div>
        <h1 className="text-ink-strong text-2xl font-medium tracking-tight">{copy.auth.title}</h1>
        <p className="text-faint mt-2 text-sm">{copy.auth.subtitle}</p>
      </div>

      {state.kind === 'not-invited' ? (
        <SignedInBlockedState title={copy.auth.notInvitedTitle} detail={copy.auth.notInvitedDetail} />
      ) : state.kind === 'invite-expired' ? (
        <SignedInBlockedState
          title={copy.auth.inviteExpiredTitle}
          detail={copy.auth.inviteExpiredDetail}
        />
      ) : state.kind === 'revoked' ? (
        // Honest state, not an automatic sign-out (M4, as scoped for this
        // pass) — the person stays signed in to Supabase, sees the truth,
        // and can end the session themselves with the same control as
        // not-invited/expired.
        <SignedInBlockedState title={copy.auth.revokedTitle} detail={copy.auth.revokedDetail} />
      ) : state.kind === 'backend-unavailable' ? (
        <ErrorState title={copy.auth.backendUnavailableTitle} detail={copy.auth.backendUnavailableDetail} />
      ) : (
        <>
          {state.kind === 'invalid-session' ? (
            <ErrorState title={copy.auth.invalidSessionTitle} detail={copy.auth.invalidSessionDetail} />
          ) : null}
          {query.sent !== undefined ? (
            <EmptyState title={copy.auth.sentTitle} detail={copy.auth.sentDetail} />
          ) : (
            <LoginForm />
          )}
        </>
      )}
    </main>
  );
}

function LoginForm() {
  return (
    <form action={sendMagicLinkAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="label-micro text-faint">{copy.auth.emailLabel}</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder={copy.auth.emailPlaceholder}
          className="border-line-strong bg-surface text-ink-strong ease-firma min-h-11 rounded-md border px-3 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
        />
      </label>
      <button
        type="submit"
        className="bg-ink-strong text-bg ease-firma min-h-11 rounded-md px-4 text-sm font-medium transition-colors duration-150 hover:opacity-90"
      >
        {copy.auth.submit}
      </button>
    </form>
  );
}

function SignedInBlockedState({ title, detail }: { readonly title: string; readonly detail: string }) {
  return (
    <div className="flex flex-col gap-4">
      <EmptyState title={title} detail={detail} />
      <form action={signOutAction}>
        <button
          type="submit"
          className="border-line-strong text-ink hover:bg-raised ease-firma min-h-11 rounded-md border px-4 text-sm transition-colors duration-150"
        >
          {copy.auth.signOut}
        </button>
      </form>
    </div>
  );
}

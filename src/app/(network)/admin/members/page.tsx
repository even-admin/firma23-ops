import { InviteMemberForm } from '@/components/admin/InviteMemberForm';
import { PermissionDenied } from '@/components/state/PermissionDenied';
import { copy } from '@/copy/es-MX';
import { activeInviteRepository } from '@/data/repositories/active/invites';
import { getViewer } from '@/data/viewer-session';
import { isFounder } from '@/lib/viewer';

export default async function AdminMembersPage() {
  const viewer = await getViewer();
  if (!isFounder(viewer)) {
    return (
      <div className="mx-auto w-full max-w-[960px] px-4 py-6 sm:px-8 lg:px-10">
        <h1 className="text-ink-strong mb-6 text-2xl font-medium">{copy.admin.members.pageTitle}</h1>
        <PermissionDenied detail={copy.viewer.warning} />
      </div>
    );
  }
  const invites = await activeInviteRepository.list(viewer);
  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
      <header>
        <h1 className="text-ink-strong text-3xl font-medium sm:text-4xl">{copy.admin.members.pageTitle}</h1>
        <p className="text-muted mt-1 text-sm">{copy.admin.members.pageSubtitle}</p>
      </header>
      <InviteMemberForm />
      <section className="flex flex-col gap-3" aria-labelledby="invite-roster-heading">
        <h2 id="invite-roster-heading" className="label-micro text-faint">{copy.admin.members.roster}</h2>
        {invites.length === 0 ? <p className="text-faint text-sm">{copy.admin.members.empty}</p> : <ul className="flex flex-col gap-2">{invites.map((invite) => <li key={invite.inviteId} className="border-line bg-surface flex flex-wrap items-center justify-between gap-2 rounded-lg border p-4"><span><span className="text-ink block text-sm">{invite.displayName}</span><span className="text-faint block text-xs">{invite.email}</span></span><span className="text-faint text-xs">{copy.admin.members.status[invite.membershipStatus]}</span></li>)}</ul>}
      </section>
    </div>
  );
}

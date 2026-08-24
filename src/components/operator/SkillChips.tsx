import { copy } from '@/copy/es-MX';
import { cn } from '@/lib/cn';
import type { SkillView } from '@/types/views';

interface SkillChipsProps {
  readonly skills: readonly SkillView[];
  readonly limit?: number;
}

/** Verified skills read stronger than self-reported ones. That distinction is the point. */
export function SkillChips({ skills, limit }: SkillChipsProps) {
  const shown = limit === undefined ? skills : skills.slice(0, limit);
  const hidden = skills.length - shown.length;

  return (
    <ul className="flex flex-wrap gap-1.5">
      {shown.map((skill) => (
        <li
          key={skill.id}
          title={`${skill.family} · ${copy.network.level[skill.level]}`}
          className={cn(
            'label-micro rounded-sm border px-2 py-0.5',
            skill.verification === 'verified'
              ? 'border-line-strong text-ink'
              : 'border-line text-faint border-dashed',
          )}
        >
          {skill.name}
          <span className="text-faint"> · {copy.network.level[skill.level]}</span>
        </li>
      ))}
      {hidden > 0 ? <li className="label-micro text-faint px-1 py-0.5">+{hidden}</li> : null}
    </ul>
  );
}

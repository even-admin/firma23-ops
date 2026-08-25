import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DataAuthorityNotice } from '@/components/state/DataAuthorityNotice';
import { copy } from '@/copy/es-MX';

describe('DataAuthorityNotice', () => {
  it('labels local presentation as synthetic', () => {
    render(<DataAuthorityNotice configured={false} />);
    const notice = screen.getByRole('status');
    expect(notice).toHaveAttribute('data-data-authority', 'synthetic');
    expect(notice).toHaveTextContent(copy.app.syntheticAuthority);
  });

  it('warns a configured session that route reads remain non-canonical', () => {
    render(<DataAuthorityNotice configured />);
    const notice = screen.getByRole('status');
    expect(notice).toHaveAttribute('data-data-authority', 'configured-synthetic');
    expect(notice).toHaveTextContent(copy.app.configuredSyntheticAuthority);
  });
});

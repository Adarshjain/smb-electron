import { describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '@/test/test-utils';
import BackupFailedBanner from './BackupFailedBanner';

describe('BackupFailedBanner', () => {
  it('lists each failure and retries the backup', async () => {
    const sync = vi.fn().mockResolvedValue({ success: true });
    window.api = { supabase: { sync } } as unknown as Window['api'];

    render(
      <BackupFailedBanner
        errors={['bill_items: invalid input syntax for type integer: "2.2"']}
      />
    );

    expect(screen.getByText(/Backup failed/)).toBeInTheDocument();
    expect(
      screen.getByText(
        'bill_items: invalid input syntax for type integer: "2.2"'
      )
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(sync).toHaveBeenCalledOnce();
  });
});

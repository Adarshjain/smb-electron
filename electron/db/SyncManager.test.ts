// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const pending = vi.hoisted(
  () => ({}) as Record<string, Record<string, unknown>[]>
);

vi.mock('./localDB', () => ({
  fetchUnsynced: (table: string) => pending[table] ?? [],
  markAsSynced: vi.fn(),
  deleteSynced: vi.fn(),
  setRemoteSortOrderFloor: vi.fn(),
}));

import { SyncManager } from './SyncManager';
import { markAsSynced } from './localDB';

// Records every upsert; `failing` tables answer with a PostgREST-style error.
function fakeSupabase(failing: Record<string, string>) {
  const upserted: string[] = [];
  const client = {
    from: (table: string) => ({
      upsert: () => {
        upserted.push(table);
        return Promise.resolve({
          error: table in failing ? { message: failing[table] } : null,
        });
      },
      select: () => ({
        order: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
  return { client, upserted };
}

afterEach(() => {
  SyncManager.resetInstance();
  for (const key of Object.keys(pending)) delete pending[key];
  vi.clearAllMocks();
});

describe('SyncManager.pushAll', () => {
  it('backs up the other tables when one table fails, and reports the failure', async () => {
    pending.bill_items = [{ serial: 'F', loan_no: 2306, sort_order: 1 }];
    pending.releases = [{ serial: 'F', loan_no: 1 }];
    pending.daily_entries = [{ sort_order: 1 }];
    const { client, upserted } = fakeSupabase({
      bill_items: 'invalid input syntax for type integer: "2.2"',
    });
    const onBackupEnd = vi.fn();
    const manager = SyncManager.getInstance({
      supabase: client,
      tables: ['bill_items', 'releases', 'daily_entries'],
      onBackupEnd,
    });

    await expect(manager.pushAll()).rejects.toThrow(
      'bill_items: invalid input syntax for type integer: "2.2"'
    );

    expect(upserted).toEqual(['bill_items', 'releases', 'daily_entries']);
    expect(vi.mocked(markAsSynced).mock.calls.map(([t]) => t)).toEqual([
      'releases',
      'daily_entries',
    ]);
    expect(onBackupEnd).toHaveBeenCalledWith({
      status: false,
      error: ['bill_items: invalid input syntax for type integer: "2.2"'],
    });
    expect(manager.getSyncInfo().lastSyncTime).toBeNull();
    manager.stop();
  });

  it('reports success when every table backs up', async () => {
    pending.releases = [{ serial: 'F', loan_no: 1 }];
    const { client } = fakeSupabase({});
    const onBackupEnd = vi.fn();
    const manager = SyncManager.getInstance({
      supabase: client,
      tables: ['releases', 'daily_entries'],
      onBackupEnd,
    });

    await manager.pushAll();

    expect(onBackupEnd).toHaveBeenCalledWith({ status: true, summary: {} });
    expect(manager.getSyncInfo().lastSyncTime).not.toBeNull();
    manager.stop();
  });
});

describe('SyncManager.pushTable', () => {
  it('refuses to run while another backup is running', async () => {
    const { client } = fakeSupabase({});
    const manager = SyncManager.getInstance({
      supabase: client,
      tables: ['releases'],
    });
    const first = manager.pushTable('releases');
    await expect(manager.pushTable('releases')).rejects.toThrow(
      'A backup is running'
    );
    await first;
  });

  it('shows the start/end screen and keeps other tables failures on the banner', async () => {
    pending.bill_items = [{ serial: 'F', loan_no: 2306, sort_order: 1 }];
    const failing: Record<string, string> = { bill_items: 'bad quantity' };
    const { client } = fakeSupabase(failing);
    const onBackupStart = vi.fn();
    const onBackupEnd = vi.fn();
    const manager = SyncManager.getInstance({
      supabase: client,
      tables: ['bill_items', 'releases'],
      onBackupStart,
      onBackupEnd,
    });
    await expect(manager.pushAll()).rejects.toThrow();

    pending.releases = [{ serial: 'F', loan_no: 1 }];
    await manager.pushTable('releases');
    expect(onBackupStart).toHaveBeenCalledTimes(2);
    expect(onBackupEnd).toHaveBeenLastCalledWith({
      status: false,
      error: ['bill_items: bad quantity'],
    });

    delete failing.bill_items;
    await manager.pushTable('bill_items');
    expect(onBackupEnd).toHaveBeenLastCalledWith({
      status: true,
      summary: {},
    });
    manager.stop();
  });
});

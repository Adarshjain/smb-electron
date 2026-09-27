// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';

const dbHolder = vi.hoisted(() => ({
  current: null as Database.Database | null,
}));

vi.mock('./database', () => ({
  get db() {
    return dbHolder.current;
  },
}));

import { migrateSchema, renameArea } from './localDB';

const all = (sql: string) => dbHolder.current!.prepare(sql).all();

// areas as the shop database has it: name is a real primary key.
const SHOP_AREAS = `CREATE TABLE areas (name TEXT PRIMARY KEY UNIQUE, post TEXT,
  town TEXT, pincode TEXT, synced BOOLEAN NOT NULL DEFAULT 0, deleted BOOLEAN)`;

const setup = (shopSchema: boolean) => {
  dbHolder.current = new Database(':memory:');
  if (shopSchema) dbHolder.current.exec(SHOP_AREAS);
  migrateSchema();
  dbHolder.current.exec(`
    INSERT INTO areas (name, post, town, pincode, synced) VALUES
      ('C முட்லூர்', 'C முட்லூர்', 'Chidambaram', '608501', 1),
      ('Keerapalayam', 'Keerapalayam', 'C முட்லூர்', '608602', 1);
    INSERT INTO customers (id, fhtitle, fhname, name, area, synced) VALUES
      ('c1', 'S/O', 'x', 'y', 'C முட்லூர்', 1);
  `);
};

afterEach(() => {
  dbHolder.current?.close();
  dbHolder.current = null;
});

describe.each([false, true])('renameArea (shop schema: %s)', (shopSchema) => {
  it('re-creates the area under the new name and tombstones the old one', () => {
    setup(shopSchema);
    renameArea('C முட்லூர்', 'சி. முட்லூர்');
    expect(
      all(
        `SELECT name, post, pincode, synced, deleted FROM areas ORDER BY rowid`
      )
    ).toEqual([
      {
        name: 'C முட்லூர்',
        post: 'சி. முட்லூர்',
        pincode: '608501',
        synced: 0,
        deleted: 1,
      },
      {
        name: 'Keerapalayam',
        post: 'Keerapalayam',
        pincode: '608602',
        synced: 0,
        deleted: null,
      },
      {
        name: 'சி. முட்லூர்',
        post: 'சி. முட்லூர்',
        pincode: '608501',
        synced: 0,
        deleted: null,
      },
    ]);
    expect(all(`SELECT town FROM areas WHERE name = 'Keerapalayam'`)).toEqual([
      { town: 'சி. முட்லூர்' },
    ]);
    expect(all(`SELECT area, synced FROM customers`)).toEqual([
      { area: 'சி. முட்லூர்', synced: 0 },
    ]);
  });

  it('only tombstones the old area when the new name already exists', () => {
    setup(shopSchema);
    renameArea('C முட்லூர்', 'Keerapalayam');
    expect(all(`SELECT name, deleted FROM areas ORDER BY rowid`)).toEqual([
      { name: 'C முட்லூர்', deleted: 1 },
      { name: 'Keerapalayam', deleted: null },
    ]);
  });
});

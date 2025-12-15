import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

export let db: Database.Database | null = null;

export function initDatabase() {
  if (db) {
    return db;
  }
  try {
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    const dbPath = path.join(userDataPath, 'smb.db');
    console.log('Database path:', dbPath);

    db = new Database(dbPath);

    // Performance optimizations
    db.pragma('journal_mode = WAL');
    return db;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

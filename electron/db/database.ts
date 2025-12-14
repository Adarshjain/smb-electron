import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

export let db: Database.Database | null = null;

// Prepared statement cache for performance
const statementCache = new Map<string, Database.Statement>();
const MAX_CACHE_SIZE = 100;

export function getCachedStatement(sql: string): Database.Statement {
  if (!db) throw new Error('Database not initialized');

  let stmt = statementCache.get(sql);
  if (!stmt) {
    // Evict oldest entries if cache is full
    if (statementCache.size >= MAX_CACHE_SIZE) {
      const firstKey = statementCache.keys().next().value;
      if (firstKey) statementCache.delete(firstKey);
    }
    stmt = db.prepare(sql);
    statementCache.set(sql, stmt);
  }
  return stmt;
}

export function clearStatementCache() {
  statementCache.clear();
}

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
    db.pragma('synchronous = NORMAL'); // Faster writes, still safe with WAL
    db.pragma('cache_size = -64000'); // 64MB cache (negative = KB)
    db.pragma('temp_store = MEMORY'); // Store temp tables in memory
    db.pragma('mmap_size = 268435456'); // 256MB memory-mapped I/O
    db.pragma('page_size = 4096'); // Optimal page size

    console.log('Database initialized with performance optimizations');
    return db;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export function closeDatabase() {
  if (db) {
    // Optimize database before closing
    try {
      db.pragma('optimize');
    } catch {
      // Ignore optimize errors
    }
    clearStatementCache();
    db.close();
    db = null;
  }
}

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = path.join(process.cwd(), "data", "reviews.db");

let instance: Database.Database | null = null;

function migrate(database: Database.Database): void {
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");

  database.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      repo TEXT NOT NULL,
      number INTEGER NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'queued',
      summary TEXT NOT NULL DEFAULT '',
      error TEXT,
      diff TEXT NOT NULL DEFAULT '',
      snapshot TEXT NOT NULL DEFAULT '{}',
      skills TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS findings (
      id TEXT PRIMARY KEY,
      review_id TEXT NOT NULL,
      ord INTEGER NOT NULL DEFAULT 0,
      file TEXT NOT NULL DEFAULT '',
      start_line INTEGER,
      end_line INTEGER,
      side TEXT NOT NULL DEFAULT 'RIGHT',
      severity TEXT NOT NULL DEFAULT 'medium',
      category TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      background TEXT NOT NULL DEFAULT '',
      problem TEXT NOT NULL DEFAULT '',
      suggested_fix TEXT NOT NULL DEFAULT '',
      suggested_comment TEXT NOT NULL DEFAULT '',
      draft_comment TEXT,
      state TEXT NOT NULL DEFAULT 'open',
      comment_url TEXT,
      posted_at TEXT,
      posted_as TEXT NOT NULL DEFAULT 'comment',
      references_json TEXT NOT NULL DEFAULT '[]'
    );

    CREATE INDEX IF NOT EXISTS findings_by_review ON findings (review_id);

    CREATE TABLE IF NOT EXISTS pr_cache (
      repo TEXT PRIMARY KEY,
      prs TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );
  `);
}

export function getDb(): Database.Database {
  if (instance) return instance;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  instance = new Database(DB_PATH);
  migrate(instance);
  return instance;
}

-- ADF State Database Schema v1.0
-- Location: ~/.adf/projects/{project-id}/state.db
-- Purpose: Cross-session search index alongside the markdown memory files.
--          Markdown is source of truth; SQLite is the query layer.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── Sessions ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,   -- project UUID from .claude-project-id
  project_name TEXT,
  project_path TEXT,
  phase       TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- ── Decisions ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decisions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL,
  date        TEXT,               -- YYYY-MM-DD from decision-log.md
  milestone   TEXT,               -- e.g. "M01"
  decision    TEXT NOT NULL,
  rationale   TEXT,
  shared      INTEGER DEFAULT 0,  -- 1 if tagged [SHARED]
  created_at  TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS decisions_fts
  USING fts5(decision, rationale, content=decisions, content_rowid=id);

-- Keep FTS index in sync
CREATE TRIGGER IF NOT EXISTS decisions_ai AFTER INSERT ON decisions BEGIN
  INSERT INTO decisions_fts(rowid, decision, rationale)
  VALUES (new.id, new.decision, new.rationale);
END;

CREATE TRIGGER IF NOT EXISTS decisions_ad AFTER DELETE ON decisions BEGIN
  INSERT INTO decisions_fts(decisions_fts, rowid, decision, rationale)
  VALUES ('delete', old.id, old.decision, old.rationale);
END;

-- ── Gate verdicts ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gate_verdicts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL,
  gate_id     TEXT NOT NULL,      -- e.g. "SA-ARCH", "PHASE-GATE"
  verdict     TEXT NOT NULL,      -- APPROVE, CONCERNS, REJECT
  agent       TEXT,               -- agent name that issued verdict
  summary     TEXT,
  created_at  TEXT NOT NULL
);

-- ── Tasks ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  task_id     TEXT PRIMARY KEY,   -- e.g. "M01-T003"
  session_id  TEXT NOT NULL,
  milestone   TEXT,
  title       TEXT NOT NULL,
  status      TEXT,               -- TODO, DOING, DONE, BLOCKED
  created_at  TEXT NOT NULL,
  completed_at TEXT
);

CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts
  USING fts5(title, content=tasks, content_rowid=rowid);

CREATE TRIGGER IF NOT EXISTS tasks_ai AFTER INSERT ON tasks BEGIN
  INSERT INTO tasks_fts(rowid, title) VALUES (new.rowid, new.title);
END;

CREATE TRIGGER IF NOT EXISTS tasks_ad AFTER DELETE ON tasks BEGIN
  INSERT INTO tasks_fts(tasks_fts, rowid, title) VALUES ('delete', old.rowid, old.title);
END;

-- ── Skill invocations ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skill_invocations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL,
  skill_name  TEXT NOT NULL,
  skill_id    TEXT,               -- e.g. "SK-009"
  invoked_at  TEXT NOT NULL
);

-- ── General events ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL,
  event_type  TEXT NOT NULL,      -- e.g. "session_start", "chunk_completed"
  payload     TEXT,               -- JSON string
  created_at  TEXT NOT NULL
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_decisions_session  ON decisions(session_id);
CREATE INDEX IF NOT EXISTS idx_decisions_shared   ON decisions(shared);
CREATE INDEX IF NOT EXISTS idx_gate_verdicts_gate ON gate_verdicts(gate_id);
CREATE INDEX IF NOT EXISTS idx_gate_verdicts_verdict ON gate_verdicts(verdict);
CREATE INDEX IF NOT EXISTS idx_tasks_status       ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_skill_invocations_name ON skill_invocations(skill_name);
CREATE INDEX IF NOT EXISTS idx_events_type        ON events(event_type);

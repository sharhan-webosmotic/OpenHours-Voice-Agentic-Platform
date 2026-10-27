#!/usr/bin/env python3
"""ADF State Database: cross-session search index (v4.0).

State.db lives at ~/.adf/projects/{project-id}/state.db (outside the git repo).
Markdown files in AI_DOCS/ remain the source of truth; this is the query layer.

Usage:
    python db.py init                                           Create schema
    python db.py insert-decision --date D --text T [--milestone M] [--rationale R]
    python db.py insert-gate --gate G --verdict V [--agent A] [--summary S]
    python db.py insert-task --id I --title T [--milestone M] [--status S]
    python db.py insert-event --type T [--payload JSON]
    python db.py query "search terms"                          FTS5 search
    python db.py stats                                         Counts + top skills
    python db.py export-session                                Dump as JSON
"""

import argparse
import json
import os
import sqlite3
import sys
from datetime import datetime, timezone


# ── DB path resolution ────────────────────────────────────────────────────────

def get_db_path() -> str:
    """Resolve ~/.adf/projects/{project-id}/state.db from .claude-project-id."""
    project_id_file = ".claude-project-id"
    if not os.path.exists(project_id_file):
        # Fall back to a default path if no project ID yet
        adf_home = os.path.expanduser("~/.adf/projects/default")
        os.makedirs(adf_home, exist_ok=True)
        return os.path.join(adf_home, "state.db")

    with open(project_id_file) as f:
        project_id = f.read().strip()

    if not project_id:
        raise RuntimeError(".claude-project-id is empty")

    db_dir = os.path.expanduser(f"~/.adf/projects/{project_id}")
    os.makedirs(db_dir, exist_ok=True)
    return os.path.join(db_dir, "state.db")


def get_schema_path() -> str:
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "schema.sql")


def get_session_id() -> str:
    """Return project UUID from .claude-project-id, or 'unknown'."""
    try:
        with open(".claude-project-id") as f:
            return f.read().strip() or "unknown"
    except FileNotFoundError:
        return "unknown"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def ensure_schema(conn: sqlite3.Connection) -> None:
    """Apply schema.sql when the database has no schema yet (idempotent self-heal).

    sqlite3 creates an empty file on first connect. Without this check a hook
    writing to a database nobody ran `init` on, including the shared `default`
    fallback, failed with "no such table". `events` is the last table schema.sql
    creates, so its absence also catches a partially applied schema.
    """
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='events'"
    ).fetchone()
    if row is not None:
        return
    schema_path = get_schema_path()
    if not os.path.exists(schema_path):
        return
    with open(schema_path, encoding="utf-8") as f:
        conn.executescript(f.read())
    conn.commit()


def connect() -> sqlite3.Connection:
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    ensure_schema(conn)
    return conn


def use_utf8_stdio() -> None:
    """Emit UTF-8 on stdout and stderr whatever the platform default is.

    On Windows a piped stdout uses the ANSI code page (cp1252). A print of any
    character outside it raised UnicodeEncodeError AFTER the row was committed,
    so the command exited 1 on a successful write and a retry duplicated it.
    """
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass


# ── Commands ──────────────────────────────────────────────────────────────────

def cmd_init():
    db_path = get_db_path()
    schema_path = get_schema_path()

    if not os.path.exists(schema_path):
        print(f"Error: schema.sql not found at {schema_path}", file=sys.stderr)
        sys.exit(1)

    with open(schema_path) as f:
        schema = f.read()

    conn = sqlite3.connect(db_path)
    conn.executescript(schema)
    conn.commit()
    conn.close()

    # Ensure session row exists
    session_id = get_session_id()
    project_name = os.path.basename(os.getcwd())
    project_path = os.getcwd()
    ts = now_iso()

    conn = connect()
    conn.execute("""
        INSERT OR IGNORE INTO sessions(id, project_name, project_path, phase, created_at, updated_at)
        VALUES (?, ?, ?, 'initialized', ?, ?)
    """, (session_id, project_name, project_path, ts, ts))
    conn.commit()
    conn.close()

    print(f"State database initialized at: {db_path}")


def cmd_insert_decision(args):
    p = argparse.ArgumentParser(prog="db.py insert-decision", add_help=False)
    p.add_argument("--date", default="")
    p.add_argument("--text", required=True)
    p.add_argument("--milestone", default="")
    p.add_argument("--rationale", default="")
    p.add_argument("--shared", action="store_true")
    parsed = p.parse_args(args)

    session_id = get_session_id()
    ts = now_iso()

    conn = connect()
    conn.execute("""
        INSERT INTO decisions(session_id, date, milestone, decision, rationale, shared, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (session_id, parsed.date, parsed.milestone, parsed.text, parsed.rationale,
          1 if parsed.shared else 0, ts))
    conn.commit()
    conn.close()
    print(f"Decision recorded: {parsed.text[:60]}{'...' if len(parsed.text) > 60 else ''}")


def cmd_insert_gate(args):
    p = argparse.ArgumentParser(prog="db.py insert-gate", add_help=False)
    p.add_argument("--gate", required=True)
    p.add_argument("--verdict", required=True)
    p.add_argument("--agent", default="")
    p.add_argument("--summary", default="")
    parsed = p.parse_args(args)

    session_id = get_session_id()
    ts = now_iso()

    conn = connect()
    conn.execute("""
        INSERT INTO gate_verdicts(session_id, gate_id, verdict, agent, summary, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (session_id, parsed.gate, parsed.verdict, parsed.agent, parsed.summary, ts))
    conn.commit()
    conn.close()
    print(f"Gate verdict recorded: {parsed.gate} -> {parsed.verdict}")


def cmd_insert_task(args):
    p = argparse.ArgumentParser(prog="db.py insert-task", add_help=False)
    p.add_argument("--id", required=True, dest="task_id")
    p.add_argument("--title", required=True)
    p.add_argument("--milestone", default="")
    p.add_argument("--status", default="TODO")
    parsed = p.parse_args(args)

    session_id = get_session_id()
    ts = now_iso()

    conn = connect()
    conn.execute("""
        INSERT OR REPLACE INTO tasks(task_id, session_id, milestone, title, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (parsed.task_id, session_id, parsed.milestone, parsed.title, parsed.status, ts))
    conn.commit()
    conn.close()
    print(f"Task recorded: {parsed.task_id} - {parsed.title[:50]}")


def cmd_insert_event(args):
    p = argparse.ArgumentParser(prog="db.py insert-event", add_help=False)
    p.add_argument("--type", required=True, dest="event_type")
    p.add_argument("--payload", default="{}")
    parsed = p.parse_args(args)

    # Auto-track skill invocations in skill_invocations table too
    session_id = get_session_id()
    ts = now_iso()

    conn = connect()
    conn.execute("""
        INSERT INTO events(session_id, event_type, payload, created_at)
        VALUES (?, ?, ?, ?)
    """, (session_id, parsed.event_type, parsed.payload, ts))

    if parsed.event_type == "skill_invoked":
        try:
            payload = json.loads(parsed.payload)
            skill_name = payload.get("skill_name", "")
            skill_id = payload.get("skill_id", "")
            if skill_name:
                conn.execute("""
                    INSERT INTO skill_invocations(session_id, skill_name, skill_id, invoked_at)
                    VALUES (?, ?, ?, ?)
                """, (session_id, skill_name, skill_id, ts))
        except json.JSONDecodeError:
            pass

    conn.commit()
    conn.close()


def cmd_query(args):
    if not args:
        print("Usage: db.py query \"search terms\"", file=sys.stderr)
        sys.exit(1)

    # Quote every term as an FTS5 string. A bare term containing "-", "." or "'"
    # is parsed as query syntax ("api-contract" raised "no such column: contract").
    raw_terms = " ".join(args)
    search_terms = " ".join(
        '"' + term.replace('"', '""') + '"' for term in raw_terms.split()
    )
    conn = connect()

    print(f"Searching for: {raw_terms!r}\n")

    # Search decisions
    rows = conn.execute("""
        SELECT d.id, d.date, d.milestone, d.decision, d.rationale, d.shared
        FROM decisions d
        JOIN decisions_fts fts ON fts.rowid = d.id
        WHERE decisions_fts MATCH ?
        ORDER BY d.created_at DESC
        LIMIT 20
    """, (search_terms,)).fetchall()

    if rows:
        print(f"## Decisions ({len(rows)} found)")
        for r in rows:
            shared = " [SHARED]" if r["shared"] else ""
            milestone = f" [{r['milestone']}]" if r["milestone"] else ""
            date = r["date"] or "?"
            print(f"  {date}{milestone}{shared} - {r['decision']}")
            if r["rationale"]:
                print(f"    Why: {r['rationale']}")
        print()

    # Search tasks
    task_rows = conn.execute("""
        SELECT t.task_id, t.milestone, t.title, t.status
        FROM tasks t
        JOIN tasks_fts fts ON fts.rowid = t.rowid
        WHERE tasks_fts MATCH ?
        ORDER BY t.created_at DESC
        LIMIT 10
    """, (search_terms,)).fetchall()

    if task_rows:
        print(f"## Tasks ({len(task_rows)} found)")
        for r in task_rows:
            milestone = f"[{r['milestone']}] " if r["milestone"] else ""
            print(f"  {r['task_id']} {milestone}- {r['title']} ({r['status']})")
        print()

    if not rows and not task_rows:
        print("No results found.")

    conn.close()


def cmd_stats():
    conn = connect()

    decisions_total = conn.execute("SELECT COUNT(*) FROM decisions").fetchone()[0]
    decisions_shared = conn.execute("SELECT COUNT(*) FROM decisions WHERE shared=1").fetchone()[0]
    tasks_total = conn.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
    tasks_done = conn.execute("SELECT COUNT(*) FROM tasks WHERE status='DONE'").fetchone()[0]
    gate_approve = conn.execute("SELECT COUNT(*) FROM gate_verdicts WHERE verdict='APPROVE'").fetchone()[0]
    gate_reject = conn.execute("SELECT COUNT(*) FROM gate_verdicts WHERE verdict LIKE 'REJECT%'").fetchone()[0]
    skill_total = conn.execute("SELECT COUNT(*) FROM skill_invocations").fetchone()[0]

    print("## ADF Project Stats")
    print(f"  Decisions recorded:   {decisions_total} ({decisions_shared} shared)")
    print(f"  Tasks tracked:        {tasks_total} ({tasks_done} done)")
    print(f"  Gate verdicts:        {gate_approve} approved, {gate_reject} rejected")
    print(f"  Skill invocations:    {skill_total}")
    print()

    # Top 10 skills by invocation count
    top_skills = conn.execute("""
        SELECT skill_name, COUNT(*) as cnt
        FROM skill_invocations
        GROUP BY skill_name
        ORDER BY cnt DESC
        LIMIT 10
    """).fetchall()

    if top_skills:
        print("  Top skills:")
        for row in top_skills:
            print(f"    {row['skill_name']:<30} {row['cnt']}x")

    conn.close()


def cmd_export_session():
    session_id = get_session_id()
    conn = connect()

    result = {
        "session_id": session_id,
        "exported_at": now_iso(),
        "decisions": [dict(r) for r in conn.execute(
            "SELECT * FROM decisions WHERE session_id=? ORDER BY created_at", (session_id,)
        ).fetchall()],
        "gate_verdicts": [dict(r) for r in conn.execute(
            "SELECT * FROM gate_verdicts WHERE session_id=? ORDER BY created_at", (session_id,)
        ).fetchall()],
        "tasks": [dict(r) for r in conn.execute(
            "SELECT * FROM tasks WHERE session_id=? ORDER BY created_at", (session_id,)
        ).fetchall()],
        "skill_invocations": [dict(r) for r in conn.execute(
            "SELECT * FROM skill_invocations WHERE session_id=? ORDER BY invoked_at", (session_id,)
        ).fetchall()],
    }

    print(json.dumps(result, indent=2))
    conn.close()


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    use_utf8_stdio()
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1]
    args = sys.argv[2:]

    try:
        if cmd == "init":
            cmd_init()
        elif cmd == "insert-decision":
            cmd_insert_decision(args)
        elif cmd == "insert-gate":
            cmd_insert_gate(args)
        elif cmd == "insert-task":
            cmd_insert_task(args)
        elif cmd == "insert-event":
            cmd_insert_event(args)
        elif cmd == "query":
            cmd_query(args)
        elif cmd == "stats":
            cmd_stats()
        elif cmd == "export-session":
            cmd_export_session()
        else:
            print(f"Unknown command: {cmd!r}", file=sys.stderr)
            print(__doc__)
            sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

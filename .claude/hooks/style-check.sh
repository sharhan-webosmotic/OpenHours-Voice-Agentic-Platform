#!/usr/bin/env bash
# style-check.sh: advisory writing-style check on edited Markdown.
#
# PostToolUse(Edit|Write|MultiEdit). Flags em-dashes (U+2014) and en-dashes
# (U+2013) in the edited .md/.mdx file, per .claude/rules/writing-style-rules.md.
# Advisory only: prints to stderr and ALWAYS exits 0, never blocks an edit.
# High precision by design: these characters are never wanted in framework prose,
# so a hit is almost always a real violation. Prose semicolons are left to the
# code-reviewer agent (too many legitimate code/list-item uses to flag mechanically).
#
# Safety (per .claude/rules/adf-hook-safety-rules): set -u only, no set -e, no jq,
# exits 0 always, fails open on any infra error. Source stays ASCII: the dash
# characters are produced at runtime via bash ANSI-C quoting, not embedded.

set -u

DIR="$(dirname "$0")"
FILE="$(bash "$DIR/json-field.sh" file_path 2>/dev/null)"
[ -z "$FILE" ] && exit 0

case "$FILE" in
  *.md|*.mdx) : ;;
  *) exit 0 ;;
esac
[ -f "$FILE" ] || exit 0
case "$FILE" in
  */node_modules/*|*/.git/*|*/dist/*|*/build/*|*/.next/*) exit 0 ;;
esac

HITS="$(grep -nF -e $'\xe2\x80\x94' -e $'\xe2\x80\x93' "$FILE" 2>/dev/null | head -5)"
if [ -n "$HITS" ]; then
  echo "[style] $FILE: em/en-dash found. writing-style-rules.md: rewrite the sentence, do not just swap the character (use a colon, comma, or two sentences)." >&2
  printf '%s\n' "$HITS" | sed 's/^/  /' >&2
fi

# Banned-phrase pass (document-generation-rules.md Rule 5). Advisory only.
# High-precision subset: the mechanically-unambiguous phrases and words. The
# lower-precision bans (unlock, harness, empower, foster, elevate, robust in
# technical prose) stay a Rule 7 self-check, not a grep, to keep hits real.
# Rule files are skipped: they quote the banned list as "avoid" examples.
case "$FILE" in
  */rules/*) exit 0 ;;
esac

PHRASE_HITS="$(grep -niE "in today's fast-paced|ever-evolving landscape|in the digital age|now more than ever|it is important to note|it should be mentioned|it is worth noting|needless to say|as we all know|in conclusion, it is clear|the possibilities are endless|look no further" "$FILE" 2>/dev/null | head -5)"
WORD_HITS="$(grep -niE '\b(leverage|leveraging|leverages|utilize|utilizing|utilizes|synergize|synergizes|delve|delves|delving|seamless|seamlessly|cutting-edge|best-in-class|holistic|state-of-the-art|world-class|game-changing)\b' "$FILE" 2>/dev/null | head -5)"
if [ -n "$PHRASE_HITS" ] || [ -n "$WORD_HITS" ]; then
  echo "[style] $FILE: banned AI phrase found. document-generation-rules.md Rule 5: delete the phrase or rewrite around a concrete claim." >&2
  [ -n "$PHRASE_HITS" ] && printf '%s\n' "$PHRASE_HITS" | sed 's/^/  /' >&2
  [ -n "$WORD_HITS" ] && printf '%s\n' "$WORD_HITS" | sed 's/^/  /' >&2
fi
exit 0

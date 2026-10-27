#!/usr/bin/env node
// patch-win32.cjs: build Windows-capable copies of the vendored Cloudflare validators.
//
// Why: upstream readFileWithinLimit() refuses every input when the OS exposes no
// O_NOFOLLOW / O_NONBLOCK (all Windows Node builds), so Phase 4 can never pass on
// Windows. This script leaves vendor/.../upstream/ untouched and writes patched
// copies to vendor/.../adf-win32/. On win32 only, the patched reader falls back to
// lstat (reject symlinks and non-regular files), opens O_RDONLY, then compares the
// fstat identity (dev + ino + size) with the lstat result and rejects any change.
// Every other platform keeps the upstream code path unchanged.
//
// Usage: node patch-win32.cjs <vendor-dir>
// Exit 1 when an anchor is missing (upstream changed: review and update this patch).
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const vendor = process.argv[2];
if (!vendor) {
  console.error("usage: node patch-win32.cjs <vendor-dir>");
  process.exit(1);
}
const up = path.join(vendor, "upstream");
const out = path.join(vendor, "adf-win32");
fs.mkdirSync(out, { recursive: true });

const MARK = "// ADF win32 overlay (skills/deep-security-audit/scripts/patch-win32.cjs)";
const GUARD_RE = /  if \(!Number\.isInteger\(noFollow\) \|\| noFollow === 0 \|\| !Number\.isInteger\(nonBlock\) \|\| nonBlock === 0\) \{\n(?:    \/\/[^\n]*\n)?    throw new SafeInputError\("OS no-follow and nonblocking input protection is unavailable"\);\n  \}\n/;
const OPEN_OLD = "descriptor = fs.openSync(file, fs.constants.O_RDONLY | noFollow | nonBlock);";
const FSTAT_OLD = "const stat = fs.fstatSync(descriptor);";

const GUARD_NEW = `  ${MARK}
  const flagsMissing = !Number.isInteger(noFollow) || noFollow === 0 || !Number.isInteger(nonBlock) || nonBlock === 0;
  const win32Fallback = flagsMissing && process.platform === "win32";
  if (flagsMissing && !win32Fallback) {
    throw new SafeInputError("OS no-follow and nonblocking input protection is unavailable");
  }
  let preStat = null;
  if (win32Fallback) {
    preStat = fs.lstatSync(file);
    if (preStat.isSymbolicLink()) throw new SafeInputError("input must not be a symlink");
    if (!preStat.isFile()) throw new SafeInputError("input must be a regular file");
  }
`;
const OPEN_NEW = "descriptor = fs.openSync(file, win32Fallback ? fs.constants.O_RDONLY : fs.constants.O_RDONLY | noFollow | nonBlock);";
const FSTAT_NEW = `const stat = fs.fstatSync(descriptor);
    if (win32Fallback && (stat.dev !== preStat.dev || stat.ino !== preStat.ino || stat.size !== preStat.size)) {
      throw new SafeInputError("input changed between lstat and open");
    }`;

function patch(name) {
  const src = fs.readFileSync(path.join(up, name), "utf8").replace(/\r\n/g, "\n");
  if (!GUARD_RE.test(src) || !src.includes(OPEN_OLD) || !src.includes(FSTAT_OLD)) {
    console.error(`ANCHOR MISSING in ${name}: upstream changed, review patch-win32.cjs before use`);
    process.exit(1);
  }
  const fstatAt = src.indexOf(FSTAT_OLD, src.indexOf(OPEN_OLD));
  let res = src.slice(0, fstatAt) + FSTAT_NEW + src.slice(fstatAt + FSTAT_OLD.length);
  res = res.replace(GUARD_RE, GUARD_NEW).replace(OPEN_OLD, OPEN_NEW);
  fs.writeFileSync(path.join(out, name), res);
  console.log(`patched ${name}`);
}

patch("validate-findings.cjs");
patch("validate-coverage-ledger.cjs");
// Siblings the validators and tests require by relative path, copied verbatim.
for (const f of ["report-schema.json", "validate-findings.test.cjs", "validate-coverage-ledger.test.cjs"]) {
  fs.copyFileSync(path.join(up, f), path.join(out, f));
}
console.log(`wrote ${out}`);

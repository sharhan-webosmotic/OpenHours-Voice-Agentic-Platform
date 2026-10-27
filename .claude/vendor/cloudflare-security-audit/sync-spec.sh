# sync-spec.sh for vendor/cloudflare-security-audit (sourced by scripts/sync-vendor.sh)
REPO="https://github.com/cloudflare/security-audit-skill.git"

vendor_copy() {
  local clone="$1" dest="$2"
  mkdir -p "$dest/upstream"
  cp "$clone"/skills/security-audit/* "$dest/upstream/"
  cp "$clone/LICENSE" "$clone/README.md" "$dest/upstream/"
}

post_apply() {
  local vdir="$1" fw
  fw="$(cd "$vdir/../.." && pwd)"
  rm -rf "$vdir/adf-win32"
  node "$fw/skills/deep-security-audit/scripts/patch-win32.cjs" "$vdir" || return 1
  bash "$fw/skills/deep-security-audit/scripts/sec-validate.sh" selftest > /dev/null 2>&1 || return 1
}

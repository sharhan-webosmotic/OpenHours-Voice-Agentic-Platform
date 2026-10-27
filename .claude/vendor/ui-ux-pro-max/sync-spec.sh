# sync-spec.sh for vendor/ui-ux-pro-max (sourced by scripts/sync-vendor.sh)
REPO="https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git"

vendor_copy() {
  local clone="$1" dest="$2" f
  mkdir -p "$dest/data" "$dest/scripts"
  cp -r "$clone/src/ui-ux-pro-max/data/." "$dest/data/"
  for f in search.py core.py design_system.py reasoning_contract.py; do
    cp "$clone/src/ui-ux-pro-max/scripts/$f" "$dest/scripts/"
  done
}

post_apply() {
  local vdir="$1" fw
  fw="$(cd "$vdir/../.." && pwd)"
  # The vetted subset must stay offline: no network or exec primitives. This is a
  # tripwire, not a proof: the operator still reads the full diff before --apply.
  if grep -nE "urllib\.request|import requests|http\.client|socket|subprocess|os\.system|os\.popen|os\.exec|os\.spawn|importlib|__import__|exec\(|eval\(|compile\(|ctypes|pickle" "$vdir"/scripts/*.py; then
    echo "[ui-ux-pro-max] network or exec primitive found in vendored scripts: review before use" >&2
    return 1
  fi
  bash "$fw/scripts/tests/test-design-lookup.sh" > /dev/null 2>&1 || return 1
}

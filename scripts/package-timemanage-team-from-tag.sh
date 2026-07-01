#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <tag>" >&2
  echo "Example: $0 v0.1.1" >&2
  exit 1
fi

TAG="$1"
COMMIT="$(git -C "${ROOT_DIR}" rev-parse -q --verify "refs/tags/${TAG}^{commit}" 2>/dev/null || true)"

if [ -z "${COMMIT}" ]; then
  echo "[TimeManage] Tag not found: ${TAG}" >&2
  exit 1
fi

SAFE_TAG="$(printf '%s' "${TAG}" | tr -c 'A-Za-z0-9._-' '-')"
WORKTREE="${TMPDIR:-/tmp}/timemanage-team-release-${SAFE_TAG}-$$"

cleanup() {
  git -C "${ROOT_DIR}" worktree remove --force "${WORKTREE}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

git -C "${ROOT_DIR}" worktree add --detach "${WORKTREE}" "${TAG}" >/dev/null

if [ ! -f "${WORKTREE}/scripts/package-timemanage-team.sh" ]; then
  echo "[TimeManage] Tag ${TAG} does not contain scripts/package-timemanage-team.sh." >&2
  echo "[TimeManage] Create a new release tag after the release packaging scripts are committed." >&2
  exit 1
fi

if [ ! -d "${WORKTREE}/node_modules" ]; then
  if [ -d "${ROOT_DIR}/node_modules" ]; then
    ln -s "${ROOT_DIR}/node_modules" "${WORKTREE}/node_modules"
  else
    npm --prefix "${WORKTREE}" install
  fi
fi

VERSION="${TAG#v}"

TM_DEPLOY_ROOT="${ROOT_DIR}/deploy" \
TM_PACKAGE_VERSION="${VERSION}" \
TM_RELEASE_TAG="${TAG}" \
TM_RELEASE_COMMIT="${COMMIT}" \
bash "${WORKTREE}/scripts/package-timemanage-team.sh"

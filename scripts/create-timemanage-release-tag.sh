#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <tag> [message]" >&2
  echo "Example: $0 v0.1.1 \"TimeManage Team v0.1.1\"" >&2
  exit 1
fi

TAG="$1"
MESSAGE="${2:-TimeManage Team release ${TAG}}"

cd "${ROOT_DIR}"

CURRENT_BRANCH="$(git branch --show-current)"
if [ "${CURRENT_BRANCH}" != "main" ]; then
  echo "[TimeManage] Release tags must be created from main. Current branch: ${CURRENT_BRANCH:-detached HEAD}" >&2
  echo "[TimeManage] Merge your fix/feature branch into main before releasing." >&2
  exit 1
fi

if ! git diff --quiet --ignore-submodules -- || ! git diff --cached --quiet --ignore-submodules --; then
  echo "[TimeManage] Working tree is not clean. Commit or stash changes before creating a release tag." >&2
  git status --short
  exit 1
fi

git fetch origin main:refs/remotes/origin/main --tags

LOCAL_HEAD="$(git rev-parse main)"
REMOTE_HEAD="$(git rev-parse origin/main)"
if [ "${LOCAL_HEAD}" != "${REMOTE_HEAD}" ]; then
  echo "[TimeManage] Local main is not identical to origin/main." >&2
  echo "[TimeManage] Local main:  ${LOCAL_HEAD}" >&2
  echo "[TimeManage] Origin main: ${REMOTE_HEAD}" >&2
  echo "[TimeManage] Pull remote changes or push local main before creating a release tag." >&2
  exit 1
fi

if git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null; then
  echo "[TimeManage] Tag already exists: ${TAG}" >&2
  exit 1
fi

git tag -a "${TAG}" -m "${MESSAGE}"

echo "[TimeManage] Created release tag: ${TAG}"
echo "[TimeManage] Package it with:"
echo "  npm run release:team:tag -- ${TAG}"

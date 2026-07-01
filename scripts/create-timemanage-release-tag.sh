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

if git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null; then
  echo "[TimeManage] Tag already exists: ${TAG}" >&2
  exit 1
fi

if ! git diff --quiet --ignore-submodules -- || ! git diff --cached --quiet --ignore-submodules --; then
  echo "[TimeManage] Working tree is not clean. Commit or stash changes before creating a release tag." >&2
  git status --short
  exit 1
fi

git tag -a "${TAG}" -m "${MESSAGE}"

echo "[TimeManage] Created release tag: ${TAG}"
echo "[TimeManage] Package it with:"
echo "  npm run release:team:tag -- ${TAG}"

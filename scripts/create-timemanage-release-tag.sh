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

CONTRACT_TAG="$(node --input-type=module -e 'import fs from "node:fs"; console.log(`v${JSON.parse(fs.readFileSync("release-contract.json", "utf8")).release_version}`)')"
if [ "${TAG}" != "${CONTRACT_TAG}" ]; then
  echo "[TimeManage] Tag ${TAG} does not match the release contract tag ${CONTRACT_TAG}." >&2
  exit 1
fi

EXPECTED_BRANCH="release/${TAG}"
if [ "${CURRENT_BRANCH}" != "${EXPECTED_BRANCH}" ]; then
  echo "[TimeManage] Release tags must be created from ${EXPECTED_BRANCH}. Current branch: ${CURRENT_BRANCH:-detached HEAD}" >&2
  echo "[TimeManage] Create the short-lived release branch from an up-to-date main first." >&2
  exit 1
fi

if ! git diff --quiet --ignore-submodules -- || ! git diff --cached --quiet --ignore-submodules --; then
  echo "[TimeManage] Working tree is not clean. Commit or stash changes before creating a release tag." >&2
  git status --short
  exit 1
fi

git fetch origin main:refs/remotes/origin/main --tags
git fetch origin "${CURRENT_BRANCH}:refs/remotes/origin/${CURRENT_BRANCH}"

LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_RELEASE_HEAD="$(git rev-parse "origin/${CURRENT_BRANCH}")"
if [ "${LOCAL_HEAD}" != "${REMOTE_RELEASE_HEAD}" ]; then
  echo "[TimeManage] Local release branch is not identical to origin/${CURRENT_BRANCH}." >&2
  echo "[TimeManage] Local HEAD:  ${LOCAL_HEAD}" >&2
  echo "[TimeManage] Remote HEAD: ${REMOTE_RELEASE_HEAD}" >&2
  echo "[TimeManage] Push the reviewed release commit before creating the immutable tag." >&2
  exit 1
fi

if ! git merge-base --is-ancestor origin/main HEAD; then
  echo "[TimeManage] ${CURRENT_BRANCH} must be based on the current origin/main history." >&2
  exit 1
fi

if git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null; then
  echo "[TimeManage] Tag already exists: ${TAG}" >&2
  exit 1
fi

node scripts/verify-release-contract.mjs
npm run verify:database-migrations
npm run audit:data-safety
npm run verify:ios:release

git tag -a "${TAG}" -m "${MESSAGE}"

echo "[TimeManage] Created release tag: ${TAG}"
echo "[TimeManage] Package it with:"
echo "  npm run release:team:tag -- ${TAG}"

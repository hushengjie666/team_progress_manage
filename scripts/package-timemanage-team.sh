#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_ROOT="${TM_DEPLOY_ROOT:-${ROOT_DIR}/deploy}"
PACKAGE_VERSION="${TM_PACKAGE_VERSION:-$(node -p "require('./package.json').version")}"
PACKAGE_STAMP="${TM_PACKAGE_STAMP:-$(date +%Y%m%d-%H%M%S)}"
PACKAGE_NAME="timemanageTeam-v${PACKAGE_VERSION}-${PACKAGE_STAMP}"
PACKAGE_DIR="${DEPLOY_ROOT}/${PACKAGE_NAME}"
BUILD_DIR="${TMPDIR:-/tmp}/timemanage-team-win2008-build"
GO120_IMAGE="${GO120_IMAGE:-golang:1.20-bookworm}"
GIT_COMMIT="${TM_RELEASE_COMMIT:-$(git rev-parse --short=12 HEAD 2>/dev/null || true)}"
GIT_TAG="${TM_RELEASE_TAG:-$(git describe --exact-match --tags HEAD 2>/dev/null || true)}"
GIT_DIRTY="unknown"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  GIT_DIRTY="clean"
  if ! git diff --quiet --ignore-submodules -- || ! git diff --cached --quiet --ignore-submodules --; then
    GIT_DIRTY="dirty"
  fi
fi

cd "${ROOT_DIR}"
mkdir -p "${DEPLOY_ROOT}"

echo "[TimeManage] Building frontend for /timemanage-team/ ..."
rm -rf dist
npm run build -- --base=/timemanage-team/

rm -rf "${PACKAGE_DIR}"
mkdir -p "${PACKAGE_DIR}/web" "${PACKAGE_DIR}/server"
rsync -a --delete dist/ "${PACKAGE_DIR}/web/"

if ! command -v docker >/dev/null 2>&1; then
  echo "[TimeManage] Docker is required to build the Windows Server 2008 compatible backend." >&2
  exit 1
fi

echo "[TimeManage] Building Windows Server 2008 compatible backend with ${GO120_IMAGE} ..."
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"
rsync -a --delete team-server/ "${BUILD_DIR}/"
docker run --rm -v "${BUILD_DIR}:/src" -w /src "${GO120_IMAGE}" sh -lc '
  /usr/local/go/bin/go mod edit -go=1.20
  /usr/local/go/bin/go get github.com/go-sql-driver/mysql@v1.8.1 golang.org/x/sys@v0.16.0 golang.org/x/crypto@v0.17.0
  /usr/local/go/bin/go mod tidy
  GOOS=windows GOARCH=amd64 /usr/local/go/bin/go build -trimpath -ldflags="-s -w" -o bin/timemanage-team-win2008.exe .
'

cp "${BUILD_DIR}/bin/timemanage-team-win2008.exe" "${PACKAGE_DIR}/server/timemanage-team.exe"
cp team-server/install-windows-service.ps1 "${PACKAGE_DIR}/server/install-windows-service.ps1"
cp team-server/start-backend.bat "${PACKAGE_DIR}/server/start-backend.bat"
cp team-server/stop-backend.bat "${PACKAGE_DIR}/server/stop-backend.bat"
cp team-server/backend.example.json "${PACKAGE_DIR}/server/backend.example.json"

rm -f "${PACKAGE_DIR}/server/backend.json"

cat >"${PACKAGE_DIR}/RELEASE.txt" <<EOF
TimeManage Team ${PACKAGE_VERSION}
Build: ${PACKAGE_STAMP}
Git tag: ${GIT_TAG:-none}
Git commit: ${GIT_COMMIT:-unknown}
Git tree: ${GIT_DIRTY}

Contents:
  web\                  frontend files built for /timemanage-team/
  server\timemanage-team.exe
  server\backend.example.json
  server\start-backend.bat
  server\stop-backend.bat
  server\install-windows-service.ps1

Install:
  unzip this folder as the live timemanageTeam directory
  copy server\backend.example.json to server\backend.json on first install
  edit server\backend.json
  run server\start-backend.bat or install the Windows service
EOF

cd "${DEPLOY_ROOT}"
rm -f "${DEPLOY_ROOT}/${PACKAGE_NAME}.zip"
find "${PACKAGE_NAME}" -name ".DS_Store" -delete
COPYFILE_DISABLE=1 zip -Xqr "${DEPLOY_ROOT}/${PACKAGE_NAME}.zip" "${PACKAGE_NAME}"

echo "[TimeManage] Package ready: ${DEPLOY_ROOT}/${PACKAGE_NAME}.zip"
echo "[TimeManage] Zip root folder: ${PACKAGE_NAME}/"
echo "[TimeManage] Upload as the live timemanageTeam folder, edit server/backend.json, then run server/start-backend.bat."

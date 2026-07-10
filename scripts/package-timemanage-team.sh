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
node scripts/verify-release-version.mjs "${PACKAGE_VERSION}"
node scripts/verify-database-migrations.mjs
mkdir -p "${DEPLOY_ROOT}"

echo "[TimeManage] Building Tauri desktop bundles ..."
npm run tauri:build

TAURI_BUNDLE_DIR="${ROOT_DIR}/src-tauri/target/release/bundle"
if [ ! -d "${TAURI_BUNDLE_DIR}" ]; then
  echo "[TimeManage] Tauri bundle directory not found: ${TAURI_BUNDLE_DIR}" >&2
  exit 1
fi

echo "[TimeManage] Building frontend for /timemanage-team/ ..."
rm -rf dist
npm run build -- --base=/timemanage-team/

rm -rf "${PACKAGE_DIR}"
mkdir -p "${PACKAGE_DIR}/desktop" "${PACKAGE_DIR}/web" "${PACKAGE_DIR}/server"

TAURI_BUNDLE_COUNT=0
copy_tauri_bundles() {
  local bundle_group="$1"
  shift
  local bundle_path
  mkdir -p "${PACKAGE_DIR}/desktop/${bundle_group}"
  for bundle_path in "$@"; do
    if [ ! -e "${bundle_path}" ]; then
      continue
    fi
    if [[ "$(basename "${bundle_path}")" == rw.* ]]; then
      continue
    fi
    rsync -a "${bundle_path}" "${PACKAGE_DIR}/desktop/${bundle_group}/"
    TAURI_BUNDLE_COUNT=$((TAURI_BUNDLE_COUNT + 1))
  done
  if [ -z "$(find "${PACKAGE_DIR}/desktop/${bundle_group}" -mindepth 1 -maxdepth 1 -print -quit)" ]; then
    rmdir "${PACKAGE_DIR}/desktop/${bundle_group}"
  fi
}

shopt -s nullglob
copy_tauri_bundles macos "${TAURI_BUNDLE_DIR}"/macos/*.app
copy_tauri_bundles dmg "${TAURI_BUNDLE_DIR}"/dmg/*.dmg
copy_tauri_bundles msi "${TAURI_BUNDLE_DIR}"/msi/*.msi
copy_tauri_bundles nsis "${TAURI_BUNDLE_DIR}"/nsis/*.exe
copy_tauri_bundles deb "${TAURI_BUNDLE_DIR}"/deb/*.deb
copy_tauri_bundles rpm "${TAURI_BUNDLE_DIR}"/rpm/*.rpm
copy_tauri_bundles appimage "${TAURI_BUNDLE_DIR}"/appimage/*.AppImage
shopt -u nullglob

if [ "${TAURI_BUNDLE_COUNT}" -eq 0 ]; then
  echo "[TimeManage] No distributable Tauri bundles found under: ${TAURI_BUNDLE_DIR}" >&2
  exit 1
fi

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
  /usr/local/go/bin/go get github.com/go-sql-driver/mysql@v1.8.1 github.com/pressly/goose/v3@v3.20.0 golang.org/x/sys@v0.18.0 golang.org/x/crypto@v0.21.0
  /usr/local/go/bin/go mod tidy
  test "$(/usr/local/go/bin/go list -m -f {{.Version}} github.com/pressly/goose/v3)" = "v3.20.0"
  GOOS=windows GOARCH=amd64 /usr/local/go/bin/go build -trimpath -ldflags="-s -w" -o bin/timemanage-team-win2008.exe .
'

cp "${BUILD_DIR}/bin/timemanage-team-win2008.exe" "${PACKAGE_DIR}/server/timemanage-team.exe"
cp team-server/install-windows-service.ps1 "${PACKAGE_DIR}/server/install-windows-service.ps1"
cp team-server/start-backend.bat "${PACKAGE_DIR}/server/start-backend.bat"
cp team-server/stop-backend.bat "${PACKAGE_DIR}/server/stop-backend.bat"
cp team-server/backend.example.json "${PACKAGE_DIR}/server/backend.example.json"
cp team-server/database-status.bat "${PACKAGE_DIR}/server/database-status.bat"
cp team-server/migrate-database.bat "${PACKAGE_DIR}/server/migrate-database.bat"
cp team-server/backup-database.bat "${PACKAGE_DIR}/server/backup-database.bat"
cp team-server/rollback-database.bat "${PACKAGE_DIR}/server/rollback-database.bat"
cp team-server/restore-database.bat "${PACKAGE_DIR}/server/restore-database.bat"
cp team-server/DATABASE-OPERATIONS.md "${PACKAGE_DIR}/server/DATABASE-OPERATIONS.md"
mkdir -p "${PACKAGE_DIR}/server/migrations"
cp team-server/migrations/*.sql "${PACKAGE_DIR}/server/migrations/"

rm -f "${PACKAGE_DIR}/server/backend.json"

cat >"${PACKAGE_DIR}/RELEASE.txt" <<EOF
TimeManage Team ${PACKAGE_VERSION}
Build: ${PACKAGE_STAMP}
Git tag: ${GIT_TAG:-none}
Git commit: ${GIT_COMMIT:-unknown}
Git tree: ${GIT_DIRTY}

Contents:
  desktop\              Tauri desktop application and installers
  web\                  frontend files built for /timemanage-team/
  server\timemanage-team.exe
  server\backend.example.json
  server\start-backend.bat
  server\stop-backend.bat
  server\install-windows-service.ps1
  server\DATABASE-OPERATIONS.md
  server\migrations\       versioned MySQL migration SQL
  server\database-status.bat
  server\migrate-database.bat
  server\backup-database.bat
  server\rollback-database.bat
  server\restore-database.bat

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
echo "[TimeManage] Package directory: ${PACKAGE_DIR}"
echo "[TimeManage] Zip root folder: ${PACKAGE_NAME}/"
echo "[TimeManage] Desktop bundles are under desktop/. For server deployment, use web/ and server/."

#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/timemanage-sync}"
CONFIG_DIR="${CONFIG_DIR:-/etc/timemanage-sync}"
SERVICE_FILE="/etc/systemd/system/timemanage-sync.service"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root: sudo INSTALL_DIR=${INSTALL_DIR} CONFIG_DIR=${CONFIG_DIR} $0"
  exit 1
fi

id -u timemanage >/dev/null 2>&1 || useradd --system --home "${INSTALL_DIR}" --shell /usr/sbin/nologin timemanage
mkdir -p "${INSTALL_DIR}" "${CONFIG_DIR}"
cp ./bin/timemanage-sync "${INSTALL_DIR}/timemanage-sync"
chmod 0755 "${INSTALL_DIR}/timemanage-sync"

CREATED_CONFIG=0
if [[ ! -f "${CONFIG_DIR}/sync.json" ]]; then
  cp ./config.example.json "${CONFIG_DIR}/sync.json"
  echo "Edit ${CONFIG_DIR}/sync.json and set mysql_dsn before starting the backend service."
  CREATED_CONFIG=1
fi

cp ./timemanage-sync.service.example "${SERVICE_FILE}"
systemctl daemon-reload
systemctl enable timemanage-sync
if [[ "${CREATED_CONFIG}" -eq 0 ]]; then
  systemctl restart timemanage-sync
  systemctl status timemanage-sync --no-pager
else
  echo "Backend service installed but not started. Edit ${CONFIG_DIR}/sync.json, then run: sudo systemctl start timemanage-sync"
fi

#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/timemanage-team}"
CONFIG_DIR="${CONFIG_DIR:-/etc/timemanage-team}"
SERVICE_FILE="/etc/systemd/system/timemanage-team.service"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root: sudo INSTALL_DIR=${INSTALL_DIR} CONFIG_DIR=${CONFIG_DIR} $0"
  exit 1
fi

id -u timemanage >/dev/null 2>&1 || useradd --system --home "${INSTALL_DIR}" --shell /usr/sbin/nologin timemanage
mkdir -p "${INSTALL_DIR}" "${CONFIG_DIR}"
cp ./bin/timemanage-team "${INSTALL_DIR}/timemanage-team"
chmod 0755 "${INSTALL_DIR}/timemanage-team"

CREATED_CONFIG=0
if [[ ! -f "${CONFIG_DIR}/backend.json" ]]; then
  cp ./backend.example.json "${CONFIG_DIR}/backend.json"
  echo "Edit ${CONFIG_DIR}/backend.json and set mysql_dsn before starting the backend service."
  CREATED_CONFIG=1
fi

cp ./timemanage-team.service.example "${SERVICE_FILE}"
systemctl daemon-reload
systemctl enable timemanage-team
if [[ "${CREATED_CONFIG}" -eq 0 ]]; then
  systemctl restart timemanage-team
  systemctl status timemanage-team --no-pager
else
  echo "Backend service installed but not started. Edit ${CONFIG_DIR}/backend.json, then run: sudo systemctl start timemanage-team"
fi

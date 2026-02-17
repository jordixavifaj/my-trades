#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"

echo "[1/3] GET /auth"
curl -fsS "$BASE_URL/auth" >/dev/null

echo "[2/3] GET /api/auth/me (expect 401)"
status=$(curl -s -o /tmp/me.json -w '%{http_code}' "$BASE_URL/api/auth/me")
if [[ "$status" != "401" ]]; then
  echo "Expected 401, got $status"
  exit 1
fi

echo "[3/3] GET /api/reports (expect 401 unauth)"
status=$(curl -s -o /tmp/reports.json -w '%{http_code}' "$BASE_URL/api/reports")
if [[ "$status" != "401" ]]; then
  echo "Expected 401, got $status"
  exit 1
fi

echo "E2E smoke OK"

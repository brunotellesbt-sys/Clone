#!/usr/bin/env bash
# Testa a conectividade e a validade da chave da API da Meshy.
# Uso: MESHY_API_KEY=msy_... ./scripts/test-meshy.sh
set -euo pipefail

: "${MESHY_API_KEY:?defina MESHY_API_KEY no ambiente}"

check() {
  local label=$1 url=$2
  echo "== $label"
  local out code
  out=$(curl -sS -w '\n%{http_code}' -H "Authorization: Bearer $MESHY_API_KEY" "$url") || {
    echo "  falha de rede"; return 1; }
  code=${out##*$'\n'}
  echo "  HTTP $code"
  echo "  ${out%$'\n'*}" | head -c 500
  echo
}

check "saldo (creditos)" "https://api.meshy.ai/openapi/v1/balance"
check "listar tarefas text-to-3d" "https://api.meshy.ai/openapi/v2/text-to-3d?page_size=1"

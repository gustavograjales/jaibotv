#!/bin/bash
# ⚠️ ⚠️ ⚠️ ESTADO HISTÓRICO — VALIDAR ANTES DE EJECUTAR ⚠️ ⚠️ ⚠️
#
# Este script fue creado en la sesión 2026-05-07 cuando jromero88 estaba
# enabled=0 y se planeaba limpiar sus canales muertos.
#
# ESTADO ACTUAL (2026-05-08): jromero88 fue rehabilitada (enabled=1).
# Los IDs hardcoded en este script (DELETE_NO_VALUE, DELETE_REPLACED, etc.)
# podrían no aplicar tras el restore de DB del 7-mayo.
#
# ANTES DE EJECUTAR:
#   1. Validar que los IDs hardcoded siguen existiendo en DB
#   2. Validar que la decisión sobre jromero88 sigue vigente
#   3. Ejecutar primero en --dryrun (default) y revisar el output
#   4. Solo aplicar con --apply si todo se ve correcto
#
# Ver docs/handoff.md (sesión 2026-05-07 y 2026-05-08) para contexto.
#
# ─────────────────────────────────────────────────────────────────────────────
# JaiboTV — Limpieza de fuente jromero88 (m3u_source:1)
# ─────────────────────────────────────────────────────────────────────────────
# - Backup previo de iptv.db
# - DRY-RUN por defecto: muestra qué haría sin tocar nada
# - Ejecutar con --apply para aplicar cambios
# - Todo dentro de una transacción: si algo falla, rollback completo
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

DB="/home/ggajales/iptv-server/data/iptv.db"
BACKUP_DIR="/home/ggajales/iptv-server/data/backups"
TS=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/iptv_${TS}_pre_jromero_cleanup.db"

# IDs según análisis de la sesión 2026-05-07
DELETE_NO_VALUE=(2247 2249 2250 2251 2252 2254 2256 2258)        # 8 canales muertos sin valor
DELETE_REPLACED=(14 2255 2257 2259)                              # 4 con reemplazo en iptv-org
DISABLE_NO_REPLACEMENT=(2248 2253 2260)                          # 3 sin reemplazo (enabled=0)
FIX_SOURCE_ID=(4)                                                # Azteca Uno mal etiquetado

MODE="dryrun"
if [[ "${1:-}" == "--apply" ]]; then
  MODE="apply"
fi

echo "════════════════════════════════════════════════════════════════"
echo "  JaiboTV — Cleanup jromero88"
echo "  Modo: ${MODE}"
echo "  DB:   ${DB}"
echo "════════════════════════════════════════════════════════════════"

# ─── Verificación previa ─────────────────────────────────────────────────────
if [[ ! -f "$DB" ]]; then
  echo "❌ DB no encontrada: $DB"
  exit 1
fi

# Helper para SQL list: convierte (1 2 3) en "1,2,3"
join_ids() { local IFS=','; echo "$*"; }

DEL_NV=$(join_ids "${DELETE_NO_VALUE[@]}")
DEL_REP=$(join_ids "${DELETE_REPLACED[@]}")
DIS_NR=$(join_ids "${DISABLE_NO_REPLACEMENT[@]}")
FIX_SRC=$(join_ids "${FIX_SOURCE_ID[@]}")

# ─── Estado pre-cambio ───────────────────────────────────────────────────────
echo ""
echo "── Estado actual ────────────────────────────────────────────────"
sqlite3 -header -column "$DB" "
SELECT stream_status, COUNT(*) as n 
FROM channels WHERE enabled=1 
GROUP BY stream_status;
"

echo ""
echo "── Canales que se ELIMINARÁN (sin valor) ───────────────────────"
sqlite3 -header -column "$DB" "
SELECT id, name, stream_status FROM channels WHERE id IN (${DEL_NV});
"

echo ""
echo "── Canales que se ELIMINARÁN (reemplazados por iptv-org) ───────"
sqlite3 -header -column "$DB" "
SELECT id, name, stream_status FROM channels WHERE id IN (${DEL_REP});
"

echo ""
echo "── Canales que se DESHABILITARÁN (sin reemplazo, rastreables) ──"
sqlite3 -header -column "$DB" "
SELECT id, name, stream_status FROM channels WHERE id IN (${DIS_NR});
"

echo ""
echo "── Canal con source_id mal etiquetado (se limpia source_id) ────"
sqlite3 -header -column "$DB" "
SELECT id, name, source_id, stream_status FROM channels WHERE id IN (${FIX_SRC});
"

echo ""
echo "── Fuente jromero88 (m3u_source:1) — se desactivará ────────────"
sqlite3 -header -column "$DB" "
SELECT id, name, enabled, channel_count FROM m3u_sources WHERE id=1;
"

# ─── DRY-RUN: salir aquí ─────────────────────────────────────────────────────
if [[ "$MODE" == "dryrun" ]]; then
  echo ""
  echo "════════════════════════════════════════════════════════════════"
  echo "  DRY-RUN completo. Para aplicar cambios:"
  echo "    bash $(basename "$0") --apply"
  echo "════════════════════════════════════════════════════════════════"
  exit 0
fi

# ─── APPLY ───────────────────────────────────────────────────────────────────
echo ""
echo "── Backup de la BD ──────────────────────────────────────────────"
mkdir -p "$BACKUP_DIR"
cp "$DB" "$BACKUP_FILE"
echo "✅ Backup creado: $BACKUP_FILE"
ls -lh "$BACKUP_FILE"

echo ""
echo "── Ejecutando cambios en transacción ───────────────────────────"
sqlite3 "$DB" <<SQL
BEGIN TRANSACTION;

-- 1. Eliminar canales muertos sin valor
DELETE FROM channels WHERE id IN (${DEL_NV});

-- 2. Eliminar canales con reemplazo en iptv-org
DELETE FROM channels WHERE id IN (${DEL_REP});

-- 3. Deshabilitar canales sin reemplazo (rastreables)
UPDATE channels SET enabled=0 WHERE id IN (${DIS_NR});

-- 4. Limpiar source_id mal etiquetado
UPDATE channels SET source_id=NULL WHERE id IN (${FIX_SRC});

-- 5. Desactivar la fuente jromero88
UPDATE m3u_sources SET enabled=0 WHERE id=1;

COMMIT;
SQL

echo "✅ Cambios aplicados"

# ─── Verificación post-cambio ────────────────────────────────────────────────
echo ""
echo "── Estado post-cambio ───────────────────────────────────────────"
sqlite3 -header -column "$DB" "
SELECT stream_status, COUNT(*) as n 
FROM channels WHERE enabled=1 
GROUP BY stream_status;
"

echo ""
echo "── Verificación: canales eliminados ya no existen ──────────────"
DEL_ALL="${DEL_NV},${DEL_REP}"
COUNT_DEL=$(sqlite3 "$DB" "SELECT COUNT(*) FROM channels WHERE id IN (${DEL_ALL});")
echo "Canales restantes de los que debían eliminarse: ${COUNT_DEL} (esperado: 0)"

echo ""
echo "── Verificación: canales deshabilitados rastreables ────────────"
sqlite3 -header -column "$DB" "
SELECT id, name, enabled, stream_status 
FROM channels WHERE id IN (${DIS_NR});
"

echo ""
echo "── Verificación: source_id limpio ──────────────────────────────"
sqlite3 -header -column "$DB" "
SELECT id, name, source_id FROM channels WHERE id IN (${FIX_SRC});
"

echo ""
echo "── Verificación: m3u_source:1 desactivada ──────────────────────"
sqlite3 -header -column "$DB" "
SELECT id, name, enabled FROM m3u_sources WHERE id=1;
"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  ✅ Limpieza completada."
echo "  Backup en: $BACKUP_FILE"
echo "  Para revertir:"
echo "    cp $BACKUP_FILE $DB"
echo "    pm2 restart jaibotv"
echo ""
echo "  Próximo paso: invalidar cache M3U (cache TTL=60s, opcional)"
echo "════════════════════════════════════════════════════════════════"

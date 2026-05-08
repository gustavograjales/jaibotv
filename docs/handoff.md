# Handoff técnico — JaiboTV

## Sesión 2026-05-08 (viernes)

### Tipo de sesión

Auditoría documental completa: validación de cada `docs/*.md` contra el estado real del servidor + corrección de inconsistencias.

### Qué se hizo

1. Análisis inicial del estado del repositorio y del handoff del 7-mayo
2. Evaluación de adelantar Fase 5 (acceso remoto seguro) para el fin de semana → descartada
3. Evaluación de mudanza física del servidor a casa de Gustavo → descartada
4. **Decisión:** servidor se queda en su ubicación actual sin cambios de red ni accesos remotos durante el fin de semana
5. Detección de desincronización entre instrucciones del proyecto (Claude.ai) y `CLAUDE.md` del repo
6. Reescritura de `CLAUDE.md` para sincronizar 1:1 con instrucciones del proyecto
7. **Auditoría sistemática docs vs realidad** ejecutando 15 queries de verificación contra DB y endpoints
8. Detección de múltiples inconsistencias entre lo documentado y el estado real
9. Actualización quirúrgica de 4 archivos `docs/*.md` para reflejar la realidad
10. Eliminación de bloque duplicado de "Refactor estructural futuro" en `roadmap.md` (176 líneas redundantes)

### Hallazgos críticos de la auditoría

| Aspecto | Documentado (incorrecto) | Realidad (verificado) |
|---|---|---|
| Fuentes EPG | 25 | 19 (18 ok + 1 error) |
| EPG IDs indexados | ~9,261 | 7,639 |
| Fuente jromero88 | DESHABILITADA con "Bug #14" | HABILITADA (`enabled=1`) |
| Categorías | 11 (handoff 7-mayo afirmaba) | 10 (la "124 Religioso" no existe) |
| Canales tvtv | 13 | 12 (Movistar Deportes en error) |
| Canales tvpori | 69 únicos | 75 registros / 69 únicos (6 duplicados activos por Bug #13) |
| Cron M3U | "diario 3 AM" implícito en handoff anterior | Semanal (`0 3 */7 * *`) |
| Bug #14 | Reportado como activo | Estado incierto — la fuente que se decía afectada está ahora habilitada |

### Archivos modificados (en orden de aplicación)

1. **`CLAUDE.md`** — sincronizado 1:1 con instrucciones del proyecto Claude.ai (añadida sección "Cómo arrancar cada sesión", reescrito "Cómo responderle a Gustavo", reforzado protocolo de cierre con énfasis "CADA sesión")
2. **`docs/sources.md`** — reescritura completa basada en datos reales:
   - jromero88: marcada como HABILITADA (no DESHABILITADA)
   - tvtv: tabla con 12 canales reales y `stream_param` real (no `stream_id`)
   - tvpori: tabla con 75 registros (33 deportes + 42 regionales) + bloque separado de 6 duplicados Bug #13
   - EPG: lista completa de las 19 fuentes reales con priority y status
   - Eliminada sección "Scrapers pendientes" (TV Azteca + sitio nuevo) — TV Azteca ya estaba en bullet de roadmap
   - Header con fecha de auditoría
3. **`docs/AI_CONTEXT.md`** — un cambio quirúrgico: "EPG se consolida desde 25 fuentes" → "19 fuentes (18 ok + 1 error)"
4. **`docs/architecture.md`** — 6 cambios numéricos:
   - Diagrama: "EPG (25 fuentes)" → "EPG (19 fuentes)"
   - Sección epg_sources: "25 fuentes activas" → "19 fuentes (18 ok + 1 error)"
   - Tabla m3u_sources: jromero88 enabled `0` → `1`
   - Bloque procesamiento EPG: "25 XMLTVs" → "19 XMLTVs", "9,261 entradas" → "7,639 entradas"
   - Tabla crons: "consolida 25 XMLTVs" → "consolida 19 XMLTVs"
5. **`docs/roadmap.md`** — múltiples cambios:
   - Eliminado bloque duplicado "Refactor estructural futuro" (176 líneas)
   - Header fecha: 2026-05-07 → 2026-05-08
   - Cifras corregidas en tabla de estado: 9,261 → 7,639; 25 → 19; M3U "deshabilitada" → "ambas habilitadas"
   - Header tabla: "Estado de canales al 2026-05-07 (post-restore)" → "Estado al 2026-05-08 (post-auditoría)"
   - Bug #14 suavizado a "Validar Bug #14" (no afirmar como hecho hasta validar el lunes)
   - Quitado el "~" de "94 canales" (cifra exacta verificada)
   - Nota Fase 5 pospuesta (aplicada al inicio de la sesión)

### Archivos NO modificados (intencionalmente)

- **Código fuente en `src/`** — sin tocar (el usuario decidió no atacar bugs hoy)
- **`data/iptv.db`** — sin tocar
- **`docs/bugs.md`** — sin tocar (revisión Bug #13/#14 se hace el lunes con datos del fin de semana)
- **`docs/api.md`** — sin tocar (no hubo cambios de endpoints)
- **`docs/infra.md`** — sin tocar (no hubo cambios de hardware/red)
- **`docs/design-system.md`** — sin tocar
- **`package.json`, `ecosystem.config.cjs`** — sin tocar

### Decisiones tomadas

| Decisión | Razón |
|---|---|
| Fase 5 NO se adelanta | Requiere hardening (auth admin, fail2ban, SSL, dominio) que no compensa el riesgo de exposición rápida. Pospuesta a post-15 mayo. |
| Tailscale NO se implementa | Discutido pero descartado como atajo. |
| Mudanza física CANCELADA | Servidor se queda en su ubicación actual con su configuración actual. |
| Sin acceso remoto este fin de semana | El servidor opera en red local Telmex con IP 192.168.1.250 sin cambios. |
| `CLAUDE.md` ↔ instrucciones del proyecto | Deben converger. CLAUDE.md es fuente de verdad en repo; instrucciones del proyecto son su espejo en la UI de Claude.ai. |
| Documentar la realidad ahora; bugs el lunes | Primero asegurar consistencia entre docs y estado real. Reservar trabajo de bugs para cuando tengamos comportamiento del fin de semana observado. |
| No tocar `bugs.md` hoy | Bugs #13/#14 requieren datos del fin de semana antes de decidir cambios. Su estado actual de los docs es coherente con la realidad observada. |

### Bugs descubiertos / cerrados

- **Ninguno cerrado.**
- **Bug #13 confirmado activo y persistente:** 6 pares de duplicados verificados en DB (deportes 4, 24, 29, 33; regionales 51, 72). Se documentaron explícitamente en `docs/sources.md` con IDs concretos.
- **Bug #14 puesto en duda:** la fuente que supuestamente disparaba el bug (jromero88, `enabled=0`) ahora está `enabled=1`. No es claro si el bug existió, fue resuelto, o se enmascaró. Validar el lunes con logs del cron M3U si corre durante el fin de semana (poco probable: el cron es semanal).

### Estado del servidor al cierre

- **Servicio:** `jaibotv` online en PM2, memoria 183 MB
- **DB:** 2.6 MB, 94 canales activos
- **Streams:** 81 ok / 13 error
- **EPG:** 19 fuentes (18 ok + Free EPG Ru en error por OOM)
- **EPG IDs indexados:** 7,639
- **Logos:** 3,848
- **IP pública:** 189.175.131.95 (sin cambios desde 2026-05-04)
- **Crones recientes ejecutados hoy:** EPG diario 04:00 ✅, stream check 06:00 ✅, tvpori scrape 06:30 y 09:30 ✅, tvtv scrape 08:00 ✅
- **Health:** ok

### Pendiente — siguiente paso recomendado

**Fin de semana 9-10 mayo (sin acción del usuario requerida):**

- Servidor sigue corriendo en su ubicación actual
- Crones siguen activos según horarios documentados
- No se hacen cambios al servidor

**Lunes 12 mayo:**

1. **Auditoría de comportamiento del fin de semana:**
   - Revisar logs PM2 de las 72h previas
   - Validar si corrieron los crones esperados sin errores
   - Si el cron M3U corrió: validar Bug #14 (¿procesó jromero88? ¿qué pasó con los canales?)
   - Confirmar si aparecieron nuevos duplicados de tvpori (Bug #13) — actualmente son 6 pares
2. **Decisión sobre Bug #13 y Bug #14:**
   - Si Bug #13 no creó nuevos duplicados: puede esperar al Validador de importaciones
   - Si Bug #13 creó nuevos duplicados: priorizar fix puntual del matching en `tvporiScraper.js:136`
   - Si Bug #14 no se reprodujo: cerrar como "no aplicable"
3. **Probar acceso desde cliente IPTV** (Smarters / TiviMate) en red local — medir tiempos de respuesta del M3U y de los streams
4. **Validar que las instrucciones del proyecto en Claude.ai siguen reflejando lo que dice `CLAUDE.md`** — copiar/pegar manual si es necesario

### Comandos útiles para retomar el lunes

```bash
# Estado general
pm2 status
pm2 logs jaibotv --lines 200 --nostream

# Logs del fin de semana específicamente
pm2 logs jaibotv --lines 1000 --nostream | grep -E "2026-05-09|2026-05-10|2026-05-11"

# Snapshot rápido de la DB
sqlite3 ~/iptv-server/data/iptv.db <<'EOF'
SELECT 'canales activos', COUNT(*) FROM channels WHERE enabled=1;
SELECT stream_status, COUNT(*) FROM channels WHERE enabled=1 GROUP BY stream_status;
SELECT 'duplicados tvpori', COUNT(*) FROM channels c1
  WHERE c1.tvpori_host != '' AND EXISTS (
    SELECT 1 FROM channels c2
    WHERE c2.tvpori_host = c1.tvpori_host
    AND c2.tvpori_stream_id = c1.tvpori_stream_id
    AND c2.id != c1.id
  );
EOF

# Verificar IP pública
curl -s https://api.ipify.org && echo
```

### Backups de docs creados en esta sesión

```
~/backups/docs-20260508_083958/
├── handoff.md.pre-fix              ← antes de renombrar encabezados
├── sources.md.pre-audit-update
├── AI_CONTEXT.md.pre-audit-update
├── architecture.md.pre-audit-update
├── roadmap.md.pre-audit-update     ← original con duplicado
├── roadmap.md.pre-truncate         ← antes de eliminar duplicado
├── roadmap.md.pre-revert-faseC     ← antes de revertir bloque scrapers pendientes
└── handoff.md.pre-audit-update     ← este archivo antes de actualizarse
```

### Último commit antes de esta sesión

```
c7f5e9f (HEAD -> main, origin/main) feat(roadmap): agregar Validador de importaciones masivas + limpieza categorias
```

---


## Sesión 2026-05-07 (jueves)

### Tipo de sesión

Auditoría completa + reestructuración documental para soportar trabajo con múltiples motores de IA (Claude / ChatGPT / Cursor).

### Estado del servidor al cierre

- **Servicio:** `jaibotv` online en PM2, uptime restablecido tras restore
- **Memoria:** ~120 MB (OK, dentro de límite 800M)
- **DB:** restaurada desde `~/backups/db/iptv_20260507.db` (backup automático de las 04:00 hoy)
- **Canales activos:** 94
- **Salud:** `curl http://localhost:3000/health` → `{"status":"ok","version":"1.0.0"}`
- **IP pública:** 189.175.131.95 (sin cambios desde 2026-05-04)
- **Crones:** todos activos según `scheduler.js` (tvtv 4h, tvpori 3.5h, EPG diario 4 AM, stream check 6h)

### Lo que se hizo

1. **Backup de seguridad inicial** en `~/backups/pre-cleanup-20260507_154001/`:
   - `iptv.db` (estado al inicio de sesión)
   - `iptv-server-snapshot.tar.gz` (proyecto sin node_modules)
   - `git-full.bundle` (todas las refs de git)
   - `pm2-dump.json` (config PM2)
   - `state-snapshot.txt` (estado capturado)

2. **Auditoría del estado del servidor** vs lo declarado en CLAUDE.md:
   - Confirmado: bug TLS resuelto correctamente (undici v7.25 instalado, sin `NODE_TLS_REJECT_UNAUTHORIZED` en código)
   - Confirmado: heap subido a 512MB funcionando (uso real ~36 MiB, 86%)
   - Confirmado: crones tvtv/tvpori/stream check ejecutándose en horarios documentados
   - Discrepancia detectada: cron M3U del 7 de mayo a las 09:00 trajo 27 canales nuevos sin validación previa
   - Discrepancia detectada: cron tvpori del 7 de mayo a las 12:30 creó 7 INSERTs duplicados en lugar de UPDATEs (bug en el matching del scraper)
   - Discrepancia detectada: `m3u_sources.id=1` (jromero88) marcada `enabled=0` en DB pero el cron sigue procesándola
   - Discrepancia detectada: existe categoría `124 Religioso` no documentada en CLAUDE.md (el doc dice 10, son 11)
   - Discrepancia detectada: ya existe backup automático diario en `~/backups/db/` (CLAUDE.md lo lista como deuda técnica #8 sin existir)
   - Discrepancia detectada: schema de `m3u_sources` usa columna `last_fetched`, no `last_refresh` como asume CLAUDE.md

3. **Intento fallido de merge de duplicados:**
   - Se intentó fusionar 6 pares de canales duplicados creados por el scraper de tvpori
   - El script SQL pegado por heredoc en SSH se corrompió por line-wrap de la terminal
   - Resultado: UPDATEs parciales se ejecutaron (5 canales con datos mezclados), DELETEs no se ejecutaron
   - **Restaurado al backup automático de las 04:00 hoy** (`iptv_20260507.db`) → estado limpio anterior al cron M3U problemático

4. **Decisión estratégica:**
   - Validador de importaciones masivas (que estaba en roadmap) se pospone post-15 mayo
   - Esta semana: estabilidad y prueba de experiencia de usuario final (cliente IPTV en red local)
   - Reestructuración documental (este archivo y sus hermanos) es la prioridad de hoy/mañana

### Archivos creados en esta sesión

- `docs/AI_CONTEXT.md` — onboarding rápido para cualquier IA
- `docs/handoff.md` — este archivo
- `docs/architecture.md` — estructura técnica del sistema
- `docs/infra.md` — hardware, red, operaciones
- `docs/api.md` — endpoints
- `docs/roadmap.md` — fases y prioridades
- `docs/bugs.md` — bugs activos + lecciones
- `docs/sources.md` — catálogo de scrapers y fuentes
- `CLAUDE.md` (reescrito) — índice corto + reglas de comportamiento

### Archivos NO modificados (intencionalmente)

- Código fuente en `src/` — sin tocar
- `data/iptv.db` — restaurado al estado de las 04:00 hoy, sin más modificaciones
- `package.json`, `ecosystem.config.cjs` — sin tocar
- `docs/design-system.md` — sin tocar (ya existía y está vigente)

### Decisiones tomadas

| Decisión | Razón |
|---|---|
| No tocar código de scrapers en esta sesión | Sin validador de importaciones, cualquier fix puntual del scraper introduce riesgo. Mejor congelar comportamiento conocido. |
| No limpiar duplicados manualmente | El intento de hoy demostró que SQL grande pegado en SSH es frágil. Esperar a tener proceso seguro o construir el validador. |
| Documentación primero, bugs después | El usuario quiere probar experiencia de cliente final esta semana. Sin docs estructuradas, las próximas sesiones (con o sin Claude) no tendrán contexto. |
| Backup automático SÍ funciona | Está corriendo desde antes de hoy, en `~/backups/db/`. Documentar y dejar de listarlo como deuda. |

### Bugs descubiertos hoy (ver `docs/bugs.md` para detalle)

- **Bug #13:** scraper de tvpori hace INSERT en lugar de UPDATE cuando el nombre del catálogo no coincide exactamente con el nombre en DB
- **Bug #14:** cron M3U procesa fuentes con `enabled=0`
- **Bug #15:** loop excesivo de retries TLS en tvpori (60+ líneas por scrape) — funcional pero contamina logs

### Pendiente — siguiente paso recomendado

**Próxima sesión (mañana viernes 8 mayo):**

1. Validar que cualquier IA (ChatGPT, Cursor, etc.) puede leer `docs/AI_CONTEXT.md` y entender el proyecto sin perderse
2. Probar acceso desde cliente IPTV (Smarters / TiviMate) en red local — medir tiempos de respuesta del M3U y de los streams
3. Si tiempo: limpieza manual desde admin panel de los 27 canales basura del cron M3U de las 9:00 (ya no están en DB tras restore, pero cuando el cron vuelva a correr mañana 3 AM, pueden volver a entrar)
4. Considerar: deshabilitar temporalmente el cron M3U hasta que exista validador

**Semana 11-15 mayo (prueba de estabilidad):**

- Cliente IPTV configurado, uso normal
- Monitorear logs PM2 diariamente
- Apuntar comportamientos raros, latencias, streams que caen
- No agregar features nuevos durante la prueba

### Comandos útiles para retomar

```bash
# Estado general
pm2 status
pm2 logs jaibotv --lines 50 --nostream

# Stats del proyecto
curl -s http://localhost:3000/admin/stats

# Snapshot rápido de la DB
sqlite3 ~/iptv-server/data/iptv.db <<'EOF'
SELECT 'canales activos', COUNT(*) FROM channels WHERE enabled=1;
SELECT stream_status, COUNT(*) FROM channels WHERE enabled=1 GROUP BY stream_status;
EOF

# Forzar verificación de streams
curl -X POST http://localhost:3000/admin/streams/check-all

# Ver últimos commits
cd ~/iptv-server && git log --oneline -10
```

### Último commit antes de esta sesión

```
c7f5e9f (HEAD -> main, origin/main) feat(roadmap): agregar Validador de importaciones masivas + limpieza categorias
```

### Backups disponibles en el servidor

```
~/backups/db/iptv_20260507.db                              ← restaurado HOY
~/backups/db/iptv_20260507_100852_pre_jromero_cleanup.db
~/backups/db/iptv_pre-cat-cleanup_20260507_091249.db
~/backups/db/iptv_20260506.db
~/backups/db/iptv_20260505.db
~/backups/db/iptv_20260504.db
~/backups/pre-cleanup-20260507_154001/                     ← snapshot inicio sesión hoy
```

### Notas para la próxima IA / próximo Gustavo

- **Si el cron M3U vuelve a meter canales basura mañana 3 AM**, hay que decidir entre:
  - (a) deshabilitar el cron hasta tener validador
  - (b) ejecutar limpieza manual desde admin panel diariamente
  - (c) desactivar la fuente `iptv-org México` (id=4) hasta que tengamos staging
- **Los duplicados del scraper de tvpori probablemente vuelvan a aparecer** en la próxima corrida del cron (3.5h tras el restore). Vigilar y, si aparecen, no usar el método SQL del 7 de mayo (causó corrupción).
- El proyecto está en buen estado funcional. La prueba de la semana 11-15 puede arrancar con el estado restaurado.

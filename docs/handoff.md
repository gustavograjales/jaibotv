# Handoff técnico — JaiboTV

> **Este archivo se actualiza cada sesión de trabajo.**
> Es el primer archivo que cualquier IA o humano debe leer al retomar el proyecto.

---

## Última sesión: 2026-05-07 (jueves)

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

# Handoff técnico — JaiboTV

## Sesión 2026-05-15 (viernes) — pre-mudanza

### Tipo de sesión
Implementación external_id tvtv + refactor scrape tvpori DB-driven + update masivo 41 canales + checklist pre-mudanza.

### Qué se hizo

1. **Bloque B-tvtv completado: external_id extendido a tvtv**
   - `src/core/externalId.js` extendido con ramas `tvtv:{stream_param}`, `m3u:{source_id}:{tvg_id}` y `m3u:{source_id}:url:{sha1_8}` + helpers `normalizeUrl` y `sha1_8`
   - `src/core/tvtvScraper.js` con match prioritario por external_id + fallback por nombre solo si external_id legacy vacío
   - Bug equivalente al #13 en tvtvScraper (matching por nombre case-insensitive) queda neutralizado en el nuevo flujo
   - 0 canales tvtv en DB hoy (eliminados en limpieza del 14-may), por lo que NO hay migración pendiente
   - Próximo import-csv tvtv (manual cuando aplique) los traerá con external_id desde día 1

2. **Bloque B-m3u POSPUESTO al lunes 18-may post-mudanza**
   - aggregator.js NO modificado hoy. 158 canales M3U siguen sin external_id
   - El cron M3U es semanal (próximo trigger: 21-may), no hay urgencia
   - Lunes: aplicar el mismo patrón a aggregator.js + script de migración explícito de los 158

3. **Refactor mayor: `scrapeAllTvporiChannels()` ahora itera la DB, no TVPORI_CHANNELS hardcoded**
   - Antes: iteraba el array de 69 canales hardcoded en código → tokens stale en los 246 del bulk-import
   - Después: `SELECT FROM channels WHERE tvpori_host != '' AND tvpori_stream_id != ''` → 315 canales
   - UPDATE por `id` de DB (no por external_id ni por nombre) → no puede crear duplicados, neutraliza Bug #13 en el flujo de refresh
   - Bloque INSERT eliminado del cron (refresh NO crea canales, eso es trabajo de import/discover)
   - TVPORI_CHANNELS se conserva como catálogo histórico, lo sigue usando `scrapeTvporiByName()`

4. **Scrape masivo en producción: 315/315 actualizados en ~11 min, 0 fallidos**
   - Disparado vía `POST /admin/tvpori/scrape` tras el refactor
   - Todos los tokens frescos al cierre, válidos ~4h

5. **Update masivo de 41 canales desde Excel categorizado**
   - Script `/tmp/apply_excel_update.py` con dry-run + apply + backup automático
   - Match por id, validación sanity check con external_id esperado
   - Distribución final: 24 Internacionales + 6 Películas + 3 Series + 2 Noticias + 2 Documentales + 2 General + 1 Deportes + 1 Infantil
   - Categoría 🔍 Por revisar bajó de 82 → 31

6. **Pre-mudanza completado**
   - Network state capturado en `~/network-pre-mudanza.txt`
   - Backup DB en `~/backups/db/iptv_pre-mudanza_20260515_142618.db`
   - Backup proyecto en `~/backups/iptv-server-pre-mudanza-20260515_142623.tar.gz`
   - Papelito mudanza en `~/papelito-mudanza.txt`
   - Hallazgo: el servidor está en **WiFi (wlp0s20f3), no cable**. MAC: 70:9C:D1:17:95:58
   - Hallazgo: contenedor docker `epg-iptv-org` (puerto 5000) corriendo 8 días, NO está siendo consumido por ningún `epg_sources`. Huérfano. Evaluar apagar post-mudanza.

### Cifras al cierre (verificadas)

| Métrica | Valor |
|---|---|
| Canales activos | 473 |
| Con external_id | 315 (todos tvpori) |
| Sin external_id | 158 (M3U pendientes lunes) |
| Scrape tvpori último | 315/315 OK (12:48 CST) |
| Por revisar restantes | 31 |
| PM2 jaibotv | online, 144 MB, uptime 2h |
| Docker huérfano | epg-iptv-org (8d uptime, sin consumo) |
| Disco | 7% usado |

### Archivos modificados (código fuente)

- `src/core/externalId.js` (reemplazo completo)
- `src/core/tvtvScraper.js` (import + reemplazo del bloque for con match-by-external_id)
- `src/core/tvporiScraper.js` (reemplazo de `scrapeAllTvporiChannels` para iterar DB)

### Decisiones tomadas

| Decisión | Razón |
|---|---|
| B-m3u pospuesto al lunes | Cron M3U semanal corre 21-may, no hay urgencia, mantener cronograma de mudanza |
| Cloudflare Tunnel pospuesto al sábado | Token de Claude al 73%, mantener foco en docs + commit antes del apagado |
| WiFi en oficina y en casa | El servidor ya está en WiFi (wlp0s20f3), no hay tiempo de cambiar a cable hoy |
| Subdominio `tv.myalpha.fit` (no comprar dominio) | Dominio myalpha.fit ya disponible. Subdominio cumple sin costo adicional |
| UPDATE por id en refresh tvpori | Match físico simple, no puede crear duplicados, neutraliza Bug #13 en este flujo |
| Refresh NO crea canales | Refresh y discovery son responsabilidades distintas. Refresh solo refresca URLs |
| Mantener TVPORI_CHANNELS como referencia | Lo usa `scrapeTvporiByName()` y vale como catálogo histórico/bootstrap |
| Docker epg-iptv-org se queda corriendo hoy | Aunque huérfano, lleva 8 días estable. Decidir en casa si apagar |

### Bugs nuevos / cerrados

- **Bug #13 (duplicados tvpori en scrape):** sin cerrar formalmente, pero **neutralizado en el flujo de refresh tvpori** gracias al refactor (UPDATE por id no puede crear duplicados). El bug sigue activo en `scrapeTvporiByName()` y en el bulk-import desde discover, pero el cron de las 3.5h ya no lo activa.
- **Bug #13-equivalente en tvtvScraper:** identificado durante la sesión (match por `LOWER(name)=LOWER(?)`). Resuelto en el patch de tvtvScraper.js al introducir match-by-external_id como prioritario.
- **No hay bugs nuevos.**

### Patches con errores históricos (lecciones reforzadas)

- Primer intento de patch via script Python falló por escapes incorrectos (`\n` literal). Tuvo rollback total via `git checkout HEAD`. Versión correcta del patch (script bash + nano + Python embebido sin escapes complejos) funcionó al segundo intento. **Reafirma lección crítica #1 del CLAUDE.md: heredocs y escapes complejos en SSH son frágiles. Preferir archivos simples a disco.**

### Siguiente sesión recomendada

**Sábado 16-may (en casa, post-mudanza):**

1. Verificar arranque del servidor en red 192.168.100.x (WiFi del Huawei HG8145V5)
2. Reservar IP estática por MAC `70:9C:D1:17:95:58` en panel del router Totalplay
3. Actualizar `config.js` (SERVER_IP) si la IP cambia respecto a 192.168.1.250
4. Verificar `pm2 status`, `curl localhost:3000/health`, `docker ps`
5. **Cloudflare Tunnel**: instalar `cloudflared`, configurar túnel, DNS records `tv.myalpha.fit` y opcionalmente `admin.tv.myalpha.fit`, `ssh.tv.myalpha.fit`
6. Validar streaming desde 4G iPhone (fuera de la red local)

**Lunes 18-may:**

7. Aplicar patch aggregator.js (B-m3u pospuesto): mismo patrón de match-by-external_id
8. Script de migración explícito para los 158 canales M3U sin external_id
9. Validar los 31 tvpori restantes en "Por revisar" si los identificas desde IPTVX

### Backups creados en esta sesión
~/backups/db/iptv_pre-sesion-15mayo_20260515_104304.db
~/backups/pre-externalId-tvtv-20260515_111828/
~/backups/db/iptv_pre-scrape-15mayo_20260515_113119.db
~/backups/pre-tvpori-refactor-20260515_123702/
~/backups/db/iptv_pre-excel-update_20260515_142352.db
~/backups/db/iptv_pre-mudanza_20260515_142618.db
~/backups/iptv-server-pre-mudanza-20260515_142623.tar.gz
~/network-pre-mudanza.txt
~/papelito-mudanza.txt

### Último commit antes de esta sesión
f373e7e (HEAD -> main, origin/main) docs: roadmap actualizado — sesión 2026-05-14
---





## Sesión 2026-05-14 — Importación masiva tvpori (922 canales)

### Hallazgo crítico al iniciar
- Server tvpori cambió validación HTTP: requests con headers básicos
  (curl/Python/browser) reciben 403 al consumir .m3u8
- streamChecker funciona porque envía Range headers (HTTP 206)
- Cliente IPTV (IPTVX/TiviMate) sigue funcionando perfectamente
- DAZN F1 confirmado funcional en IPTVX → sistema OK, solo Discover UI con preview hls.js queda inválido

### Decisión: Importación masiva sin preview
- En vez de validar uno por uno con preview admin, importar todos los
  922 pendientes y validar desde cliente IPTV (IPTVX en iPhone)

### Cambios implementados
1. **Categoría nueva**: `🔍 Por revisar` (id=125, sort_order=99)
2. **Endpoint nuevo**: `POST /admin/tvpori/import-all-pending`
   - Body: `{ category_id, delay_ms?: 1200, host?: 'both' }`
   - Asíncrono, responde inmediato y corre en background
   - Itera pendientes (alive + no in_db + no skipped)
   - Scrape fresco por canal + INSERT con external_id estable
   - Naming: `tvpori-DEP-NNN` / `tvpori-REG-NNN` (padding 3 dígitos)
   - Log de progreso cada 25 canales
3. **Endpoint nuevo**: `GET /admin/tvpori/import-all-pending/status`
   - Devuelve resultado del último bulk import

### Resultado de la importación
✅ 922/922 importados (100% éxito, 0 fallidos)
⏱️  26.6 minutos (1599s)
📊 Catálogo final: 1,151 canales activos
- 921 en "🔍 Por revisar" (pendientes de validar)
- 992 con anchor tvpori estable
- 160 canales de otras fuentes (M3U)
### Workflow de validación pendiente

Para próximas sesiones, el flujo es:
1. Refrescar IPTVX → ver categoría "🔍 Por revisar"
2. Probar canales por tandas (ej: DEP-001 a DEP-050)
3. Para cada uno:
   - Funciona → admin web → renombrar + categorizar + asignar EPG/logo
   - No funciona → deshabilitar (`enabled=0`)
4. Cuando "Por revisar" quede vacía, la categoría se puede eliminar

### Estado al cierre
- PM2 jaibotv: online, ~18 MB
- DB con 1,151 canales activos, 992 con anchor estable
- Commit pendiente del endpoint bulk-import
- Pendiente principal: validación manual de 921 canales desde IPTVX

### Limitación documentada (BUG-16 actualizado)
El server tvpori valida algo específico del cliente que solo cliente IPTV
real (TiviMate/IPTVX) puede satisfacer. curl/Python/browser/hls.js reciben
403 al consumir .m3u8. streamChecker funciona porque usa Range requests.
**Implicación:** Discover UI con preview hls.js queda inválido hasta que
el server cambie política. Workaround: importar a ciegas + validar en
cliente IPTV real.

---


### Limpieza de categorías (final sesión 2026-05-14)

Decisión: simplificar catálogo a 2 categorías para empezar validación limpia.

**Operación SQL ejecutada (en transacción):**
```sql
-- Move 1: Deportes (29 canales) -> Por revisar
UPDATE channels SET category_id=125 WHERE enabled=1 AND category_id=2;

-- Move 2: 17 categorías diversas (137 canales) -> Undefined
UPDATE channels SET category_id=109 
WHERE enabled=1 AND category_id NOT IN (109, 125) AND category_id IS NOT NULL;
```

**Estado final del catálogo:**
- 🔍 Por revisar (125): 952 canales (todos tvpori con anchor estable)
- Undefined (109): 198 canales (de M3U externos, sin anchor)
- Total activos: 1,150

**Backup pre-limpieza:**
`~/backups/db/iptv_pre-cat-cleanup_20260514_*.db`

**Razonamiento:**
- Los 29 canales de "Deportes" (DAZN F1, ESPN, FOX, etc.) ya tienen
  nombre real y external_id correcto, pero se movieron a "Por revisar"
  para validar todos los tvpori juntos desde IPTVX.
- Las categorías raras (Entertainment, News, Religious, etc.) eran
  auto-generadas del scraping M3U y estaban dispersas.
- Después de validar, los canales que funcionen se moverán a sus
  categorías reales (Deportes, Películas, Noticias, etc.) manualmente.

---


### Actualización masiva desde Excel (final sesión 2026-05-14)

Después del bulk-import + limpieza de categorías, Gustavo trabajó manualmente
(entre interacciones con Claude) en la validación de canales desde IPTVX:

1. Probó ~952 canales tvpori desde IPTVX
2. Renombró ~235 canales de `tvpori-NNN` a sus nombres reales
3. Eliminó físicamente ~677 canales sin señal (no deshabilitados, borrados)
4. Marcó ~40 canales con sufijo `-OK` como pendientes de renombrar
5. Exportó listado de DB a Excel con columnas: Canal, Categoría, País
6. Categorizó manualmente 332 canales en 15 categorías
7. Asignó código de país (11 países: MX, US, ES, AR, PE, CO, CL, DE, CR, PY, VE)

**Update masivo desde Excel ejecutado:**
- Script: `/tmp/apply_excel_update.py --apply`
- Backup pre-update: `~/backups/db/iptv_pre-excel-update_20260514_*.db`
- Match: 330/330 nombres del Excel matchean exactamente con DB (100%)
- Filas actualizadas: 391 (más que 330 por canales con nombres duplicados)
- 4 categorías nuevas creadas: Regionales MX, Cultura, Religioso, Clima

**Estado final del catálogo:**
Categoría              Canales
─────────────────────────────────
Noticias                 14
Deportes                 83
Entretenimiento          21
Películas                47
Series                   20
Infantil                 11
Documentales             18
Música                   10
Internacionales          20
General                  19
Cultura                  19
Regionales MX           100
Religioso                 2
Clima                     1
Adultos                   7
🔍 Por revisar          80  (tvpori-NNN aún pendientes)
Undefined                 1
─────────────────────────────────
Total activos:          473
**Distribución por país:**
- MX: 219 canales
- US: 126 canales
- ES: 16 canales
- AR: 11 canales
- Otros (PE/CO/CL/DE/VE/PY/PR/CR): 16 canales

### Pendientes para próxima sesión

1. **Renombrar los 80 tvpori-NNN restantes** que están con sufijo -OK
   (significa que ya se validaron en IPTVX y solo falta asignarles nombre/categoría)
2. **Revisar el 1 canal en "Undefined"** (verificar qué es y categorizar)
3. **Eliminar la categoría "Por revisar"** una vez vacía
4. Refactor channel_sources para failover real (Fase 6 VPS)

---

## Sesión 2026-05-13 PM — Feature Discover UI (preview hls.js + import manual)

### Lo que se hizo

**FEATURE COMPLETADO: Vista admin de descubrimiento tvpori**

1. **Barrido extendido tvpori (1-500 en ambos hosts):**
   - 998/1000 stream_ids respondieron como "vivos"
   - 929 nuevos pendientes (no en DB)
   - Función `discoverTvporiStreams()` mejorada con corte automático tras N errores consecutivos

2. **Backend (src/api/admin.js, +289 líneas):**
   - `GET /admin/tvpori/discover/pending` — lista filtrada/paginada
   - `POST /admin/tvpori/skip-discovered` — marcar como saltado
   - `DELETE /admin/tvpori/skip-discovered/:host/:stream_id` — deshacer skip
   - `POST /admin/tvpori/import-discovered` — scrape fresco + INSERT con external_id
   - `GET /admin/tvpori/fresh-url` — scrape fresco para preview

3. **Schema:**
   - `CREATE TABLE tvpori_skipped (host, stream_id, reason, skipped_at)`

4. **Vista admin nueva (src/admin-ui/discover.html + discover.js):**
   - Card de un canal a la vez con preview on-demand (hls.js)
   - Detección automática de calidad FHD/HD/SD/LOW (lee videoWidth × videoHeight)
   - Form completo: nombre, categoría, EPG ID con autocomplete, logo URL con autocomplete, país
   - Botones "Skip y siguiente" / "Importar y siguiente"
   - Paginación, filtros host
   - Link nav: "🔍 Descubrir tvpori" en admin principal

### Hallazgos críticos durante la sesión

1. **El descubrimiento masivo da MUCHOS falsos positivos.** El scraper reporta "vivo" cuando el HTML tiene `var src=...`, pero la URL final puede dar 403 al consumirla. La tasa real de canales válidos solo se medirá con preview manual.

2. **Validación de canales NO funciona desde server-side.** curl/Python desde el servidor JaiboTV reciben 403 del servidor remoto incluso para canales que SÍ funcionan en cliente IPTV (ej: DAZN F1). El servidor remoto valida algo (probablemente fingerprint TLS o IP del request) que solo cliente IPTV final o browser pueden satisfacer.

3. **JaiboTV NO es proxy real de streaming:** solo hace HTTP 302 redirect. El cliente IPTV final es quien fetcha el .m3u8 directo del servidor remoto.

4. **hls.js en browser SÍ puede reproducir el stream** vía el proxy de JaiboTV (validado con DAZN F1: F1 Miami con Hülkenberg).

### Decisión arquitectónica

**Opción 1 (modelo simple) por ahora:** un canal = una fuente = una URL. El refactor a `channel_sources` (relación 1:N canal lógico → fuentes) se hará durante la migración a VPS (Fase 6 del roadmap).

### Estado actual al cierre

- **41 canales activos** con external_id estable
- **920 canales tvpori pendientes** de revisar en `/admin/discover.html`
- **PM2 jaibotv: online, ~18 MB**
- Backups: `~/backups/db/iptv_pre-discover-ui_20260513_165444.db`, archivos pre-cambio en `~/backups/pre-discover-ui-20260513_165444/`

### Pendiente próxima sesión

1. **Importación manual de canales** usando el discover UI
2. Identificar cuáles canales son consumibles vs falsos positivos
3. Asignar nombres reales, categorías, EPG, logos durante import
4. Documentar tasa real de validez de los 929 descubiertos

### Pendiente refactor VPS (Fase 6 roadmap)

- Tabla `channel_sources` (1:N canal → fuentes)
- Failover automático en xtream.js basado en priority
- Migración canales existentes al nuevo modelo

---

## Sesión 2026-05-11 (lunes) — auditoría post-fin de semana + limpieza EPG

### Tipo de sesión

Auditoría del comportamiento del fin de semana (sin actividad humana 9-10 mayo) + bug fix GZIP + limpieza estratégica de fuentes EPG basada en calidad real.

### Hallazgos del fin de semana

**Crones ejecutados sin intervención:**
- Cron EPG diario 04:00 CST: ✅ corrió 9, 10 y 11 de mayo
- Cron stream check cada 6h: ✅ corriendo, 80 OK / 14 error estable
- Cron tvtv 4h y tvpori 3.5h: ✅ corriendo
- Cron IP monitor 10 min: ✅ corriendo (IP estable: 189.175.131.95)
- **Cron M3U semanal: NO corrió** (próximo trigger sería 14 mayo)
- **Cron tvpori: NO creó nuevos duplicados** durante el fin de semana (Bug #13 dormido, sigue con 6 pares originales)

**PM2: 3 días sin restarts** — estabilidad confirmada post-fix de TLS + UA Chrome + entity expansion del 6 mayo.

**Fallback TLS validado en producción real:** el 7 de mayo a las 12:31 UTC (06:31 CST), el cert de `regionales.saohgdasregions.fun` expiró y el fallback con undici se activó correctamente para los 42 canales regionales. Después Let's Encrypt renovó el cert (válido hasta 30 julio) y los warnings desaparecieron solos. El fix del 6 mayo cumplió 100%.

### Bug GZIP descubierto y resuelto

**Síntoma:** Durante 3 días seguidos (9, 10, 11 mayo) el cron EPG de las 4 AM generó 4 errores:
- 1× `Cannot read properties of undefined (reading 'tagName')`
- 3× `Maximum nested tags exceeded`

**Causa raíz:** las 4 fuentes EPG Share (DSports, ES, AR, MX) sirven archivos `.xml.gz` con content-type `application/octet-stream`. El parser `fast-xml-parser` recibía los bytes comprimidos crudos y los interpretaba como XML malformado, reventando.

**Solución:** detectar GZIP por magic bytes (0x1F 0x8B) en el response body y descomprimir con `zlib.gunzipSync` nativo antes de pasar al parser. Sin dependencias nuevas. Commit `bf669c8`.

**Resultados:**
- EPG Share DSports: 0 → 4 canales (1.5 KB → 14 KB)
- EPG Share ES: 0 → 305 canales (1.9 MB → 16.2 MB)
- EPG Share AR: 0 → 82 canales (228 KB → 2.8 MB)
- EPG Share MX: 0 → 171 canales (399 KB → 5.3 MB)

### Auditoría de calidad EPG (analítica)

Script que cuenta `<programme>`, `<desc>`, `<category>`, `<icon>`, `<episode-num>` por fuente XMLTV en cache. Permitió identificar las fuentes verdaderamente útiles vs las que solo aportan títulos sin descripción.

**Hallazgo crítico:** las 2 fuentes con más matches en el catálogo (GlobeTV México 2 y Open EPG Mx) tenían **0% de descripciones**. Estaban "ganando" la asignación a 33 canales con priority=50 igualada a las fuentes ricas. Por eso los clientes IPTV veían guías "vacías" en muchos canales.

### Limpieza estratégica ejecutada

**A) Re-priorización (SQL directo, sin commit de código):**

| Priority | Fuentes |
|---|---|
| 10 (autoritativas) | PlutoTV Global, PlutoTV México, IPTV EPG, EPG Share ES |
| 30 (complementarias) | Samsung TV Plus, GlobeTV México 1, EPG Share AR, EPG Share MX |
| 50 (default) | GlobeTV España 1 |
| 80 (pobres, ahora eliminadas) | GlobeTV México 2, Open EPG Mx, OPEN EPG Esp×5, Free EPG Lite, Free EPG Ru, EPG Share DSports |

**B) Limpieza de `epg_id` en los 94 canales + bulk auto-match:**

- 80 de 94 canales matcheados (85%)
- Distribución de matches: GlobeTV México 1 (30), Open EPG Mx (21), GlobeTV México 2 (20), PlutoTV Global (17), PlutoTV México (7), IPTV EPG (7), otros

**C) Eliminación de 10 fuentes basura (SQL directo):**
- Borradas: ids 12, 29, 30, 31, 32, 33, 34, 36, 39, 42
- Liberadas 59 MB de cache (171 MB → 112 MB)
- Quedaron 9 fuentes activas

**D) Refresh completo final:**
- EPG index: 6,568 entradas (consolidado tras priorización)
- 9 fuentes todas `ok`
- 80 canales con epg_id, 14 sin matchear (los más exóticos)
- **24 canales quedaron con `epg_id` huérfano** (sus IDs venían de fuentes ahora eliminadas) — Gustavo los re-asignará manualmente desde admin

### Estado del servidor al cierre

- **Servicio:** `jaibotv` online en PM2, restart count: 2 (esperado tras los cambios)
- **Memoria:** ~129 MB (OK, dentro de límite 800M)
- **Canales activos:** 94
- **Streams:** 80 ok / 14 error (estable desde el viernes)
- **Fuentes EPG:** 9 activas (vs 19 al inicio)
- **EPG IDs indexados:** 6,568
- **Cache EPG en disco:** 112 MB (vs 171 MB al inicio)
- **IP pública:** 189.175.131.95 (sin cambios desde 2026-05-04)
- **Crones:** todos activos

### Commits del día
bf669c8  fix(epg): detectar y descomprimir fuentes XMLTV en GZIP

(La limpieza EPG fue SQL directo, no commits de código.)

### Pendiente — siguiente sesión

1. **Manual:** reasignar EPG ID a los 24 canales con id huérfano (lista en backup `iptv_pre-epg-cleanup_20260511_152253.db`):
   A&E, A&E Discovery, ADN 40, Canal del Congreso, DAZN 1, DAZN F1, DSports, ESPN 4, ESPN 4 MX, ESPN 4 US, ESPN Premium, Fox Sports Premium, H&H Discovery, Movistar Deportes, Movistar Liga, Movistar+ Liga de Campeones, Nat Geo, TNT Novelas, TNT Series, Unicable, Universal Channel, Universal Cinema, Universal Premiere, Win Sports plus

2. **Bug #13 (duplicados tvpori):** decidir si fix puntual en `tvporiScraper.js:136` o esperar al Validador de importaciones. Lleva 6 pares dormidos desde el 7 de mayo, sin crecer.

3. **Bug #14 (jromero88):** seguirá indeterminado hasta que corra el cron M3U semanal (próximo trigger: 14 mayo).

4. **Probar acceso desde cliente IPTV** (Smarters/TiviMate) ahora que el EPG quedó limpio y prioritizado.

### Backups creados en esta sesión
~/backups/db/iptv_pre-epg-cleanup_20260511_152253.db  ← estado pre-limpieza
~/backups/db/iptv_pre-epg-cleanup_20260511_152445.db  ← duplicado (segundo cp)
~/backups/epgEngine.js.pre-gzip-fix-*                 ← código pre-patch GZIP
### Último commit antes de esta sesión
---


## Sesión 2026-05-08 (viernes) — parte 2

### Tipo de sesión
Análisis comparativo de repositorio externo + decisión de roadmap.

### Qué se hizo

1. Análisis del repo `jobustamantedev/localTv` (Python FastAPI + React 19 + Vite, con módulo de eventos deportivos integrado vía pltvhd.com)
2. Comparativa por capa contra JaiboTV: backend, DB, EPG, scrapers, frontend, sistema de diseño, madurez operacional
3. Conclusión: localTv es técnicamente inferior a JaiboTV en la mayoría de capas, pero tiene UNA idea valiosa que JaiboTV no tiene: módulo de eventos del día agrupados por competición con badges clicables que llevan al canal correspondiente
4. Decisión: dejar el módulo de eventos como ítem en roadmap (backlog en investigación), sin comprometer fase. Investigar fuentes disponibles antes de evaluar viabilidad. Mantener prioridad actual (estabilidad + cliente IPTV + mudanza fin de semana 9-10 mayo)
5. Creada sección nueva `🔵 Backlog en investigación` en `docs/roadmap.md` para alojar este tipo de ítems no comprometidos a fase

### Archivos modificados

- `docs/roadmap.md` — agregada sección "🔵 Backlog en investigación" con módulo de eventos deportivos del día, ubicada entre Fase 9 (IA) y "Estado de canales"
- `docs/handoff.md` — esta entrada

### Archivos NO modificados

- Código fuente en `src/` — sin tocar
- `data/iptv.db` — sin tocar
- Otros `docs/*.md` — sin cambios

### Decisiones tomadas

| Decisión | Razón |
|---|---|
| No implementar módulo de eventos ahora | Prioridad actual es estabilidad + prueba cliente IPTV + mudanza fin de semana. Eventos requiere investigación previa de fuentes. |
| Investigar `pltvhd.com` y alternativas antes de diseñar | localTv usa pltvhd pero no se conoce su estabilidad, términos ni cobertura de ligas latinas. No comprometer arquitectura sin saber qué fuente sostiene el dato. |
| No copiar otros patrones de localTv | Su seed hardcoded, API REST propia (sin Xtream) y auth en frontend son anti-patrones. JaiboTV ya está mejor en esos puntos. |
| Confirmación: dirección React+Vite del roadmap es correcta | localTv valida la elección — es exactamente la arquitectura que JaiboTV planea para el frontend separado |
| Crear sección "Backlog en investigación" en roadmap | No existía sección equivalente. Las fases 5-9 están comprometidas secuencialmente; este tipo de ideas no encajaban ahí. |

### Bugs descubiertos / cerrados

Ninguno en esta sesión.

### Siguiente paso recomendado

1. Continuar plan original (definido en parte 1 de hoy): mudanza fin de semana 9-10 mayo, prueba IPTVx en red doméstica
2. Lunes 12 mayo: regresar servidor, validar estado
3. Post-15 mayo: investigar fuentes de eventos deportivos (pltvhd, TheSportsDB, alternativas) y decidir si el módulo entra a alguna fase formal

---

## Sesión 2026-05-08 (viernes) — parte 1

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


---

## Sesión 2026-05-16/17/18 — Mudanza oficina→casa + Cloudflare Tunnel + SSH remoto

### Resumen

Mudanza física del servidor JaiboTV de oficina (Telmex, 192.168.1.250) a casa (Totalplay FO, 192.168.100.250). Migración completa de DNS de GoDaddy a Cloudflare. Tunnel `jaibotv-home` configurado con 2 Public Hostnames (HTTP para tv, SSH protegido por Access para administración remota). Refresh masivo de tokens tvpori con nueva IP pública. Acceso remoto SSH funcional vía `ssh jaibotv` desde PC oficina.

### Cambios aplicados

**Red y servidor:**
- IP local cambió a 192.168.100.250 (DHCP reservation en Huawei HG8145V5 + perfil NetworkManager mantenido en DHCP)
- IP pública: 189.175.131.95 (Telmex) → 187.189.68.84 (Totalplay)
- WiFi: Totalplay-833-5G (banda 5GHz)
- `ecosystem.config.cjs` actualizado con `SERVER_IP: '192.168.100.250'` en env block. Aplicado con `pm2 delete + pm2 start ecosystem.config.cjs` (no se puede aplicar con simple `pm2 restart`).

**Cloudflare:**
- Cuenta creada con 2FA
- Sitio `myalpha.fit` migrado de GoDaddy: 13 DNS records preservados (A, CNAME, MX iCloud, DKIM, TXT SPF/Apple/Replit)
- Nameservers: rosemary.ns.cloudflare.com / santino.ns.cloudflare.com
- Tunnel `jaibotv-home` UUID `9351f2cf-6c04-47b6-a6ea-5de1872afba2`, cloudflared 2026.5.0 corriendo como systemd service (4 conexiones HA: mci03 ×2 + dfw09 + dfw11)
- 2 Public Hostnames: `tv.myalpha.fit → http://localhost:3000` y `ssh.myalpha.fit → ssh://localhost:22`
- Cloudflare Access: application `JaiboTV SSH` con policy "Allow Gustavo" (email-OTP, sesión 24h). Requerida para SSH porque plan Free NO permite TCP tunnel raw sin Access.

**Cliente SSH (PC oficina):**
- cloudflared 2026.5.0 instalado en `C:\cloudflared\cloudflared.exe`, agregado al PATH
- `~/.ssh/config` configurado con alias `jaibotv` y ProxyCommand `cloudflared access ssh --hostname %h`
- Login Access: `cloudflared access login ssh.myalpha.fit` (OTP por email, token guardado en `.cloudflared/`)

**Datos:**
- Refresh masivo tvpori: 315/315 canales con tokens nuevos (IP embedida: 187.189.68.84). Comando: `curl -X POST http://localhost:3000/admin/tvpori/scrape`
- DB integridad confirmada: 473 activos, 315 con external_id

### Hallazgos críticos

1. **JaiboTV NO hace proxy de streams** — el M3U devuelve URLs directas al origen. Contradice `docs/AI_CONTEXT.md` decisión #2. Documentado en `docs/bugs.md` (sección "Hallazgo 2026-05-16") y `docs/roadmap.md` (Backlog técnico decisión arquitectónica).

2. **Streams tvpori IP-locked** — los tokens incluyen la IP pública del servidor codificada en base64 (`MTg3LjE4OS42OC44NA==`). Servidor de origen valida que la IP del cliente final coincida → streams tvpori SOLO funcionan desde redes con la misma IP pública del servidor (WiFi de casa). Desde 4G u otras redes fallan con "There is a problem with streaming". Canales abiertos (no tvpori) funcionan desde cualquier red.

3. **Cloudflare Tunnel TCP raw rechazado en Free plan** — modo `cloudflared access tcp --hostname` sin Access da `websocket: bad handshake`. Solución: configurar Access (gratis hasta 50 usuarios). Modo `cloudflared access ssh` requiere Access también; sin Access, `cloudflared access login` reporta "failed to find Access application".

4. **DNS hijacking en red oficina (Telmex)** — el router 192.168.1.254 reescribía todas las respuestas DNS a IPs 6.6.6.x localmente. No afecta a Cloudflare propagación (confirmado con whatsmydns.net global). En casa (Totalplay) no presenta este comportamiento.

### Estado al cierre

- ✅ `https://tv.myalpha.fit/admin/` accesible desde cualquier red (WiFi, 4G, oficina)
- ✅ IPTVX vía Xtream Codes (`https://tv.myalpha.fit`, admin/admin123) funcional desde WiFi casa con streams completos
- ✅ IPTVX desde 4G/otras redes: canales abiertos funcionan, tvpori NO (IP lock documentado)
- ✅ `ssh jaibotv` desde PC oficina autoritado por Access (sesión 24h)
- ✅ PM2: jaibotv online, ~25 MB steady; temp-monitor online
- ✅ cloudflared service uptime estable

### Siguiente sesión

Roadmap inmediato:
1. **Bloque B-m3u** (aggregator extension con external_id) — pospuesto desde 2026-05-15
2. **Fix IPMonitor**: agregar disparo de `scrapeAllTvporiChannels()` cuando cambia IP pública (hoy solo dispara tvtv, dejaría tokens stale al cambiar red)
3. **Hardening SSH** (opcional, fase post-mudanza estable): SSH key auth + `PasswordAuthentication no`

Backlog arquitectónico:
- Decisión proxy HLS real vs documentar status quo (documentado en bugs.md + roadmap.md)

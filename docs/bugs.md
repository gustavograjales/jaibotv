# Bugs

## Update 2026-05-15

### Bug #13 — neutralizado en flujo de refresh tvpori
El refactor de `scrapeAllTvporiChannels()` (cron 3.5h) ahora itera la DB y hace UPDATE por `id`. Esto **NO puede crear duplicados**. El bug sigue activo en:
- `scrapeTvporiByName()` (admin web "scrape one by name")
- Bulk-import desde `/admin/tvpori/import-all-pending`

Fix definitivo (matching por `tvpori_host + tvpori_stream_id`) sigue pendiente para esos dos caminos.

### Bug #13-equivalente en tvtvScraper — resuelto en código
El scraper de tvtv también hacía match por `LOWER(name)=LOWER(?)`. Patch de 2026-05-15 cambió a match prioritario por external_id. **Cuando regresen canales tvtv (via import-csv), entrarán con external_id desde día 1.**

 activos y lecciones aprendidas

> Bugs numerados secuencialmente desde el inicio del proyecto.
> Los resueltos quedan tachados con fecha de resolución.
> Lecciones críticas al final del archivo.

---

### Bug #15 — Fuentes XMLTV en GZIP no se descomprimían (RESUELTO 2026-05-11)

**Síntoma:** las 4 fuentes EPG Share (DSports, ES, AR, MX) reportaban `0 canales` con status `ok` y generaban 4 errores diarios en el cron EPG de las 4 AM:
- `Cannot read properties of undefined (reading 'tagName')` (1×)
- `Maximum nested tags exceeded` (3×)

**Causa raíz:** epgshare01.online sirve archivos `.xml.gz` con content-type `application/octet-stream`. El código asumía que `response.body` era texto XML directo y se lo pasaba al parser, que recibía bytes comprimidos crudos.

**Resolución (commit `bf669c8`):** detección por magic bytes (0x1F 0x8B) + `zlib.gunzipSync` nativo de Node. Sin dependencias nuevas.

**Resultado:** las 4 fuentes pasaron de 0 canales a 4, 305, 82 y 171 respectivamente. Total: +562 entradas EPG nuevas. Los 4 errores diarios desaparecieron.

---


## Bugs activos

### Bug #1 — IP pública (prioridad media, mitigado)

**Síntoma:** cuando la IP pública del servidor cambia (reset del módem, fallo del ISP, mantenimiento de Telmex), los tokens scrapeados de `tvtvhd.com` quedan invalidados al instante porque el servidor de `fubohd.com` los valida contra la IP de origen del request, no contra el `expires` del token.

**Detectado:** 2026-05-04 después de un reset del módem que cambió la IP pública de `187.189.163.84` a `189.175.131.95`. Resultado: 12 de 13 canales premium quedaron rotos hasta correr `POST /admin/tvtv/scrape` manualmente.

**Mitigación actual (2026-05-05):** monitor automático cada 10 min en `src/core/ipMonitor.js`. Detecta cambio de IP pública usando cadena de fallback (api.ipify.org → ifconfig.me → icanhazip.com), guarda historial en tabla `system_state`, y dispara `scrapeAllTvtvChannels()` automáticamente + invalida cache M3U. Status en `GET /admin/system/ip-status`.

**Sigue siendo prioridad media porque:** hay ventana de hasta 10 min entre el cambio de IP y la detección.

**Solución definitiva:** migrar a VPS (ver Fase 6 en `roadmap.md`), los VPS tienen IP estática.

---

### Bug #5 — M3U entrega URLs directas, no proxy (resuelto parcialmente)

El M3U **ahora sí** devuelve URLs proxy del tipo `http://192.168.1.250:3000/live/admin/admin123/{stream_id}.ts` (implementado en `xtream.js`). El redirect 302 entrega el token fresco en cada request del cliente.

**Pendiente:** validar que TODOS los formatos del M3U usen el proxy (algunos clientes pueden estar pidiendo `url_hd` directo si la lógica de selección lo prioriza).

---

### Bug #6 — Stream checker falsos positivos en algunos servidores

Los servidores `fubohd.com` aceptaban GET pero el HEAD a veces da 403 con el mismo token.

**Estado actual:** mitigado parcialmente con cambio de UA a Chrome 124 + delay 300ms entre canales en `streamChecker.js`. Stream OK pasó de 15 a 80 (+65 canales) tras el fix del 2026-05-06.

**Pendiente:** considerar usar GET con `Range: bytes=0-0` en vez de HEAD para algunos servidores específicos.

---

### Bug #7 — Auth de Git por contraseña (sin resolver)

Cada `git push` pide usuario y PAT (Personal Access Token).

**Solución pendiente:** migrar a SSH (`ssh-keygen -t ed25519` + agregar a GitHub) o configurar credential helper.

---

### Bug #10 — Refresh EPG secuencial sin aislamiento de errores

`refreshAllEpgSources()` en `src/core/epgEngine.js` usa `for...await` secuencial. Si una fuente falla con error no capturable (OOM, timeout largo), las siguientes se skipean sin log claro.

**Pendiente:** migrar a `Promise.allSettled` con concurrencia limitada (p. ej. 3 simultáneas).

---

### Bug #12 — Pendientes post-auditoría 2026-05-06

**a) 5 canales sin re-scrape (tokens IP vieja):**

DirecTV Sports+, Sky Sports LaLiga, A&E, Universal, Disney Channel. Sus columnas `scraped_at` y `tvpori_scraped_at` están vacías → no están en `TVPORI_CHANNELS` o sus scrapes fallan silenciosamente. Investigar lista en `tvporiScraper.js` y `stream_id` de Disney Channel (devuelve 404 consistente).

**b) ~9 canales con rate-limit residual de tvpori:**

A pesar del delay de 300ms entre canales en `checkAllStreams`, algunos canales sensibles dan 403 intermitente. Considerar backoff exponencial o `concurrency=1` con delay variable.

**c) Bug del entity expansion mitigado pero el parser sigue siendo síncrono:**

`processEntities: false` resuelve el límite, pero parsear un XML de 56MB sigue siendo bloqueante para el event loop. Migrar a streaming parser (`sax` o `saxes`) sigue siendo válido para producción seria, no urgente.

---

### Bug #13 — Scraper tvpori hace INSERT en lugar de UPDATE (NUEVO 2026-05-07)

**Síntoma:** el cron de tvpori (cada 3.5h) crea registros nuevos en `channels` cuando debería actualizar el existente. Detectado el 2026-05-07 a las 12:30 cuando el scrape creó 7 IDs nuevos (2403-2411) duplicando canales que ya existían.

**Causa raíz (línea 136 de `src/core/tvporiScraper.js`):**

```js
const dbCh = db.prepare(`SELECT id FROM channels WHERE LOWER(name)=LOWER(?)`).get(ch.db_name)
```

El matching busca por **nombre exacto** (case-insensitive). Cuando el catálogo `TVPORI_CHANNELS` tiene `"Azteca Deportes"` pero la DB tiene `"Azteca Deportes Network 3"` (importado de un M3U previo), el SELECT no encuentra match → cae en INSERT (línea 143).

**Casos confirmados (todos con mismo `tvpori_host` + `tvpori_stream_id`, distinto nombre):**

| host / stream_id | viejo en DB | nuevo del scraper |
|---|---|---|
| deportes / 24 | ESPN 5 AR | ESPN 5 |
| deportes / 29 | Movistar+ Liga de Campeones | Movistar Liga |
| deportes / 33 | ESPN 4 US | ESPN 4 MX |
| deportes / 34 | Azteca Deportes Network 3 | Azteca Deportes |
| deportes / 4 | TNT Sports Premium | TNT Sports |
| regionales / 51 | Estrella TV | Universal Cinema (¡ambiguo!) |
| regionales / 72 | Sony Channel | Canal Sony |

**Fix correcto:** matchear por `(tvpori_host, tvpori_stream_id)` que es la clave física real del stream, no por nombre. Algo como:

```js
const dbCh = db.prepare(`
  SELECT id FROM channels 
  WHERE tvpori_host=? AND tvpori_stream_id=?
`).get(ch.scrape_host, ch.stream_id)
  ?? db.prepare(`SELECT id FROM channels WHERE LOWER(name)=LOWER(?)`).get(ch.db_name)
```

(Primero busca por signature física, fallback a nombre para canales que aún no tienen `tvpori_host` asignado.)

**Estado:** pospuesto hasta tener validador de importaciones (ver Roadmap → Inmediato). Mientras tanto, los duplicados se manejarán manualmente.

---

### Bug #14 — Cron M3U procesa fuentes con `enabled=0` (NUEVO 2026-05-07)

**Síntoma:** la fuente M3U `id=1` (jromero88) está marcada `enabled=0` en la tabla `m3u_sources` pero su `last_fetched` es del 2026-05-07 09:00, lo que indica que el cron la procesó.

**Verificación:**

```sql
SELECT id, name, enabled, status, last_fetched FROM m3u_sources;
-- 1 | IPTV México jromero88 | 0 | ok | 2026-05-07 09:00:01
-- 4 | iptv-org México       | 1 | ok | 2026-05-07 09:00:02
```

**Causa probable:** el cron en `src/core/scheduler.js` que dispara el refresh de M3U no filtra por `enabled=1` antes de iterar las fuentes.

**Pendiente:** auditar `src/core/aggregator.js` y `src/core/scheduler.js` para confirmar la causa exacta y agregar el filtro.

---

### Bug #15 — Loop excesivo de retries TLS en tvpori (NUEVO 2026-05-07)

**Síntoma:** durante el scrape de tvpori (cada 3.5h), `regionales.saohgdasregions.fun` produce 60+ líneas seguidas de:

```
⚠️ [tvpori] Cert TLS problemático en regionales.saohgdasregions.fun (CERT_HAS_EXPIRED), 
   reintentando con agent permisivo
```

**Impacto:** funcional (el scrape termina con `69/69 actualizados, 0 fallidos`), pero contamina logs y agrega latencia (~2 min por scrape solo en reintentos).

**Causa:** el código en `src/core/tvporiScraper.js` reintenta cada canal individualmente cuando el cert falla, en lugar de detectar el host una vez y aplicar el `insecureAgent` directamente.

**Fix propuesto:** mantener cache en memoria del proceso de hosts conocidos con cert problemático. Primera vez: reintenta con agent permisivo. Siguientes corridas en la misma sesión PM2: usa el agent permisivo directo sin esperar al error.

---

### Bug #16 — Fastify deprecation warning (no urgente)

**Síntoma en logs:**

```
[FSTDEP021] DeprecationWarning: The `reply.redirect()` method has a new signature: 
`reply.redirect(url: string, code?: number)`. It will be enforced in `fastify@v5`
```

**Impacto:** ninguno hoy. Cuando se actualice a Fastify v5 se romperá.

**Fix:** revisar todos los `reply.redirect(code, url)` en el código y cambiarlos a `reply.redirect(url, code)`.

---

## Bugs resueltos

### ~~Bug #2 — Tabla `stream_sources` con bug de FK + status incorrecto~~ ✅ RESUELTO 2026-05-04

**Problema histórico:** la tabla `stream_sources` (sistema de failover de URLs) tenía 2,041 registros, de los cuales 2,015 (98%) eran huérfanos por borrados manuales en el admin panel sin foreign keys activas. Adicionalmente, `xtream.js` priorizaba `stream_sources` sobre `url_hd` aunque el `status` fuera `unknown`, entregando URLs con tokens caducos a clientes IPTV.

**Resolución:** Vaciar tabla `stream_sources` (commit `0421f33`). Eliminar fuente EPG rota `Free EPG`. Fix en `xtream.js`: query cambia de `status != 'error'` a `status = 'ok'` para no usar URLs no verificadas.

**Pendiente:** decidir si reconstruir el feature de failover o eliminarlo del schema.

### ~~Bug #3 — Endpoint `/get.php` lento (~8 segundos)~~ ✅ RESUELTO 2026-05-05

Implementado cache en memoria (`src/core/m3uCache.js`) con TTL=60s e invalidación explícita en eventos. Key compuesta `{catId}:{qualities}:{epgUrl}`. Stats en `GET /admin/m3u-cache/stats`. Invalidación manual en `POST /admin/m3u-cache/invalidate`.

### ~~Bug #4 — Heap del proceso al 92-94%~~ ✅ RESUELTO 2026-05-05

Heap subido a 512MB vía `NODE_OPTIONS=--max-old-space-size=512` en `ecosystem.config.cjs`. PM2 corre con `max_memory_restart: '800M'` (subido de 600M tras observar picos de ~750MB durante parseos de XMLTV grandes).

### ~~Bug #8 — Sin backup automatizado de la DB~~ ✅ RESUELTO (descubierto que ya existía)

`data/iptv.db` está en `.gitignore`. Backup automático SÍ existe en `~/backups/db/` corriendo desde algún punto antes del 2026-05-04 (los archivos más antiguos son del 4 de mayo). CLAUDE.md erróneamente lo listaba como deuda técnica activa. Corregido en `roadmap.md` y este archivo.

**Backups confirmados disponibles:**

```
~/backups/db/iptv_20260504.db
~/backups/db/iptv_20260505.db
~/backups/db/iptv_20260506.db
~/backups/db/iptv_20260507.db   ← cron 04:00 diario
```

### ~~Bug #9 — OOM con XMLTVs grandes~~ ✅ RESUELTO 2026-05-06

`fast-xml-parser` materializa todo el árbol XML en memoria. Detectado con `Free EPG Ru` (89 MB, 3,823 canales) → fuente desactivada. Fix: `processEntities: false` en `XMLParser` v4.5.6 deshabilita el límite hardcoded de 1000 entity expansions. Los strings quedan con `&amp;` literal pero se renderizan correctamente.

**Mitigación adicional:** subir heap a 512MB y `max_memory_restart: 800M`.

### ~~Bug #11 — Regex de XMLTV sensible al orden de atributos~~ ✅ RESUELTO 2026-05-05

El parser de `<programme>` en `generateConsolidatedEPG()` asumía que `channel` y `start` venían en orden fijo. PlutoTV/Samsung publican `<programme channel="..." start="...">`, pero OPEN EPG España publica `<programme start="..." stop="..." channel="...">`. Solo capturaba ~7 canales de 71. Regex ahora extrae atributos por separado tras matchear el bloque entero.

### ~~Bug TLS global eliminado~~ ✅ RESUELTO 2026-05-06 (commit `3919c52`)

Reemplazo de `NODE_TLS_REJECT_UNAUTHORIZED` global por fallback con undici dispatcher solo para requests específicos con cert problemático.

---

## Lecciones aprendidas

### 1. tvporinternet2.com bloquea UAs con "curl" o "VLC"

Usar UA Chrome real (`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ... Chrome/124.0`) para el stream checker. Esta sola decisión recuperó 65 canales de 79 marcados como error (2026-05-06).

### 2. `NODE_TLS_REJECT_UNAUTHORIZED='0'` es global al proceso Node

NUNCA usarlo. Mientras el scraper lo tenga deshabilitado, TODAS las demás conexiones HTTPS del proceso (otros scrapers, EPG, logos, requests del cliente IPTV) viajan sin validación de cert. Si el proceso crashea entre `=0` y `=1`, queda inseguro permanentemente.

**Solución correcta:** `dispatcher` de undici con `Agent({ connect: { rejectUnauthorized: false } })` SOLO para esa request específica.

### 3. fast-xml-parser v4 tiene límite hardcoded de 1000 entity expansions

`processEntities: false` lo desactiva sin riesgo real. Los strings resultantes contienen `&amp;` literal pero se renderizan correctamente como `&` en HTML del admin y se almacenan así en SQLite sin doble escape al re-serializar.

### 4. El servidor de tvpori bloquea con `Referer` del propio sitio

(`https://www.tvporinternet2.com/`) — anti-hotlinking inverso. El streamChecker NO debe enviar Referer.

### 5. `pm2 restart` NO recarga `NODE_OPTIONS` ni env vars

Para aplicar cambios en `ecosystem.config.cjs` hay que hacer `pm2 delete + pm2 start` o `pm2 restart --update-env`.

### 6. Patches con heredoc largo en SSH se corrompen ⚠️ CRÍTICO

La terminal hace line-wrap en strings largos al pegar, rompiendo el contenido. Para parches programáticos, **escribir el script a archivo en disco** (`cat > /tmp/script.py << 'EOF' ... EOF`) y luego ejecutar (`python3 /tmp/script.py`). NUNCA pegar bloques largos de Python/sed/SQL directamente en stdin de un comando.

**Demostrado de nuevo el 2026-05-07:** un script SQL pegado por heredoc se ejecutó parcialmente, corrompiendo 5 registros. La recuperación requirió restore desde backup.

### 7. Nunca asumir orden de atributos en XML

Diferentes generadores XMLTV emiten atributos en orden distinto. Parsear con regex que extraiga cada atributo por separado.

### 8. No asumir causa raíz sin verificar con un query verificador (lección 2026-05-07)

Errores documentados de la sesión del 7 de mayo:
- Asumir que el bug TLS seguía activo solo porque vi un warning antiguo en logs (estaba resuelto desde 2026-05-06)
- Asumir duplicación masiva del scraper sin validar (solo había 1 duplicado real más 7 INSERTs nuevos)
- Proponer scripts SQL grandes vía heredoc ignorando lección #6
- Asumir estado del backup sin verificar md5sum/conteo

**Regla:** antes de proponer cualquier acción, **pedir al usuario un query/comando verificador** y esperar el output. No actuar sobre suposiciones.

### 9. El backup automático SÍ existe (lección 2026-05-07)

CLAUDE.md original listaba como deuda técnica #8 "Sin backup automatizado de la DB". Verificación reveló que el backup automático corre diariamente a las 04:00 en `~/backups/db/iptv_YYYYMMDD.db`. Confirmar existencia de servicios antes de declararlos faltantes.


---

## BUG-16: Servidor tvpori bloquea requests desde Python/curl con HTTP 403

**Descubierto:** 2026-05-13 durante implementación del Discover UI.

**Síntoma:**
- Cliente IPTV (TiviMate) reproduce DAZN F1 correctamente vía proxy JaiboTV
- curl/Python directos al .m3u8 (incluso desde el mismo servidor JaiboTV) reciben HTTP 403
- VLC desde PC en LAN también recibe 403
- hls.js en browser SÍ funciona

**Diagnóstico:**
El servidor remoto `:9092` valida algo del cliente más allá de IP y URL/token. Probablemente:
- Fingerprint TLS específico (cliente IPTV vs curl)
- User-Agent dinámico
- Comportamiento HTTP/2 o Range requests específicos

**Implicación:**
- **No se puede validar masivamente** la lista de 929 stream_ids descubiertos desde server-side
- La validación solo es posible visualmente con preview hls.js (browser) o cliente IPTV real
- Los falsos positivos del descubrimiento solo se descubren al intentar consumir

**Workaround actual:**
- Preview hls.js en discover UI permite identificar canales válidos uno por uno
- No hay solución server-side automática

**Status:** WONT-FIX (limitación del servidor remoto, fuera de nuestro control)

---

## BUG-17: Algunos stream_ids reportan "vivos" pero el .m3u8 da 403

**Descubierto:** 2026-05-13 durante pruebas del Discover UI.

**Síntoma:**
- `discoverTvporiStreams()` reporta `ok: true` con URL extraída del HTML
- Al hacer fetch del .m3u8 con browser, devuelve 403
- No es problema de token expirado (URL fresca también falla)

**Causa probable:**
- El servidor tvpori responde con `var src=` en el HTML para CUALQUIER stream_id válido sintácticamente
- Pero el endpoint de streaming solo tiene contenido para ciertos stream_ids
- No hay forma desde el HTML inicial de saber cuál tiene contenido real

**Implicación:**
- Estimación de 929 "canales nuevos" probablemente tenga muchos falsos positivos
- Tasa real de validez solo se conocerá tras revisión manual con preview

**Workaround:**
- Skip rápido en discover UI cuando el preview falla
- Tabla `tvpori_skipped` evita re-mostrar canales descartados

**Status:** WORKAROUND (no hay solución server-side, manejo manual via UI)

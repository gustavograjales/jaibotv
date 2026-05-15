# Fuentes de contenido — JaiboTV

> Última verificación contra DB real: **2026-05-08 10:08**
> Estado: post-restore del 7-mayo + limpieza manual del 8-mayo

---

## Fuentes M3U

Hay **2 fuentes M3U** registradas en la tabla `m3u_sources`, ambas con `enabled=1`.

### iptv-org México (id=4) — HABILITADA ✅

- **URL:** `https://iptv-org.github.io/iptv/countries/mx.m3u`
- **Enabled:** 1
- **Último fetch:** 2026-04-30 21:53:12
- **Notas:** fuente comunitaria, puede traer canales geo-bloqueados, locales sin interés, o con nombres en inglés. El cron M3U corre semanalmente (`0 3 */7 * *`), no diariamente. Limpieza manual periódica necesaria hasta que exista el validador de importaciones.

### IPTV México jromero88 (id=1) — HABILITADA ✅

- **URL:** `https://raw.githubusercontent.com/jromero88/iptv/master/channels/mx.m3u`
- **Enabled:** 1
- **Último fetch:** 2026-04-29 23:30:10
- **Notas:** rehabilitada en algún momento entre 2026-05-07 y 2026-05-08 (estaba `enabled=0` en sesión anterior). Decisión documentada el lunes tras evaluar comportamiento del fin de semana.

---

## Scrapers de tokens dinámicos

### tvtvhd.com — FUNCIONANDO ✅

- **Scraper:** `src/core/tvtvScraper.js`
- **Canales en DB:** 12 (campo `stream_param`)
- **Cadencia:** cada 4 horas (node-cron)
- **Mecanismo:** visita página de cada canal en tvtvhd.com, extrae `var src = "..."` del HTML
- **Endpoint manual:** `POST /admin/tvtv/scrape`
- **Logs:** `✅ Scrape completado: 12/12 URLs actualizadas`

**Canales scrapeados (validado contra DB 2026-05-08):**

| ID | Canal | stream_param | Status |
|---|---|---|---|
| 2019 | DAZN 1 | `dazn1` | ok |
| 1993 | DSports | `dsports` | ok |
| 1990 | ESPN 5 AR | `espn5` | ok |
| 1991 | ESPN 6 | `espn6` | ok |
| 1992 | ESPN 7 | `espn7` | ok |
| 2003 | ESPN Premium | `espnpremium` | ok |
| 1998 | Fox Sports | `foxsports` | ok |
| 2008 | Liga 1 MAX | `liga1max` | ok |
| 2009 | Movistar Deportes | `movistar` | ⚠️ error |
| 2002 | TNT Sports Premium | `tntsports` | ok |
| 2004 | TyC Sports | `tycsports` | ok |
| 2011 | Win Sports plus | `winsports2` | ok |

**Caveat conocido (Bug #1):** los tokens están atados a la IP pública de salida. Si la IP cambia, todos los canales tvtv quedan rotos hasta el próximo scrape. Mitigado con `ipMonitor.js` (re-scrape automático al detectar cambio de IP). Ventana de riesgo: hasta 10 min.

---

### tvporinternet2.com — FUNCIONANDO ⚠️ con duplicados

- **Scraper:** `src/core/tvporiScraper.js`
- **Canales en DB:** 75 registros (33 deportes + 42 regionales). De esos, 6 son duplicados activos por Bug #13 → **69 canales únicos lógicos**.
- **Cadencia:** cada 3.5 horas
- **Endpoint manual:** `POST /admin/tvpori/scrape` (verificar firma exacta en `src/api/admin.js`)
- **Logs:** `✅ tvpori scrape: 69 actualizados, 0 fallidos de 69`

**Bug activo (Bug #13):** el scraper hace INSERT en lugar de UPDATE cuando el nombre del catálogo `TVPORI_CHANNELS` no coincide exactamente con el nombre en DB. Resultado: registros duplicados con el mismo `(tvpori_host, tvpori_stream_id)` pero distinto `name`. Fix pendiente: matchear por la clave física `(tvpori_host, tvpori_stream_id)` en vez de por nombre. Ver detalle en `docs/bugs.md`.

**Bug activo (Bug #15):** el cert TLS de `regionales.saohgdasregions.fun` está expirado. El código maneja el fallback con undici `insecureAgent`, pero genera 60+ líneas de warnings por scrape porque reintenta canal por canal en lugar de detectar el host una vez.

#### Mapa de canales tvporinternet2

**DEPORTES** (`deportes.ksdjugfsddeports.com`) — 33 registros:

| stream_id | Canal en DB |
|---|---|
| 1 | TUDN |
| 3 | DirecTV Sports |
| 4 | TNT Sports Premium / TNT Sports ⚠️ |
| 6 | TyC Sports |
| 8 | Fox Sports |
| 9 | FOX Sports 2 |
| 10 | FOX Sports 3 |
| 12 | Fox Sports Premium |
| 13 | ESPN |
| 14 | ESPN 2 |
| 15 | ESPN 3 |
| 16 | FOX Sports MX |
| 17 | FOX Sports 2 MX |
| 19 | ESPN MX |
| 22 | Liga 1 MAX |
| 23 | ESPN 4 |
| 24 | ESPN 5 AR / ESPN 5 ⚠️ |
| 25 | ESPN 6 |
| 26 | ESPN 7 |
| 27 | DAZN F1 |
| 28 | DAZN La Liga |
| 29 | Movistar+ Liga de Campeones / Movistar Liga ⚠️ |
| 30 | Win Sports plus |
| 31 | Bein Sports Xtra |
| 33 | ESPN 4 US / ESPN 4 MX ⚠️ |
| 34 | Azteca Deportes |
| 35 | TNT Sports Chile |
| 38 | ESPN 5 MX |
| 39 | Liga 1 |

> ⚠️ = registros duplicados (mismo `host`+`stream_id`, distinto `name`). Ver bloque de duplicados Bug #13 más abajo.

**REGIONALES** (`regionales.saohgdasregions.fun`) — 42 registros:

| stream_id | Canal en DB |
|---|---|
| 1 | Azteca 7 |
| 2 | Canal 5 |
| 5 | TNT Novelas |
| 9 | Univision |
| 12 | TLNovelas |
| 13 | Las Estrellas |
| 24 | Unicable |
| 25 | Imagen TV |
| 26 | Azteca Uno |
| 28 | Disney Channel |
| 31 | Cartoon Network |
| 32 | Tooncast |
| 37 | Discovery Channel |
| 41 | ID Investigation |
| 42 | H&H Discovery |
| 43 | A&E Discovery |
| 44 | History |
| 45 | History 2 |
| 46 | Animal Planet |
| 47 | Nat Geo |
| 49 | Universal Channel |
| 50 | Universal Premiere |
| 51 | Estrella TV / Universal Cinema ⚠️ |
| 52 | TNT |
| 53 | TNT Series |
| 54 | Star Channel |
| 55 | Cinemax |
| 56 | Space |
| 58 | Warner Channel |
| 59 | Cinecanal |
| 60 | FX |
| 61 | AXN |
| 63 | AMC |
| 64 | Studio Universal |
| 67 | Golden |
| 68 | Golden Plus |
| 69 | Golden Edge |
| 70 | Caras TV |
| 72 | Sony Channel / Canal Sony ⚠️ |
| 75 | Distrito Comedia |

#### ⚠️ Duplicados activos por Bug #13 (snapshot 2026-05-08 10:08)

| Host | stream_id | Nombre A | Nombre B | IDs en DB |
|---|---|---|---|---|
| deportes | 4 | TNT Sports Premium | TNT Sports | 2002, 2236 |
| deportes | 24 | ESPN 5 AR | ESPN 5 | 1990, 2237 |
| deportes | 29 | Movistar+ Liga de Campeones | Movistar Liga | 2186, 2245 |
| deportes | 33 | ESPN 4 US | ESPN 4 MX | 2188, 2239 |
| regionales | 51 | Estrella TV | Universal Cinema | 2215, 2242 |
| regionales | 72 | Sony Channel | Canal Sony | 2231, 2243 |

**Total: 6 pares de duplicados, 12 registros redundantes.** No se han limpiado por la lección crítica del 7-mayo (los heredocs SQL en SSH se corrompen). Se atacan cuando se construya el Validador de importaciones masivas.

---

## Fuentes EPG (XMLTV)

**19 fuentes** registradas en la tabla `epg_sources` (verificado 2026-05-08). De esas: **18 en `status=ok`** + **1 en `status=error`** (Free EPG Ru).

- **Prioridad:** columna `priority` en tabla `epg_sources`. Menor número = mayor prioridad. Usado para deduplicar cuando varias fuentes publican el mismo `epg_id`.
- **EPG IDs indexados:** 7,639 entradas en `epg_index` (verificado 2026-05-08).

### Lista completa de fuentes EPG

| ID | Nombre | Status | Priority | URL (preview) |
|---|---|---|---|---|
| 34 | OPEN EPG Esp2 | ok | 10 | open-epg.com/files/spain2.xml |
| 8 | PlutoTV México EPG | ok | 50 | matthuisman GitHub |
| 9 | PlutoTV Global EPG | ok | 50 | matthuisman GitHub |
| 10 | Samsung TV Plus EPG | ok | 50 | matthuisman GitHub |
| 11 | GlobeTV México 1 | ok | 50 | globetvapp GitHub |
| 12 | GlobeTV México 2 | ok | 50 | globetvapp GitHub |
| 13 | GlobeTV España 1 | ok | 50 | globetvapp GitHub |
| 27 | IPTV EPG | ok | 50 | iptv-epg.org/files/epg-mx.xml |
| 29 | Open EPG Mx | ok | 50 | open-epg.com/files/mexico2.xml |
| 30 | Open EPG Esp5 | ok | 50 | open-epg.com/files/spain5.xml |
| 31 | Open EPG Esp3 | ok | 50 | open-epg.com/files/spain3.xml |
| 32 | OPEN EPG Esp | ok | 50 | open-epg.com/files/spain1.xml |
| 33 | OPEN EPG Esp4 | ok | 50 | open-epg.com/files/spain4.xml |
| 36 | Free EPG Ru | ⚠️ error | 50 | epg.pw/xmltv/epg_RU.xml |
| 39 | Free EPG Lite | ok | 50 | epg.pw/xmltv/epg_lite.xml |
| 42 | EPG Share DSports | ok | 50 | epgshare01.online (DIRECTV) |
| 43 | EPG Share ES | ok | 50 | epgshare01.online (España) |
| 44 | EPG Share AR | ok | 50 | epgshare01.online (Argentina) |
| 45 | EPG Share MX | ok | 50 | epgshare01.online (México) |

### Notas sobre fuentes EPG

- **Free EPG Ru (id=36)** sigue en estado `error` con `last_error = "Proceso terminado por OOM (PM2 max_memory_restart 600M con XMLTV de 89MB)"`. La fuente es de 89 MB con 3,823 canales. No ha sido eliminada de la tabla, solo no se procesa por estar en error.
- **OPEN EPG Esp2 (id=34)** es la única con `priority=10`, prevalece sobre las otras de España cuando hay `epg_id` duplicado.
- Una pasada del cron diario de las 4 AM completa todas las fuentes activas en aproximadamente 1 minuto (verificado 2026-05-08 04:00).

### Bug pendiente — errores de parseo XMLTV

Algunos XMLTVs producen errores de parseo intermitentes en el cron diario:

```
Error parseando XMLTV: Maximum nested tags exceeded
Error parseando XMLTV: Pi Tag is not closed.
Error parseando XMLTV: Cannot read properties of undefined (reading 'tagName')
```

Estos errores ocurren en 1+ fuentes específicas (pendiente identificar cuál). Las demás fuentes sí parsean correctamente. El cron continúa con las fuentes que sí funcionan.

---

## Logos

- **Fuente:** GitHub `tv-logo/tv-logos`
- **Índice local:** `data/logo-index.json` — **3,848 entradas** (verificado 2026-05-08)
- **Engine:** `src/core/logoEngine.js`
- **Auto-match:** compara nombre del canal con el índice, devuelve URL del logo con score de confianza
- **Admin UI:** logo picker con búsqueda por nombre + preview

---

## Resumen del estado al 2026-05-08

| Recurso | Cantidad | Notas |
|---|---|---|
| Fuentes M3U habilitadas | 2 | iptv-org + jromero88 (rehabilitada) |
| Canales tvtv (scraper) | 12 | 11 ok + 1 error (Movistar Deportes) |
| Canales tvpori (scraper) | 75 registros / 69 únicos | 6 pares duplicados por Bug #13 |
| Fuentes EPG totales | 19 | 18 ok + 1 error (Free EPG Ru) |
| EPG IDs indexados | 7,639 | en `epg_index` |
| Logos indexados | 3,848 | en `logo-index.json` |


## Update 2026-05-15

### tvtv — discover potencial (investigación pendiente)
URL pattern: `https://tvtvhd.com/vivo/canales.php?stream={stream_param}`. El `stream_param` es string opaco. Viabilidad de barrido (1..n estilo tvpori) depende de si es numérico secuencial o slug. **Confirmar al re-importar CSV en sesión futura.**

### Docker container huérfano: epg-iptv-org
Contenedor `ghcr.io/iptv-org/epg:master` corriendo en puerto 5000 desde hace 8 días. **NO está consumido por ningún registro en `epg_sources`.** Evaluar post-mudanza si se apaga o se cablea como fuente EPG adicional.


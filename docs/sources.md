# Fuentes de contenido — JaiboTV

---

## Fuentes M3U

### iptv-org México (id=4) — ACTIVA ✅

- **URL:** `https://iptv-org.github.io/iptv/countries/mx.m3u`
- **Enabled:** 1
- **Canales:** 142 reportados al importar
- **Último fetch:** 2026-05-07 09:00:02
- **Notas:** fuente comunitaria, puede traer canales geo-bloqueados, locales sin interés, o con nombres en inglés. El cron de las 3 AM (semanal) los importa sin validación previa. Limpieza manual periódica necesaria hasta que exista el validador.

### IPTV México jromero88 (id=1) — DESHABILITADA ⚠️

- **URL:** `https://raw.githubusercontent.com/jromero88/iptv/master/channels/mx.m3u`
- **Enabled:** 0 (deshabilitada en DB)
- **Canales:** 21 reportados
- **Último fetch:** 2026-05-07 09:00:01
- **Bug activo:** el cron procesa esta fuente aunque `enabled=0` (Bug #14). Los canales de esta fuente tienen `source_id=1` y en la última revisión tenían status `error`.
- **Decisión pendiente:** reactivar o confirmar que está muerta definitivamente.

---

## Scrapers de tokens dinámicos

### tvtvhd.com — FUNCIONANDO ✅

- **Scraper:** `src/core/tvtvScraper.js`
- **Canales:** 12 canales premium
- **Cadencia:** cada 4 horas (node-cron)
- **Mecanismo:** visita página de cada canal en tvtvhd.com, extrae `var src = "..."` del HTML
- **Endpoint manual:** `POST /admin/tvtv/scrape`
- **Logs:** `✅ Scrape completado: 12/12 URLs actualizadas`

**Canales scrapeados:**

| Canal | stream_id |
|---|---|
| DAZN 1 | — |
| DSports | — |
| ESPN 5 | — |
| ESPN 6 | — |
| ESPN 7 | — |
| ESPN Premium | — |
| Fox Sports | — |
| Fox Sports 2 | — |
| TNT Sports | — |
| TyC Sports | — |
| Liga 1 MAX | — |
| Movistar Deportes | — |
| Win Sports Plus | — |

**Caveat conocido (Bug #1):** los tokens están atados a la IP pública de salida. Si la IP cambia, todos los canales tvtv quedan rotos hasta el próximo scrape. Mitigado con `ipMonitor.js` (re-scrape automático al detectar cambio de IP). Ventana de riesgo: hasta 10 min.

---

### tvporinternet2.com — FUNCIONANDO ✅

- **Scraper:** `src/core/tvporiScraper.js`
- **Canales:** 69 (29 deportes + 40 regionales)
- **Cadencia:** cada 3.5 horas
- **Endpoint manual:** verificar nombre en admin.js
- **Logs:** `✅ tvpori scrape: 69 actualizados, 0 fallidos de 69`

**Bug activo (Bug #13):** cuando el nombre en el catálogo (`TVPORI_CHANNELS` en el código) no coincide exactamente con el nombre en la DB, el scraper hace INSERT en lugar de UPDATE, creando duplicados. Fix pendiente: matchear por `(tvpori_host, tvpori_stream_id)`.

**Bug activo (Bug #15):** el cert TLS de `regionales.saohgdasregions.fun` está expirado. El código ya maneja el fallback con undici `insecureAgent`, pero genera 60+ líneas de warnings por scrape porque reintenta canal por canal en lugar de detectar el host una vez.

#### Mapa de canales tvporinternet2

**DEPORTES** (`deportes.ksdjugfsddeports.com`):

| stream_id | Canal |
|---|---|
| 1 | TUDN |
| 3 | DirecTV Sports |
| 4 | TNT Sports |
| 6 | TyC Sports |
| 8 | FOX Sports |
| 9 | FOX Sports 2 |
| 10 | FOX Sports 3 |
| 11 | DirecTV Sports+ |
| 12 | Fox Sports Premium |
| 13 | ESPN |
| 14 | ESPN 2 |
| 15 | ESPN 3 |
| 16 | FOX Sports MX |
| 17 | FOX Sports 2 MX |
| 19 | ESPN MX |
| 22 | Liga 1 Max |
| 23 | ESPN 4 |
| 24 | ESPN 5 |
| 25 | ESPN 6 |
| 26 | ESPN 7 |
| 27 | DAZN F1 |
| 28 | DAZN La Liga |
| 29 | Movistar Liga |
| 30 | WIN Sports Plus |
| 31 | Bein Sports Xtra |
| 33 | ESPN 4 MX |
| 34 | Azteca Deportes |
| 35 | TNT Sports Chile |
| 37 | Sky Sports LaLiga |
| 38 | ESPN 5 MX |
| 39 | Liga 1 |

**REGIONALES** (`regionales.saohgdasregions.fun`):

| stream_id | Canal |
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
| 37 | Discovery |
| 41 | ID Investigation |
| 42 | H&H Discovery |
| 43 | A&E |
| 44 | History |
| 45 | History 2 |
| 46 | Animal Planet |
| 47 | Nat Geo |
| 49 | Universal |
| 50 | Universal Premiere |
| 51 | ⚠️ AMBIGUO (Estrella TV? Universal Cinema?) |
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
| 72 | Canal Sony |
| 75 | Distrito Comedia |

**Pendientes sin stream_id confirmado:** DirecTV Sports+, ESPN4, Sky Sports LaLiga.

---

## Fuentes EPG (XMLTV)

25 fuentes activas. Todas con `status='ok'`.

- **Prioridad:** columna `priority` en tabla `epg_sources`. Menor número = mayor prioridad. Usado para deduplicar cuando varias fuentes publican el mismo `epg_id`.
- **Ejemplo de prioridad:** `OPEN EPG Esp2` (id=34, priority=10) tiene mayor prioridad que `OPEN EPG Esp` (id=32, priority=50).
- **Free EPG Ru desactivada** — producía OOM (89 MB, 3,823 canales). La fuente hacía crash del proceso al parsear.

**Bug activo:** algunos XMLTVs están produciendo errores de parseo en el cron de las 4 AM:

```
Error parseando XMLTV: Maximum nested tags exceeded
Error parseando XMLTV: Pi Tag is not closed.
Error parseando XMLTV: Cannot read properties of undefined (reading 'tagName')
```

Estos errores ocurren en 1+ fuentes específicas (pendiente identificar cuál). Las demás fuentes sí parsean correctamente. El cron continúa con las fuentes que sí funcionan.

---

## Logos

- **Fuente:** GitHub `tv-logo/tv-logos`
- **Índice local:** `data/logo-index.json` (3,848 entradas)
- **Engine:** `src/core/logoEngine.js`
- **Auto-match:** compara nombre del canal con el índice, devuelve URL del logo con score de confianza
- **Admin UI:** logo picker con búsqueda por nombre + preview

---

## Scrapers pendientes de implementar

### TV Azteca (MDSTRM) 🟡 No urgente

- **Target:** Azteca UNO, Azteca 7, Azteca Deportes y más
- **URL:** `https://envivo.tvazteca.com/`
- **Estado:** HAR analizado, `access_token` generado client-side en bundle JS (no expuesto en network). Reverse engineering pendiente.
- **No urgente:** canales activos vía tvporinternet2

### Sitio nuevo 🔴 Pendiente

Pendiente de compartir URL para análisis.

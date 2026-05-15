# Arquitectura

## Update 2026-05-15

### `scrapeAllTvporiChannels()` ahora itera la DB
Antes: iteraba `TVPORI_CHANNELS` (array hardcoded de 69 canales). Después: `SELECT FROM channels WHERE enabled=1 AND tvpori_host != ''` (315 canales activos). UPDATE por `id`. NO crea canales (esa responsabilidad es de import/discover, no de refresh).

### external_id como ancla del canal
El `external_id` es la columna ancla estable. Los scrapes refrescan URLs identificando el canal por su external_id (en bulk-import e import-csv) o por `id` de DB (en cron refresh). Nombres, categorías y metadatos son mutables sin afectar el ancla.

Formatos:
- `tvpori:{host_slug}:{stream_id}` ✅ implementado
- `tvtv:{stream_param}` ✅ implementado 2026-05-15
- `m3u:{source_id}:{tvg-id}` — pendiente patch aggregator.js (lunes 18-may)
- `m3u:{source_id}:url:{sha1_8}` — pendiente patch aggregator.js (lunes 18-may)

 — JaiboTV

## Visión general

JaiboTV tiene tres capas:

1. **Ingesta** — scrapers y parsers que traen streams de fuentes externas
2. **Datos** — SQLite con catálogo de canales, EPG, logos y estado
3. **Entrega** — API Xtream Codes + endpoints admin

```
Fuentes externas                   JaiboTV :3000                   Clientes
────────────────                   ─────────────                   ───────
tvtvhd.com          ──────────▶  tvtvScraper.js                    IPTV Smarters
tvporinternet2.com  ──────────▶  tvporiScraper.js  ──▶ xtream.js ──▶ IPTVx
iptv-org M3U        ──────────▶  aggregator.js     ──▶ M3U/XMLTV    TiviMate
jromero88 M3U       ──────────▶  aggregator.js
EPG (19 fuentes)    ──────────▶  epgEngine.js       ──▶ /xmltv.php
tv-logo/tv-logos    ──────────▶  logoEngine.js
```

---

## Estructura de archivos

```
/home/ggajales/iptv-server/
├── config.js                   # SERVER_IP centralizado
├── ecosystem.config.cjs        # PM2: heap 512MB, max_memory_restart 800M
├── package.json
├── tailwind.config.js          # Mapeado a CSS variables del design system
├── CLAUDE.md                   # Índice + reglas de comportamiento para IA
│
├── docs/                       # Documentación AI-ready (esta carpeta)
│
├── design/
│   ├── logo/                   # SVGs del logo (placeholders — pendiente diseño)
│   ├── mockups/                # Pendiente poblar
│   └── references/
│
├── data/                       # En .gitignore
│   ├── iptv.db                 # SQLite (~2.6 MB)
│   ├── epg-cache/              # XMLTVs descargados
│   ├── m3u-cache/
│   └── logo-index.json         # Cache de logos (3,848 entradas)
│
└── src/
    ├── server.js               # Entry point
    ├── admin-ui/
    │   └── index.html          # Panel admin — SPA monolítico HTML+JS vanilla
    ├── styles/
    │   ├── tokens.css          # CSS variables — fuente única del design system
    │   └── theme.ts            # Tokens consumibles desde TypeScript
    ├── api/
    │   ├── admin.js            # REST API del panel admin
    │   └── xtream.js           # API Xtream Codes
    ├── core/
    │   ├── aggregator.js       # M3U parser + importer
    │   ├── epgEngine.js        # EPG parser + Fuse.js búsqueda fuzzy
    │   ├── ipMonitor.js        # Monitor IP pública + auto re-scrape tvtv
    │   ├── logoEngine.js       # Logos desde GitHub tv-logo/tv-logos
    │   ├── m3uCache.js         # Cache en memoria M3U (TTL 60s)
    │   ├── scheduler.js        # Cron jobs
    │   ├── streamChecker.js    # Verifica status de streams
    │   ├── systemState.js      # Helpers tabla system_state (key-value)
    │   ├── tvporiScraper.js    # Scraper tvporinternet2.com
    │   └── tvtvScraper.js      # Scraper tvtvhd.com
    └── db/
        ├── schema.js           # Tablas + migraciones on-the-fly
        └── seed.js             # Datos iniciales (admin, categorías)
```

---

## Base de datos — tablas principales

### `channels` (tabla central)

| Columna | Descripción |
|---|---|
| `id` | PK autoincrement |
| `name` | Nombre del canal |
| `category_id` | FK → `categories` |
| `logo` | URL del logo |
| `epg_id` | ID para match con XMLTV |
| `url_hd` | URL del stream (principal) |
| `url_fhd` / `url_sd` | Calidades alternativas |
| `stream_id` | ID expuesto en API Xtream |
| `enabled` | 1=activo, 0=deshabilitado |
| `stream_status` | `ok` / `error` / `unknown` |
| `stream_checked_at` | Última verificación |
| `tvpori_host` | Host de tvporinternet2 |
| `tvpori_stream_id` | ID del stream en tvpori |
| `source_id` | FK → `m3u_sources` |

### `categories`

11 categorías confirmadas (CLAUDE.md original decía 10, falta Religioso id=124):
Noticias, Deportes, Entretenimiento, Películas, Series, Infantil, Documentales, Música, Internacionales, General, Religioso.

### `epg_sources`

19 fuentes XMLTV (18 ok + 1 error). Columna `priority` (menor = mayor prioridad) para resolver conflictos cuando varias fuentes publican el mismo `epg_id`.

### `m3u_sources`

Fuentes M3U. Columna relevante: `last_fetched` (NO `last_refresh` — CLAUDE.md original tenía el nombre incorrecto).

| id | nombre | enabled | status |
|---|---|---|---|
| 1 | IPTV México jromero88 | 1 | ok |
| 4 | iptv-org México | 1 | ok |

### `system_state`

Key-value store. Guarda IP pública actual e historial de cambios.

### `users`

Solo `admin` / `admin123`. **Pendiente cambiar antes de exposición pública.**

---

## Flujos principales

### Reproducción de un canal

```
Cliente → GET /live/admin/admin123/{stream_id}.ts
  → xtream.js busca channel por stream_id
  → redirect 302 → URL real del stream (CDN externo, token fresco)
```

### Entrega del M3U

```
Cliente → GET /get.php?username=admin&password=admin123&type=m3u
  → m3uCache.js: ¿cache válido (TTL 60s)?
      Sí → responde desde memoria (< 5ms)
      No → genera M3U desde DB, guarda en cache
           Las URLs son PROXY: /live/admin/admin123/{stream_id}.ts
           NO URLs directas con tokens congelados
```

### Renovación de tokens (cron)

```
Cada 4h  → tvtvScraper: 12 canales premium → UPDATE url_hd → invalidateM3UCache
Cada 3.5h → tvporiScraper: 69 canales → UPDATE url_hd (o INSERT si nombre no matchea — Bug #13)
```

### Procesamiento EPG

```
Diario 04:00 → epgEngine: descarga 19 XMLTVs → parsea → consolida con dedup por priority
             → indexa con Fuse.js (7,639 entradas)
Cliente → GET /xmltv.php → devuelve XMLTV consolidado (~1.2s)
```

---

## Crons activos (scheduler.js)

| Job | Cadencia | Función |
|---|---|---|
| tvtv scrape | cada 4h | Renueva tokens 12 canales premium |
| tvpori scrape | cada 3.5h | Renueva tokens 69 canales |
| Stream check | cada 6h | Verifica status de todos los canales |
| EPG refresh | diario 04:00 | Descarga y consolida 19 XMLTVs |
| M3U refresh | `0 3 */7 * *` | Importa fuentes M3U (semanal, dejado intencional) |
| IP monitor | cada 10 min | Detecta cambio IP pública → re-scrape tvtv |

---

## Dependencias principales

| Paquete | Para qué |
|---|---|
| `fastify` ^4.x | Framework HTTP |
| `better-sqlite3` | SQLite síncrono |
| `undici` ^7.25.0 | HTTP client con TLS por-request |
| `node-cron` | Cron jobs |
| `fuse.js` | Búsqueda fuzzy EPG picker |
| `fast-xml-parser` ^4.5.6 | Parser XMLTV |
| `pm2` (global) | Process manager |


---

## Flujo Discover UI (agregado 2026-05-13)

### Objetivo
Permitir revisar e importar manualmente los canales tvpori descubiertos por el barrido masivo, con preview visual antes de decidir si importar o saltar.

### Componentes
┌──────────────────┐         ┌──────────────────────────┐
│ scheduler        │         │ tvporiScraper            │
│ (no toca         │         │   - scrapeAllTvporiChan  │
│  discover, solo  │◄────────│   - discoverTvpori (new) │
│  scrape normal)  │         │   - scrapeTvporiChannel  │
└──────────────────┘         └──────────────────────────┘
▲
│ usado por
│
┌──────────────────┐         ┌──────────────────────────┐
│ admin/discover   │         │ admin.js endpoints       │
│   .html + .js    │◄────────│  /tvpori/discover/*      │
│                  │  HTTP   │  /tvpori/skip-*          │
│ - Card 1×1       │         │  /tvpori/import-*        │
│ - hls.js preview │         │  /tvpori/fresh-url       │
│ - Form import    │         └──────────────────────────┘
└──────────────────┘                   │
│                              │
│ /live/{stream_id}.ts         ▼
▼                       ┌─────────────────────┐
┌──────────────────┐             │ DB: channels +      │
│ xtream proxy     │             │ tvpori_skipped +    │
│ (302 redirect    │             │ system_state        │
│  al server real) │             └─────────────────────┘
└──────────────────┘
### Flujo de import

1. Usuario navega a `/admin/discover.html`
2. JS carga `/admin/tvpori/discover/pending?page=1&page_size=1`
3. Card renderizada con form (nombre default = `{slug}_{stream_id}`)
4. Click "▶️ Preview":
   - JS hace `GET /admin/tvpori/fresh-url?host=&stream_id=` (scrape fresco)
   - hls.js carga la URL con token nuevo
   - Browser sale por IP pública del router (misma que el cliente IPTV final)
   - Servidor remoto entrega el stream
   - Al cargar el video, `videoWidth × videoHeight` define calidad (FHD/HD/SD)
5. Usuario edita nombre/categoría/EPG/logo en el form
6. Click "Importar":
   - `POST /admin/tvpori/import-discovered` con todos los campos
   - Endpoint hace OTRO scrape fresco internamente (token actualizado al momento del INSERT)
   - INSERT en `channels` con `external_id = tvpori:{host}:{stream_id}`
   - Retorna `{ ok, channel: { id, ... } }`
7. JS avanza al siguiente pendiente automáticamente

### Decisiones de diseño

- **Card 1×1 (no grid):** evita saturar el server con N streams hls.js simultáneos
- **Preview on-demand:** click necesario, no auto-load
- **Scrape fresco en cada paso:** preview + import usan tokens nuevos (no caché)
- **external_id estable:** scrapers periódicos actualizan solo URL, no machacan nombre/EPG/categoría asignados por el usuario
- **Modelo simple (1 canal = 1 fuente):** refactor a channel_sources pospuesto a Fase 6 VPS

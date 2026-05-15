# Roadmap

## ✅ Completado 2026-05-15

- `external_id` para tvtv implementado (`tvtv:{stream_param}`)
- Refactor `scrapeAllTvporiChannels()` para iterar DB en vez de TVPORI_CHANNELS hardcoded
- Refresh tvpori ahora cubre los 315 canales activos (no solo 69), incluye bulk-importados
- Update masivo de 41 canales categorizados desde Excel (id-based, sanity check con external_id)

## 🔵 Pendiente lunes 18-may

- Aplicar patch aggregator.js (`external_id` para M3U: `m3u:{source_id}:{tvg-id}` o `m3u:{source_id}:url:{sha1_8}`)
- Script de migración para los 158 canales M3U sin external_id
- Investigar viabilidad de discover tvtv (estructura `stream=` analizada, formato no confirmado)

 — JaiboTV

> Estado al: **2026-05-08**
> Próxima semana de prueba: **11-15 mayo**

---

## 🔴 Inmediato (próximas 1-3 sesiones)

### Validador de importaciones masivas ⏳

Cuando una fuente M3U o un scraper trae canales nuevos, deben pasar por staging antes de publicarse. Sin esto, el cron puede meter decenas de canales basura sin validación (ocurrió el 2026-05-07).

**Flujo propuesto:**
1. Stream check de cada URL nueva (HEAD/GET con timeout corto)
2. Mapeo de categoría: si viene en inglés, traducir o sugerir
3. Auto-match EPG ID (con score mínimo de confianza)
4. Auto-match logo (con score mínimo)
5. Marcar como `pending_review=1` si alguna validación falla
6. Endpoint admin para revisar/aprobar/rechazar pendientes
7. **Tabla `channel_aliases`:** cuando se aprueba un merge (canal nuevo = canal existente), guardar el mapeo fuente→ID para que próximas importaciones no pasen por el validador

**Componentes a construir:**
- Tabla `pending_imports` (staging)
- Tabla `channel_aliases` (mapeo source_signature → channel_id)
- Modificar `tvporiScraper.js`, `tvtvScraper.js`, `aggregator.js`
- Endpoints admin: GET pending, POST approve, POST merge, POST reject
- UI en admin panel: pantalla de pendientes

**Por qué es prioridad:** el bug #13 (scraper tvpori hace INSERT en lugar de UPDATE) y el cron M3U de las 3 AM importando canales sin control van a seguir ocurriendo hasta que exista este sistema.

---

### Limpieza de canales no relevantes ⏳

94 canales activos actualmente incluyen locales/regionales mexicanos sin interés editorial (Multimedios Ciudad Juárez, Multimedios Laguna, UACJ-TV, TVP Mazatlán, etc.). Hacer pasada manual desde el admin panel para deshabilitar ~30-50 canales estimados.

---

### Arreglar matching de tvporiScraper (Bug #13) ⏳

Cambiar la búsqueda por nombre a búsqueda por `(tvpori_host, tvpori_stream_id)` como clave física. Ver `docs/bugs.md` para el fix exacto.

---

## 🟡 Corto plazo (post-15 mayo)

- **Validar Bug #14 (cron M3U procesa fuentes deshabilitadas)** — auditar `aggregator.js` / `scheduler.js` para agregar filtro `WHERE enabled=1`
- **Reducir loop de retries TLS en tvpori (Bug #15)** — cache en memoria de hosts con cert problemático
- **Auto-match de canales sin `epg_id`** — 41 canales pendientes (43%). Decisión: hacer matching MANUAL desde admin para validar contenido live vs EPG, no auto-match masivo
- **Hardening de `refreshAllEpgSources`** — migrar de `for...await` secuencial a `Promise.allSettled` con concurrencia limitada (Bug #10)
- **Scraper TV Azteca (MDSTRM)** — reverse engineering del `access_token` generado en bundle JS de `envivo.tvazteca.com`. HAR analizado, token no expuesto en network (generado client-side). Canales target: Azteca UNO, Azteca 7 y más. No urgente — canales activos vía tvporinternet2
- **Auth SSH para git** — eliminar fricción de PAT en cada `git push`
- **Fix Fastify deprecation warning (Bug #16)** — `reply.redirect(url, code)` en lugar de `reply.redirect(code, url)`
- **Arreglar caso ambiguo regionales/51** — mismo stream_id asociado a nombres distintos en tvpori (Estrella TV vs Universal Cinema)

---
### Mejoras al panel admin — Gestión de catálogo ⏳

Originadas del análisis comparativo con m3u4u.com (sesión 2026-05-14).
Necesarias para el flujo de depuración de los 921 canales "Por revisar".

#### Panel de Categorías (nueva sección en admin UI)

El API REST ya existe (`/admin/categories` GET/POST/PUT/DELETE).
Solo falta la UI. Implementar pantalla dedicada con:

- Lista de categorías con nombre, icono, `sort_order` y conteo de canales
- Crear categoría nueva (nombre + icono emoji + orden)
- Editar categoría (nombre, icono, orden)
- Eliminar categoría (solo si `channel_count = 0`, o con confirmación de reasignación)
- Reordenar via drag & drop que actualice `sort_order` en DB

**Backend necesario:** endpoint `PUT /admin/categories/:id/reorder` o
actualización del `sort_order` via el PUT existente.

#### Toggle enabled/disabled por canal (desde tabla de canales)

El campo `enabled` existe en DB pero no está expuesto en la UI.
Agregar toggle visual (switch o botón) en la fila de la tabla,
sin necesidad de abrir el modal de edición.

**Caso de uso inmediato:** durante la depuración de los 921 canales
"Por revisar", el flujo es: pruebo en IPTVX → no funciona → lo
deshabilito desde el admin sin borrarlo.

**Backend necesario:** endpoint `PATCH /admin/channels/:id/enabled`
(o reutilizar el PUT existente).

#### Selección múltiple de canales + acciones masivas

Checkboxes en la tabla de canales para selección individual y
"seleccionar todo en página". Barra de acciones que aparece al
seleccionar ≥1 canal:

- **Mover a categoría** → dropdown de categorías → aplica a todos los seleccionados
- **Habilitar todos** los seleccionados
- **Deshabilitar todos** los seleccionados
- **Eliminar todos** los seleccionados (con confirmación)

**Backend necesario:** endpoints bulk:
- `POST /admin/channels/bulk-update` — body: `{ ids[], category_id?, enabled? }`
- `POST /admin/channels/bulk-delete` — body: `{ ids[] }`

#### Sorting de la tabla de canales

Click en headers de columna para ordenar. Columnas ordenables:
nombre, categoría, EPG ID, calidad.

**Decisión pendiente antes de implementar:** ¿frontend-only (ordena
solo la página visible) o backend (parámetro `sort` en el query
`GET /admin/channels`)?

Recomendación: backend, para que el orden sea consistente con la
paginación. Costo: un parámetro extra en el endpoint.

---

#### Merge / deduplicación de canales

Para canales con mismo nombre, mismo contenido, misma calidad pero
diferente URL (caso frecuente durante la depuración masiva tvpori):

**Opción A — Deduplicación simple (corto plazo):**
- Vista comparativa: dos canales lado a lado con sus metadatos
- Acción "fusionar": conserva uno, transfiere metadatos útiles
  (EPG ID, logo, nombre custom) y elimina el duplicado
- Implementable sin cambios de schema

**Opción B — Multi-source por canal (Fase 6 / VPS):**
- Tabla `channel_sources` (ya documentada en roadmap Fase 6)
- Un canal lógico → múltiples URLs fuente con prioridad y failover
- El merge deja de ser "borrar uno" y pasa a ser "agregar source"

**Estado:** Opción A puede implementarse post-depuración si los
duplicados resultan ser un problema frecuente. Opción B está
comprometida a Fase 6.

**No implementar hasta terminar la depuración** y medir cuántos
duplicados reales existen en los 921 canales importados.

## Fases del proyecto

### Fase 1 ✅ — Backend base

- Node.js + Fastify + SQLite
- API Xtream Codes completa
- Panel admin web (SPA monolítico)
- Importador M3U

### Fase 2 ✅ — EPG

- Motor EPG con XMLTVs reales
- Búsqueda fuzzy con Fuse.js
- EPG ID picker en admin
- Consolidación de 19 fuentes con prioridad

### Fase 3 ✅ — Scrapers

- Scraper tvtvhd.com (12 canales premium, tokens 4h)
- Scraper tvporinternet2.com (69 canales, tokens 3.5h)
- Monitor de IP pública (auto re-scrape al detectar cambio)
- Stream checker con UA Chrome

### Fase 4 ✅ — Estabilización

- Cache M3U en memoria (TTL 60s)
- Fix TLS global → undici por request
- EPG entity expansion fix
- Heap 512MB + max_memory_restart 800M
- Cron stream check cada 6h
- Timezone CST en UI (UTC en DB)
- Sistema de diseño base JAIBO (tokens.css, design-system.md)

### Fase 5 ⏳ — Acceso remoto seguro

> **⏸️ Pospuesta a post-15 mayo (decisión 2026-05-07).**
> Razón: priorizar prueba de estabilidad con cliente IPTV en red local antes de exponer servicios a internet. Como alternativa de prueba en red distinta, se realizará mudanza física temporal del servidor a casa de Gustavo el fin de semana 9-10 mayo (no requiere hardening ni puertos abiertos). Requisitos previos identificados para Fase 5: cambiar credenciales `admin/admin123`, agregar auth a `/admin/*`, configurar fail2ban, hardening SSH (key-only), reverse proxy nginx + SSL.


- Dominio + DuckDNS / Cloudflare
- Nginx como reverse proxy → :3000
- Cert SSL (Let's Encrypt o Cloudflare)

### Fase 6 ⏳ — Migración a VPS

- Script export bundle para migración
- Resuelve definitivamente el Bug #1 (IP pública dinámica)
- Los VPS tienen IP estática → tokens tvtv no se invalidan por cambio de IP

### Fase 7 ⏳ — Monetización

- Sistema de usuarios con suscripciones
- Pagos (Stripe / PayPal)
- Auto-renovación de suscripciones

### Fase 8 ⏳ — VOD

- Módulo VOD (Pluto TV, Tubi, Internet Archive)

### Fase 9 ⏳ — IA

- Agente buscador automático de streams + VOD

---

## 🔵 Backlog en investigación

> Ideas que no están comprometidas a fase. Requieren investigación previa
> antes de evaluar viabilidad y priorización.

### Módulo de eventos deportivos del día

**Estado:** investigación pendiente — no comprometido a fase
**Origen:** análisis comparativo del repo `jobustamantedev/localTv` (sesión 2026-05-08)
**Prioridad:** baja, después del 15 mayo
**Pre-requisitos:** ninguno técnico, pero sí evaluar fuentes

#### Qué sería

Un módulo paralelo al EPG que muestre eventos deportivos del día agrupados
por competición (NBA, Champions, LigaMX, etc.) con badges clicables que
lleven al canal correspondiente del catálogo de JaiboTV.

Complementa el EPG (que es por canal/programa) con una vista por evento:
"¿dónde puedo ver el clásico hoy?" en lugar de "¿qué está pasando en ESPN?".

#### Qué hay que investigar antes de comprometer

1. **Fuente de datos:**
   - `pltvhd.com` (la que usa localTv) — verificar si expone API pública,
     términos de uso, estabilidad, formato de respuesta
   - Alternativas: livesoccertv.com, sportsdb.com (TheSportsDB API), api-football,
     scraping de páginas tipo marca.com / espn.com
   - Criterios: cobertura de ligas latinoamericanas (LigaMX, LigaPro, Libertadores),
     idioma español, gratuidad o costo, rate limits
2. **Mapeo evento → canal:**
   - El badge "ESPN" del evento debe resolver a un `channel_id` real del catálogo
   - Necesita tabla de aliases o búsqueda fuzzy reusando `Fuse.js` del EPG
3. **Modelo de datos tentativo:**
   - `events(id, competition, description, start_time, end_time, logo_url, source)`
   - `event_streams(event_id, channel_id, label, priority)`
4. **UX en panel admin:**
   - Tab "Eventos" al lado de "Canales" / "EPG"
   - Lista agrupada por competición, con búsqueda por equipo/competición/canal
   - Acción: clic en badge → carga el canal en el reproductor (cuando exista
     reproductor web) o abre URL Xtream para clientes externos

#### No hacer hasta haber investigado

- Diseñar esquema final
- Tocar código
- Asignar fase

#### Lo que NO se va a copiar de localTv

- Seed hardcoded de canales en código (anti-patrón)
- API REST propia reemplazando Xtream (rompería compatibilidad con clientes IPTV)
- API key hardcoded en frontend

---

## Estado al 2026-05-08 (post-auditoría)

| Métrica | Valor |
|---|---|
| Total canales activos | 94 |
| Stream OK | ~80 (85%) |
| Stream error | ~14 |
| EPG IDs indexados | 7,639 |
| Fuentes EPG activas | 19 (18 ok + 1 error) |
| Logos indexados | 3,848 |
| Fuentes M3U | 2 (ambas habilitadas tras ajuste 2026-05-08) |
| Usuarios | 1 (admin/admin123) |

---

## Pendientes de diseño

- **SVGs reales del logo** — `design/logo/` tiene placeholders vacíos. Crear las 3 variantes (signal, monogram, core)
- **Tipografías Inter + Space Grotesk** — definidas en tokens pero no instaladas (`@fontsource/inter` y `@fontsource/space-grotesk` cuando se introduzca frontend)
- **Primer mockup** — empezar por refresh visual del admin-ui aplicando tokens
## 🟣 Refactor estructural futuro

> Estado: planeado, NO implementar durante fase actual de estabilización.
>
> Razón: el proyecto ya evolucionó de una aplicación monolítica simple a una plataforma IPTV modular con backend, scrapers, scheduler, panel admin, sistema visual y futura separación frontend/backend.

### Objetivos del refactor

- Separar claramente backend, frontend, design system e infraestructura
- Preparar el proyecto para Docker Compose y despliegues modulares
- Permitir frontend independiente (React/Vite)
- Centralizar branding y design tokens
- Facilitar trabajo multi-IA (ChatGPT / Claude / Cursor)
- Reducir acoplamiento entre panel admin, scrapers y API IPTV
- Formalizar scripts operativos y tooling

### Estructura objetivo

```text
PROJECT/
│
├── docs/
│   ├── architecture/
│   ├── infra/
│   ├── api/
│   ├── roadmap/
│   ├── bugs/
│   └── handoff/
│
├── backend/
│   ├── src/
│   ├── data/
│   ├── tests/
│   ├── package.json
│   └── ecosystem.config.cjs
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── components/
│   ├── pages/
│   ├── styles/
│   ├── assets/
│   ├── package.json
│   └── vite.config.ts
│
├── design/
│   ├── brand/
│   │   ├── logos/
│   │   ├── icons/
│   │   ├── favicon/
│   │   └── social/
│   │
│   ├── tokens/
│   │   ├── colors.json
│   │   ├── spacing.json
│   │   ├── typography.json
│   │   ├── radius.json
│   │   └── shadows.json
│   │
│   ├── themes/
│   │   ├── jaibo-dark.ts
│   │   ├── jaibo-light.ts
│   │   └── legacy.css
│   │
│   ├── guidelines/
│   │   ├── DESIGN_SYSTEM.md
│   │   ├── BRAND_GUIDE.md
│   │   ├── UI_RULES.md
│   │   ├── ACCESSIBILITY.md
│   │   └── PROMPTING.md
│   │
│   ├── mockups/
│   │   ├── admin/
│   │   ├── mobile/
│   │   ├── dashboard/
│   │   └── onboarding/
│   │
│   ├── exports/
│   │   ├── figma/
│   │   ├── canva/
│   │   └── svg/
│   │
│   └── ai/
│       ├── image-prompts/
│       ├── ui-prompts/
│       └── visual-reference/
│
├── scripts/
│   ├── backup/
│   ├── restore/
│   ├── maintenance/
│   ├── migrations/
│   └── diagnostics/
│
├── docker/
│   ├── dev/
│   ├── prod/
│   ├── nginx/
│   └── compose/
│
├── .github/
│
├── README.md
├── CLAUDE.md
└── package.json

Decisiones importantes
1. design/ será la fuente de verdad visual

Todos los assets visuales y reglas de branding vivirán fuera del frontend.

El frontend consumirá:

logos exportados
tokens
themes
variables CSS
guidelines

pero NO será dueño de los archivos maestros.

2. Los tokens visuales serán centralizados

Colores, spacing, radius, tipografías y sombras vivirán en:

/design/tokens/

Objetivo:

sincronización frontend/design
coherencia visual
reutilización futura en apps móviles
compatibilidad con IA generativa
3. El panel admin eventualmente se separará del backend

El admin actual es SPA monolítica embebida.

Objetivo futuro:

frontend React/Vite independiente
backend API-only
workers separados para scrapers y scheduler
4. scripts/ centralizará automatización operativa

Incluye:

backups
restores
migraciones
diagnósticos
mantenimiento
limpieza
utilidades SSH
5. docker/ preparará despliegues reproducibles

Objetivo futuro:

docker compose
nginx reverse proxy
separación api/workers/frontend
despliegues reproducibles
Cuándo ejecutar este refactor

NO ejecutar durante:

estabilización actual
pruebas IPTV de mayo
mientras existan bugs críticos de scrapers/importaciones

Ejecutar después de:

implementar staging validator
estabilizar imports
separar frontend real
introducir Docker Compose

---

## Validador de Importaciones — ESTADO 2026-05-13

### ✅ Completado (sesión 2026-05-13 PM)

- **Anclaje estable `external_id`** para canales tvpori (formato `tvpori:{slug}:{stream_id}`)
- **Discover UI tvpori**: vista admin para revisar e importar canales descubiertos uno por uno con preview hls.js
- **Detección de calidad client-side**: FHD/HD/SD/LOW vía videoWidth × videoHeight
- **Endpoints**: discover, discover/pending, skip-discovered, import-discovered, fresh-url
- **Schema**: tabla `tvpori_skipped`

### 🟡 Parcialmente completado

- **Anclaje estable para M3U externos**: pendiente (formato propuesto `m3u:{source_id}:{tvg-id}` o `m3u:{source_id}:url:{hash8}`)
- **Anclaje para tvtv**: pendiente (formato propuesto `tvtv:{stream_param}`)

### ❌ Pendiente

- **Staging area para canales M3U nuevos** (`pending_channels` con stream_status_before_approve)
- **UI de aprobación masiva** para canales M3U externos
- **Auto-sugerencias** de EPG/logo/categoría durante import

---

## Refactor para Migración VPS (Fase 6)

### Pendiente para hacer durante la migración

**Tabla `channel_sources` (1:N canal lógico → fuentes):**
```sql
CREATE TABLE channel_sources (
id INTEGER PRIMARY KEY,
channel_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
external_id TEXT UNIQUE NOT NULL,
url TEXT NOT NULL,
priority INTEGER DEFAULT 10,
quality_label TEXT,  -- FHD/HD/SD/LOW
status TEXT DEFAULT 'unknown',
last_scraped_at TEXT,
last_checked_at TEXT,
created_at TEXT DEFAULT (datetime('now'))
);
**Cambios en código necesarios:**
- `tvporiScraper.js`: actualizar `channel_sources` en lugar de `channels.url_hd`
- `xtream.js`: en endpoint `/live/`, elegir source con priority más alta + status=ok (failover automático)
- `aggregator.js`: M3U externos crean canal lógico + source única
- `admin.js`: endpoints para agregar/quitar sources a canales existentes
- Admin UI: tab "Fuentes" en edición de canal para gestionar sources

**Migración de datos:**
- Para cada canal existente con external_id no-null: crear source equivalente
- Mantener compatibilidad temporal de columnas `url_hd/url_fhd/url_sd` durante transición

---


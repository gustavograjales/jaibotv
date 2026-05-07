# Roadmap — JaiboTV

> Estado al: **2026-05-07**
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

~94 canales activos actualmente incluyen locales/regionales mexicanos sin interés editorial (Multimedios Ciudad Juárez, Multimedios Laguna, UACJ-TV, TVP Mazatlán, etc.). Hacer pasada manual desde el admin panel para deshabilitar ~30-50 canales estimados.

---

### Arreglar matching de tvporiScraper (Bug #13) ⏳

Cambiar la búsqueda por nombre a búsqueda por `(tvpori_host, tvpori_stream_id)` como clave física. Ver `docs/bugs.md` para el fix exacto.

---

## 🟡 Corto plazo (post-15 mayo)

- **Arreglar cron M3U que procesa fuentes deshabilitadas (Bug #14)** — auditar `aggregator.js` / `scheduler.js` para agregar filtro `WHERE enabled=1`
- **Reducir loop de retries TLS en tvpori (Bug #15)** — cache en memoria de hosts con cert problemático
- **Auto-match de canales sin `epg_id`** — 41 canales pendientes (43%). Decisión: hacer matching MANUAL desde admin para validar contenido live vs EPG, no auto-match masivo
- **Hardening de `refreshAllEpgSources`** — migrar de `for...await` secuencial a `Promise.allSettled` con concurrencia limitada (Bug #10)
- **Scraper TV Azteca (MDSTRM)** — reverse engineering del `access_token` generado en bundle JS de `envivo.tvazteca.com`. HAR analizado, token no expuesto en network (generado client-side). Canales target: Azteca UNO, Azteca 7 y más. No urgente — canales activos vía tvporinternet2
- **Auth SSH para git** — eliminar fricción de PAT en cada `git push`
- **Fix Fastify deprecation warning (Bug #16)** — `reply.redirect(url, code)` en lugar de `reply.redirect(code, url)`
- **Arreglar caso ambiguo regionales/51** — mismo stream_id asociado a nombres distintos en tvpori (Estrella TV vs Universal Cinema)

---

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
- Consolidación de 25 fuentes con prioridad

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

## Estado de canales al 2026-05-07 (post-restore)

| Métrica | Valor |
|---|---|
| Total canales activos | 94 |
| Stream OK | ~80 (85%) |
| Stream error | ~14 |
| EPG IDs indexados | ~9,261 |
| Fuentes EPG activas | 25 |
| Logos indexados | 3,848 |
| Fuentes M3U | 2 (iptv-org activa, jromero88 deshabilitada) |
| Usuarios | 1 (admin/admin123) |

---

## Pendientes de diseño

- **SVGs reales del logo** — `design/logo/` tiene placeholders vacíos. Crear las 3 variantes (signal, monogram, core)
- **Tipografías Inter + Space Grotesk** — definidas en tokens pero no instaladas (`@fontsource/inter` y `@fontsource/space-grotesk` cuando se introduzca frontend)
- **Primer mockup** — empezar por refresh visual del admin-ui aplicando tokens

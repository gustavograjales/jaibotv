# JaiboTV — Servidor IPTV Personal

## Sobre este proyecto

JaiboTV es un servidor IPTV personal que expone una API compatible con Xtream Codes (compatible con IPTV Smarters, IPTVx, TiviMate, etc.), un panel de administración web, EPG engine con búsqueda fuzzy, scrapers automáticos para fuentes con tokens dinámicos, y manejo de logos.

## Quién soy

Soy Gustavo Grajales (gustavograjales en GitHub). Trabajo en este proyecto como desarrollo personal. Accedo al servidor vía SSH desde Windows 11.

## Cómo quiero que me respondas

- **Idioma:** Español, directo, sin rodeos ni disclaimers innecesarios
- **Código:** Soluciones completas y probadas, no fragmentos sueltos
- **Comandos:** Listos para copiar/pegar, indicando si requieren `sudo`
- **Cambios en archivos existentes:** Muéstrame el diff o la sección exacta a modificar, no todo el archivo
- **Cambios grandes:** Pregúntame antes de proponer refactors mayores
- **Información faltante:** Pídemela explícitamente (logs, configs, estado actual)

## Infraestructura

- **Hardware:** HP EliteBook 840 G7 (i5-10310U, 32GB RAM, 256GB SSD)
- **OS:** Ubuntu 22.04 LTS minimal
- **IP local fija:** `192.168.1.250` (configurada vía NetworkManager, conexión `INFINITUM44AC`)
- **Hostname:** jaibotv
- **Acceso SSH:** `ssh ggajales@192.168.1.250`
- **Path del proyecto:** `/home/ggajales/iptv-server/`
- **MAC del servidor:** `70:9c:d1:17:95:58` (interfaz WiFi `wlp0s20f3`)
- **Gateway:** `192.168.1.254` (router Huawei HG8145V5V3 Infinitum)
- **Conexión:** WiFi (Ethernet desconectada — considerar cable para mejor latencia/throughput)
- **IPv6 público disponible** (Telmex asigna IPv6 enrutable, útil para acceso remoto futuro)

### Configuración de IP estática

La IP fija está configurada **directamente en el servidor** vía NetworkManager, no se depende de la reserva DHCP del router (la reserva del router no funcionaba):

```bash
sudo nmcli connection modify "INFINITUM44AC" 
ipv4.addresses 192.168.1.250/24 
ipv4.gateway 192.168.1.254 
ipv4.dns "1.1.1.1,8.8.8.8" 
ipv4.method manual

**Nota:** esto solo aplica a la red `INFINITUM44AC`. En otras redes WiFi el equipo usa DHCP normal.

## Stack técnico

- **Runtime:** Node.js 20.20.2 LTS
- **Framework:** Fastify 4.x
- **Base de datos:** SQLite (better-sqlite3) — `data/iptv.db` (~2.6 MB)
- **Process manager:** PM2 (procesos `jaibotv` + `temp-monitor`)
- **Reverse proxy:** Nginx (instalado, escuchando :80, **sin reverse proxy configurado** todavía)
- **Otros:** Docker, ffmpeg, UFW firewall
- **Puertos abiertos en UFW:** 22, 80, 443, 3000 (TCP, IPv4 e IPv6)

## Archivos de configuración

- `ecosystem.config.cjs` — Config PM2 (heap 512MB vía NODE_OPTIONS, max_memory_restart 600M)

## Estructura del proyecto
iptv-server/
├── config.js              # Config general (SERVER_IP centralizado)
├── ecosystem.config.cjs   # Config PM2 (heap 512MB, max_memory_restart 600M)
├── package.json
├── package-lock.json
├── CLAUDE.md              # Este archivo (fuente de verdad)
├── data/                  # SQLite + caches (ignorado por git)
│   ├── iptv.db
│   ├── epg-cache/         # XMLTVs descargados de fuentes EPG
│   ├── m3u-cache/
│   └── logo-index.json    # Cache del índice de logos (3,848 entradas)
├── media/                 # VOD content (ignorado por git, sin uso aún)
└── src/
    ├── server.js          # Entry point
    ├── admin-ui/
    │   └── index.html     # Panel admin web (SPA monolítico)
    ├── api/
    │   ├── admin.js       # REST API admin
    │   └── xtream.js      # Xtream Codes API
    ├── core/
    │   ├── aggregator.js     # M3U parser + importer
    │   ├── epgEngine.js      # EPG parser + Fuse.js search
    │   ├── ipMonitor.js      # Monitor IP pública + auto re-scrape tvtv
    │   ├── logoEngine.js     # Logos desde tv-logo/tv-logos GitHub
    │   ├── m3uCache.js       # Cache en memoria del M3U (TTL 60s)
    │   ├── scheduler.js      # Cron jobs
    │   ├── streamChecker.js  # Verifica streams (HEAD/GET request)
    │   ├── systemState.js    # Helpers para tabla system_state (key-value)
    │   ├── tvporiScraper.js  # Scraper tvporinternet2.com (tokens cada 3.5h)
    │   └── tvtvScraper.js    # Scraper tvtvhd.com (tokens cada 4h)
    └── db/
        ├── schema.js
        └── seed.js
## Endpoints principales

- **Admin Panel:** http://192.168.1.250:3000/admin/
- **Xtream API:** http://192.168.1.250:3000 (user: `admin`, pass: `admin123`)
- **M3U:** http://192.168.1.250:3000/get.php?username=admin&password=admin123&type=m3u
- **EPG (XMLTV):** http://192.168.1.250:3000/xmltv.php?username=admin&password=admin123
- **Health:** http://192.168.1.250:3000/health
- **Stats API:** http://192.168.1.250:3000/admin/stats

## Estado actual (auditado el 2026-05-04)

### Canales

- **Total activos:** 89 (todos `enabled=1`)
- **Stream OK:** 26 (29%)
- **Stream error:** 0 (tvporinternet2 resuelto ✅)
- **Última verificación:** 2026-05-04 23:18

### Distribución por categoría

| Categoría | Canales | Con EPG | Con logo | OK | Error |
|---|---|---|---|---|---|
| 📰 Noticias | 3 | 3 | 3 | 2 | 1 |
| ⚽ Deportes | 36 | 34 | 22 | ~14 | ~22 |
| 🎭 Entretenimiento | 20 | 18 | 7 | 5 | 15 |
| 🎬 Películas | 8 | 7 | 1 | 0 | 8 |
| 📺 Series | 1 | 1 | 0 | 0 | 1 |
| 🧸 Infantil | 3 | 3 | 2 | 0 | 3 |
| 🎥 Documentales | 9 | 7 | 4 | 1 | 8 |
| 🎵 Música | 0 | 0 | 0 | 0 | 0 |
| 🌍 Internacionales | 1 | 1 | 1 | 1 | 0 |
| 📡 General | 8 | 7 | 5 | 4 | 4 |

### EPG y Logos

- **EPG IDs indexados:** ~9,261 (Fuse.js para búsqueda fuzzy)
- **Fuentes EPG:** 25 activas (todas con status `ok`) — Free EPG Ru desactivada por OOM
- **Priorización de fuentes EPG:** columna `priority` en `epg_sources` (default 50, menor = mayor prioridad). Resuelve conflictos cuando varias fuentes publican el mismo `epg_id` con programación distinta. Ej: `OPEN EPG Esp2` (id 34) configurada con `priority=10` por ser más confiable que `OPEN EPG Esp` (id 32, priority 50)
- **Logos indexados:** 3,848 (cache en `data/logo-index.json` desde tv-logo/tv-logos GitHub)
- **Fuentes M3U activas:** 2 (iptv-org México, jromero88)

### Usuarios

- **1 admin:** `admin` / `admin123` — credenciales por defecto, **pendiente cambiar a producción**

## Fuentes de streams

### 1. tvtvhd.com — FUNCIONANDO (con caveat de IP pública)

- **13 canales premium** scrapeados (DAZN 1, DSports, ESPN 5/6/7/Premium, Fox Sports, TNT Sports, TyC Sports, Liga 1 MAX, Movistar Deportes, Win Sports Plus x2)
- Renueva tokens cada **4 horas** vía node-cron
- `stream_param` guardado en DB por canal
- Endpoint manual: `POST /admin/tvtv/scrape`
- ⚠️ **Caveat conocido:** los tokens están atados a la IP pública de salida. Si la IP cambia (reset del módem, mantenimiento del ISP, etc.), todos los canales tvtv quedan rotos hasta el próximo scrape (ver "Bug conocido: IP pública" en roadmap).

### 2. iptv-org México — FUNCIONANDO

- URL: https://iptv-org.github.io/iptv/countries/mx.m3u
- 141 canales reportados al importar (filtrados a los que tenían contenido válido)

### 3. jromero88 — FUNCIONANDO

- URL: https://raw.githubusercontent.com/jromero88/iptv/master/channels/mx.m3u
- 21 canales

### 4. tvporinternet2.com — FUNCIONANDO ✅
- 69/69 canales activos (29 deportes + 40 regionales)
- Scraper: `src/core/tvporiScraper.js`
- Renovación automática cada 3.5h via cron
- SSL deshabilitado para deportes.ksdjugfsddeports.com (certificado expirado en origen)
- IP del CDN es dinámica (base64 cambia con cada token)
- 3 canales pendientes sin stream_id confirmado: DirecTV Sports+, ESPN4, Sky Sports LaLiga
- **TAREA:** descifrar generación de tokens y crear scraper

#### Mapa de canales tvporinternet2

**DEPORTES (deportes.ksdjugfsddeports.com):**
1=TUDN | 3=DirecTV Sports | 4=TNT Sports | 6=TYC Sports | 8=FOX Sports | 9=FOX Sports 2 | 10=FOX Sports 3 | 11=DirecTV Sports+ | 12=Fox Sports Premium | 13=ESPN | 14=ESPN 2 | 15=ESPN 3 | 16=FOX Sports MX | 17=FOX Sports 2 MX | 19=ESPN MX | 22=Liga 1 Max | 23=ESPN 4 | 24=ESPN 5 | 25=ESPN 6 | 26=ESPN 7 | 27=DAZN F1 | 28=DAZN La Liga | 29=Movistar Liga | 30=WIN Sports Plus | 31=Bein Sports Xtra | 33=ESPN 4 MX | 34=Azteca Deportes | 35=TNT Sports Chile | 37=Sky Sports LaLiga | 38=ESPN 5 MX | 39=Liga 1

**REGIONALES (regionales.saohgdasregions.fun):**
1=Azteca 7 | 2=Canal 5 | 5=TNT Novelas | 9=Univision | 12=TLNovelas | 13=Las Estrellas | 24=Unicable | 25=Imagen TV | 26=Azteca Uno | 28=Disney Channel | 31=Cartoon Network | 32=Tooncast | 37=Discovery | 41=ID Investigation | 42=H&H Discovery | 43=A&E | 44=History | 45=History 2 | 46=Animal Planet | 47=Nat Geo | 49=Universal | 50=Universal Premiere | 51=Universal Cinema | 52=TNT | 53=TNT Series | 54=Star Channel | 55=Cinemax | 56=Space | 58=Warner Channel | 59=Cinecanal | 60=FX | 61=AXN | 63=AMC | 64=Studio Universal | 67=Golden | 68=Golden Plus | 69=Golden Edge | 70=Caras TV | 72=Canal Sony | 75=Distrito Comedia

## Funcionalidades implementadas ✅

- Xtream Codes API completa (compatible IPTVx + IPTV Smarters)
- EPG engine con XMLTVs reales cacheados
- EPG ID picker con búsqueda fuzzy (Fuse.js) + preview de programación
- Etiquetas de fuente en picker [PlutoTV] [Samsung] [GlobeTV]
- Logo picker con búsqueda por nombre
- Auto-match EPG masivo y auto-logo masivo
- Scraper tvtvhd.com (tokens cada 4h automático)
- Failover de streams (tabla `stream_sources`) — **estado embrionario**, ver deuda técnica
- Stream checker (verifica status de todos los canales)
- Admin panel web completo (SPA monolítico HTML+JS)
- Consolidación categorías → 10 en español
- Servidor 24/7 (sin suspensión, CPU governor `performance`)
- Monitoreo temperatura (PM2 + bash script `temp-monitor`)

## Deuda técnica conocida

### 1. Bug conocido: IP pública (prioridad media)

**Síntoma:** cuando la IP pública del servidor cambia (reset del módem, fallo del ISP, mantenimiento de Telmex), los tokens scrapeados de tvtvhd.com quedan invalidados al instante porque el servidor de fubohd.com los valida contra la IP de origen del request, no contra el `expires` del token.

**Detectado el 2026-05-04** después de un reset del módem que cambió la IP pública de `187.189.163.84` a `189.175.131.95`. Resultado: 12 de 13 canales premium quedaron rotos hasta correr `POST /admin/tvtv/scrape` manualmente.

**Mitigación actual (2026-05-05):** monitor automático cada 10 min en `src/core/ipMonitor.js`.
Detecta cambio de IP pública usando cadena de fallback (api.ipify.org → ifconfig.me → icanhazip.com),
guarda historial en tabla `system_state`, y dispara `scrapeAllTvtvChannels()` automáticamente +
invalida cache M3U. Status en `GET /admin/system/ip-status`. Sigue siendo prioridad media porque
hay ventana de hasta 10 min entre el cambio de IP y la detección.

**Soluciones propuestas (a implementar en algún punto):**

a) **Monitor de IP pública con re-scrape automático**
   - Job cada 15-30 min: `curl -s https://api.ipify.org` → comparar con IP guardada
   - Si cambia, disparar `scrapeAllTvtvChannels()` inmediatamente
   - Implementación: agregar en `scheduler.js` + tabla `system_state` con `current_public_ip`

b) **Fallback on-demand en `xtream.js`**
   - Cuando el endpoint `/live/...` reciba un request para un canal tvtv y la URL responda 403 (verificable con HEAD rápido)
   - Disparar re-scrape de ese canal específico en background
   - Devolver al cliente con la URL nueva en el siguiente polling

c) **Reducir cadencia del scrape de 4h → 1h**
   - Minimiza la ventana de error tras un cambio de IP
   - Costo: más requests a tvtvhd.com (riesgo de rate-limit)

**Importancia:** media. Pierde criticidad cuando el proyecto se mueva a VPS porque los VPS tienen IP estática y no rotan. Por ahora, ejecutar `POST /admin/tvtv/scrape` manualmente si se detectan canales premium caídos.

### 2. Tabla `stream_sources` con bug de FK + status incorrecto (RESUELTO 2026-05-04)

**Problema histórico:** la tabla `stream_sources` (sistema de failover de URLs) tenía 2,041 registros, de los cuales 2,015 (98%) eran huérfanos por borrados manuales en el admin panel sin foreign keys activas. Adicionalmente, `xtream.js` priorizaba `stream_sources` sobre `url_hd` aunque el `status` fuera `unknown` (no verificado), entregando URLs con tokens caducos a clientes IPTV.

**Resolución aplicada:**
- Vaciar tabla `stream_sources` (commit `0421f33`)
- Eliminar fuente EPG rota `Free EPG` (epg.pw/api/epg.xml retornaba 404)
- Fix en `xtream.js`: query cambia de `status != 'error'` a `status = 'ok'` para no usar URLs no verificadas

**Pendiente:** decidir si reconstruir el feature de failover (importar URLs alternativas reales y verificarlas periódicamente) o eliminarlo del schema.

### 3. Endpoint `/get.php` lento (~8 segundos) — RESUELTO 2026-05-05

Implementado cache en memoria (`src/core/m3uCache.js`) con TTL=60s e invalidación
explícita en eventos. Key compuesta `{catId}:{qualities}:{epgUrl}`. Stats en
`GET /admin/m3u-cache/stats`. Invalidación manual en `POST /admin/m3u-cache/invalidate`.

### 4. Heap del proceso al 92-94% — RESUELTO 2026-05-05

Heap subido a 512MB vía `NODE_OPTIONS=--max-old-space-size=512` en
`ecosystem.config.cjs`. PM2 corre con `max_memory_restart: '600M'`.

### 5. M3U entrega URLs directas, no proxy

El M3U devuelve URLs externas con tokens "congelados" en el momento de la descarga. Si el cliente IPTV cachea el M3U y lo intenta usar 4h después, los tokens habrán expirado.

**Solución correcta:** que el M3U devuelva URLs proxy del tipo `http://192.168.1.250:3000/live/admin/admin123/{stream_id}.ts` (ya implementado en `xtream.js`) y que el redirect 302 entregue el token fresco en cada request.

### 6. Stream checker da falsos positivos en algunos servidores

Los servidores fubohd.com aceptaban GET pero el HEAD a veces da 403 con el mismo token. Verificar lógica en `streamChecker.js` — usar GET con `Range: bytes=0-0` puede ser más confiable que HEAD.

### 7. Auth de Git por contraseña

Cada `git push` pide usuario y PAT. Migrar a SSH o configurar credential helper.

### 8. Sin backup automatizado de la DB

`data/iptv.db` está en `.gitignore` por seguridad pero no hay rotación local. Agregar cron diario que copie a `~/backups/db/` con rotación.

### 9. OOM con XMLTVs grandes (mitigado)

`fast-xml-parser` materializa todo el árbol XML en memoria. Con `max_memory_restart: 600M` de PM2, archivos >50 MB pueden tumbar el proceso silenciosamente (PM2 lo reinicia y la fuente queda en `status='loading'` eternamente). **Detectado el 2026-05-05** con `Free EPG Ru` (89 MB, 3,823 canales) → fuente desactivada. Pendiente: implementar stream parser (sax) para fuentes grandes o validar tamaño antes de parsear.

### 10. Refresh EPG secuencial sin aislamiento de errores

`refreshAllEpgSources()` usa `for...await` secuencial. Si una fuente falla con error no capturable (OOM, timeout largo), las siguientes se skipean sin log claro. Pendiente: migrar a `Promise.allSettled` con concurrencia limitada (p.ej. 3 simultáneas).

### 11. Regex de XMLTV sensible al orden de atributos (resuelto)

El parser de `<programme>` en `generateConsolidatedEPG()` asumía que `channel` y `start` venían en orden fijo. PlutoTV/Samsung publican `<programme channel="..." start="...">`, pero OPEN EPG España publica `<programme start="..." stop="..." channel="...">`. Solo capturaba ~7 canales de 71. **Detectado y corregido el 2026-05-05** — regex ahora extrae atributos por separado tras matchear el bloque entero. Lección: nunca asumir orden de atributos en XML.

## Roadmap

### 🔴 Inmediato (próximas 1-2 sesiones)

- ~~**Scraper tvporinternet2.com**~~ — ✅ Completado (69 canales activos, renovación 3.5h)
- **Análisis de sitio nuevo** — capturar URLs de streams (sitio pendiente de compartir)
- ~~**Cachear M3U en memoria**~~ — ✅ Completado 2026-05-05 (TTL=60s + invalidación en eventos)

### 🟡 Corto plazo

- ~~**Monitor de IP pública**~~ — ✅ Completado 2026-05-05 (cron 10 min, bug #1 mitigado)
- ~~**Aumentar heap de Node**~~ — ✅ Completado 2026-05-05 (512MB)
- ~~**Fix cron EPG**~~ — ✅ Completado 2026-05-05 (`'0 4 */7 * *'` → `'0 4 * * *'` diario)
- ~~**Priorización de fuentes EPG**~~ — ✅ Completado 2026-05-05 (columna `priority`, dedup en XMLTV consolidado, preview prioriza correctamente)
- **Auto-match de canales sin `epg_id`** — 24 canales pendientes, usar `autoMatchEpgId()` existente en `epgEngine.js`
- **Hardening de `refreshAllEpgSources`** — `Promise.allSettled` con concurrencia limitada (bug #10)
- **Stream parser para XMLTVs grandes** — sax/saxes en lugar de fast-xml-parser para fuentes >50MB (bug #9)
- **Fix cron M3U** — `'0 3 */7 * *'` tiene mismo bug semántico, dejado intencional porque M3U se actualiza manualmente
- **Auth SSH para git** — eliminar fricción de PAT

### Fase 5 ⏳ — Acceso remoto seguro

- Dominio Cloudflare + HTTPS + DuckDNS
- Configurar Nginx como reverse proxy → :3000
- Cert SSL via Let's Encrypt o Cloudflare

### Fase 6 ⏳ — Migración a VPS

- Script export bundle para migración
- Esto resuelve definitivamente el bug de IP pública (#1)

### Fase 7 ⏳ — Monetización

- Sistema de usuarios + pagos (Stripe/PayPal)
- Endpoint de auto-renovación de suscripciones

### Fase 8 ⏳ — VOD

- Módulo VOD (Pluto TV, Tubi, Internet Archive)

### Fase 9 ⏳ — IA

- Agente IA (buscador automático de streams + VOD)

## PM2 — Procesos activos

- `jaibotv` — servidor principal (uptime variable, restarts esperados durante desarrollo)
- `temp-monitor` — bash script de monitoreo de temperatura

## Comandos útiles

```bash
# Estado del servidor
pm2 status
pm2 logs jaibotv --lines 20 --nostream

# Stats del proyecto
curl -s http://localhost:3000/admin/stats

# Forzar scraping y verificación
curl -X POST http://localhost:3000/admin/tvtv/scrape
curl -X POST http://localhost:3000/admin/streams/check-all
curl -X POST http://localhost:3000/admin/sources/epg/refresh-all

# Verificar IP pública (relevante para bug #1)
curl -s https://api.ipify.org

# Query rápida de canales
sqlite3 ~/iptv-server/data/iptv.db "SELECT name, stream_status FROM channels WHERE enabled=1 ORDER BY stream_status, name;"

# Backup manual de la DB
mkdir -p ~/backups/db
cp ~/iptv-server/data/iptv.db ~/backups/db/iptv_$(date +%Y%m%d_%H%M%S).db
```

## Nota importante para Claude

Cuando termine una fase importante o agregue features grandes, recuérdame **actualizar este CLAUDE.md** con el nuevo estado y hacer commit. Es la fuente de verdad del proyecto.

Última auditoría completa: **2026-05-05** (cache M3U + monitor IP + heap 512MB + EPG refresh + cron fix + OOM mitigado + priorización de fuentes EPG)

# JaiboTV — Servidor IPTV Personal

## Sobre este proyecto

JaiboTV es un servidor IPTV personal que expone una API compatible con Xtream Codes (compatible con IPTV Smarters, IPTVx, TiviMate, etc.), un panel de administración web, EPG engine con búsqueda fuzzy, scrapers automáticos para fuentes con tokens dinámicos, y manejo de logos.

## Quién soy

Soy Gabriel Ajales (gustavograjales en GitHub). Trabajo en este proyecto como desarrollo personal. Accedo al servidor vía SSH desde Windows 11.

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
- **IP fija:** 192.168.1.250
- **Hostname:** jaibotv
- **Acceso SSH:** `ssh ggajales@192.168.1.250`
- **Path del proyecto:** `/home/ggajales/iptv-server/`

## Stack técnico

- **Runtime:** Node.js 20 LTS
- **Framework:** Fastify
- **Base de datos:** SQLite (better-sqlite3)
- **Process manager:** PM2
- **Reverse proxy:** Nginx (instalado, no configurado aún)
- **Otros:** Docker, ffmpeg, UFW firewall
- **Puertos abiertos:** 22, 80, 443, 3000

## Estructura del proyecto
iptv-server/
├── config.js              # Configuración general
├── package.json
├── data/                  # SQLite + caches (ignorado por git)
├── media/                 # VOD content (ignorado por git)
└── src/
├── server.js          # Entry point
├── admin-ui/
│   └── index.html     # Panel admin web
├── api/
│   ├── admin.js       # REST API admin
│   └── xtream.js      # Xtream Codes API
├── core/
│   ├── aggregator.js     # M3U parser + importer
│   ├── epgEngine.js      # EPG parser + Fuse.js search
│   ├── logoEngine.js     # Logos desde tv-logo/tv-logos GitHub
│   ├── scheduler.js      # Cron jobs
│   ├── streamChecker.js  # Verifica streams (HEAD request)
│   └── tvtvScraper.js    # Scraper tvtvhd.com (tokens 4h)
└── db/
├── schema.js
└── seed.js

## Endpoints principales

- **Admin Panel:** http://192.168.1.250:3000/admin/
- **Xtream API:** http://192.168.1.250:3000 (user: admin, pass: admin123)
- **M3U:** http://192.168.1.250:3000/get.php?username=admin&password=admin123&type=m3u
- **EPG:** http://192.168.1.250:3000/xmltv.php?username=admin&password=admin123
- **Health:** http://192.168.1.250:3000/health

## Estado actual

### Canales
- **Total:** 139
- **Activos verificados:** 67 (`stream_status='ok'`)
- **Con tokens expirados:** 72 (`stream_status='error'`)

### Categorías (10 en español)
📰 Noticias | ⚽ Deportes | 🎭 Entretenimiento | 🎬 Películas | 📺 Series | 🧸 Infantil | 🎥 Documentales | 🎵 Música | 🌍 Internacionales | 📡 General

### EPG y Logos
- **EPG IDs indexados:** 13,290
- **Fuentes EPG:** 27 activas
- **Logos indexados:** 3,848
- **Fuentes M3U:** 2 activas (iptv-org México, jromero88)

### Usuarios
- 1 admin (admin/admin123) — credenciales por defecto, pendiente cambiar a producción

## Fuentes de streams

### 1. tvtvhd.com (FUNCIONANDO)
- 46 canales deportivos con scraper automático
- Renueva tokens cada 4 horas vía node-cron
- `stream_param` guardado en DB por canal
- Endpoint: `POST /admin/tvtv/scrape`

### 2. iptv-org México (FUNCIONANDO)
- URL: https://iptv-org.github.io/iptv/countries/mx.m3u

### 3. jromero88 (FUNCIONANDO)
- URL: https://raw.githubusercontent.com/jromero88/iptv/master/channels/mx.m3u

### 4. tvporinternet2.com (TOKENS EXPIRADOS — TAREA PENDIENTE)
- 70 canales con tokens caducados
- Dominio deportes: `deportes.ksdjugfsddeports.com:9092`
- Dominio regionales: `regionales.saohgdasregions.fun:9092`
- Path fijo: `/MTg3LjE4OS4xNjMuODQ=/`
- Formato URL: `https://DOMINIO:9092/MTg3LjE4OS4xNjMuODQ=/NUM_.m3u8?token=XXX&expires=TIMESTAMP`
- El servidor bloquea peticiones directas (Access denied)
- **TAREA:** Descifrar generación de tokens y crear scraper

### Mapa de canales tvporinternet2

**DEPORTES (deportes.ksdjugfsddeports.com):**
1=TUDN | 3=DirecTV Sports | 4=TNT Sports | 6=TYC Sports | 8=FOX Sports | 9=FOX Sports 2 | 10=FOX Sports 3 | 11=DirecTV Sports+ | 12=Fox Sports Premium | 13=ESPN | 14=ESPN 2 | 15=ESPN 3 | 16=FOX Sports MX | 17=FOX Sports 2 MX | 19=ESPN MX | 22=Liga 1 Max | 23=ESPN 4 | 24=ESPN 5 | 25=ESPN 6 | 26=ESPN 7 | 27=DAZN F1 | 28=DAZN La Liga | 29=Movistar Liga | 30=WIN Sports Plus | 31=Bein Sports Xtra | 33=ESPN 4 MX | 34=Azteca Deportes | 35=TNT Sports Chile | 37=Sky Sports LaLiga | 38=ESPN 5 MX | 39=Liga 1

**REGIONALES (regionales.saohgdasregions.fun):**
1=Azteca 7 | 2=Canal 5 | 5=TNT Novelas | 9=Univision | 12=TLNovelas | 13=Las Estrellas | 24=Unicable | 25=Imagen TV | 26=Azteca Uno | 28=Disney Channel | 31=Cartoon Network | 32=Tooncast | 37=Discovery | 41=ID Investigation | 42=H&H Discovery | 43=A&E | 44=History | 45=History 2 | 46=Animal Planet | 47=Nat Geo | 49=Universal | 50=Universal Premiere | 51=Universal Cinema | 52=TNT | 53=TNT Series | 54=Star Channel | 55=Cinemax | 56=Space | 58=Warner Channel | 59=Cinecanal | 60=FX | 61=AXN | 63=AMC | 64=Studio Universal | 67=Golden | 68=Golden Plus | 69=Golden Edge | 70=Caras TV | 72=Canal Sony | 75=Distrito Comedia

## Funcionalidades implementadas ✅

- Xtream Codes API completa (compatible IPTVx + IPTV Smarters)
- EPG engine con XMLTVs reales cacheados
- EPG ID picker con búsqueda fuzzy (Fuse.js) + preview programación
- Etiquetas de fuente en picker [PlutoTV] [Samsung] [GlobeTV]
- Logo picker con búsqueda por nombre
- Auto-match EPG masivo y auto-logo masivo
- Scraper tvtvhd.com (tokens cada 4h automático)
- Failover de streams (tabla `stream_sources`)
- Stream checker (verifica status de todos los canales)
- Admin panel web completo
- Consolidación categorías → 10 en español
- Servidor 24/7 (sin suspensión, CPU performance mode)
- Monitoreo temperatura (PM2 + bash script)

## Roadmap

### 🔴 Inmediato
- **Scraper tvporinternet2.com** — descifrar generación de tokens m3u8
- **Análisis de sitio nuevo** — capturar URLs de streams (sitio pendiente de compartir)

### Fase 5 ⏳ — Acceso remoto seguro
- Dominio Cloudflare + HTTPS + DuckDNS

### Fase 6 ⏳ — Migración
- Script export bundle para migración a VPS

### Fase 7 ⏳ — Monetización
- Sistema de usuarios + pagos (Stripe/PayPal)

### Fase 8 ⏳ — VOD
- Módulo VOD (Pluto TV, Tubi, Internet Archive)

### Fase 9 ⏳ — IA
- Agente IA (buscador automático de streams + VOD)

## PM2 — Procesos activos

- `jaibotv` — servidor principal
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

# Query rápida de canales
sqlite3 ~/iptv-server/data/iptv.db "SELECT name,stream_status FROM channels ORDER BY stream_status,name;"
```

## Nota importante para Claude

Cuando termine una fase importante o agregue features grandes, recuérdame **actualizar este CLAUDE.md** con el nuevo estado y hacer commit. Es la fuente de verdad del proyecto.

# API Reference — JaiboTV

**Base URL:** `http://192.168.1.250:3000`
**Credenciales Xtream:** user=`admin`, pass=`admin123`

---

## Xtream Codes API

Compatible con IPTV Smarters, IPTVx, TiviMate y cualquier cliente Xtream.

### Autenticación

```bash
# Login / info del servidor
curl "http://192.168.1.250:3000/player_api.php?username=admin&password=admin123"

# Responde JSON con info del servidor, exp_date, max_connections, etc.
```

### Streams en vivo

```bash
# Listado de canales activos
curl "http://192.168.1.250:3000/player_api.php?username=admin&password=admin123&action=get_live_streams"

# Listado de categorías
curl "http://192.168.1.250:3000/player_api.php?username=admin&password=admin123&action=get_live_categories"

# Canales de una categoría específica
curl "http://192.168.1.250:3000/player_api.php?username=admin&password=admin123&action=get_live_streams&category_id=2"
```

### Reproducción

```bash
# URL para reproducir un canal (redirect 302 al stream real)
# {stream_id} es el campo stream_id de la tabla channels
http://192.168.1.250:3000/live/admin/admin123/{stream_id}.ts

# Ejemplo con ffplay:
ffplay "http://192.168.1.250:3000/live/admin/admin123/101.ts"
```

### M3U y EPG

```bash
# M3U completo (todos los canales activos)
curl "http://192.168.1.250:3000/get.php?username=admin&password=admin123&type=m3u"

# M3U por categoría
curl "http://192.168.1.250:3000/get.php?username=admin&password=admin123&type=m3u&cat=2"

# EPG XMLTV consolidado
curl "http://192.168.1.250:3000/xmltv.php?username=admin&password=admin123"
```

### VOD y Series (respuestas vacías, estructura implementada)

```bash
curl "http://192.168.1.250:3000/player_api.php?username=admin&password=admin123&action=get_vod_streams"
curl "http://192.168.1.250:3000/player_api.php?username=admin&password=admin123&action=get_series"
```

---

## Admin API (`/admin/`)

Todos los endpoints de admin son internos (no requieren auth por ahora, accesibles en red local).

### Health y Stats

```bash
# Health check
curl http://192.168.1.250:3000/health
# {"status":"ok","version":"1.0.0","name":"JaiboTV","time":"..."}

# Stats generales del sistema
curl http://192.168.1.250:3000/admin/stats
# Devuelve conteos de canales, EPG, logos, usuarios, fuentes M3U
```

### Canales

```bash
# Listado con filtros opcionales
curl "http://192.168.1.250:3000/admin/channels"
curl "http://192.168.1.250:3000/admin/channels?category_id=2"
curl "http://192.168.1.250:3000/admin/channels?search=ESPN"
curl "http://192.168.1.250:3000/admin/channels?status=error"

# Detalle de un canal
curl http://192.168.1.250:3000/admin/channels/101

# Actualizar canal
curl -X PATCH http://192.168.1.250:3000/admin/channels/101 \
  -H "Content-Type: application/json" \
  -d '{"name":"ESPN MX","epg_id":"ESPN.mx","enabled":1}'

# Habilitar / deshabilitar
curl -X POST http://192.168.1.250:3000/admin/channels/101/enable
curl -X POST http://192.168.1.250:3000/admin/channels/101/disable

# Eliminar
curl -X DELETE http://192.168.1.250:3000/admin/channels/101

# Auto-match logo para un canal
curl http://192.168.1.250:3000/admin/channels/101/auto-logo
# Con apply=true aplica el logo encontrado:
curl "http://192.168.1.250:3000/admin/channels/101/auto-logo" \
  -X POST -H "Content-Type: application/json" -d '{"apply":true}'

# Auto-logo masivo (todos los canales sin logo)
curl -X POST http://192.168.1.250:3000/admin/channels/bulk-auto-logo
```

### Stream Checker

```bash
# Stats de verificación de streams
curl http://192.168.1.250:3000/admin/streams/stats

# Verificar todos los streams (corre en background, ~2-5 min)
curl -X POST http://192.168.1.250:3000/admin/streams/check-all
```

### Scrapers (tvtv y tvpori)

```bash
# Forzar scrape tvtvhd.com (12 canales premium)
curl -X POST http://192.168.1.250:3000/admin/tvtv/scrape

# Forzar scrape tvporinternet2.com (69 canales)
# (verificar nombre exacto del endpoint en admin.js)
curl -X POST http://192.168.1.250:3000/admin/tvpori/scrape
```

### Fuentes M3U

```bash
# Listado de fuentes
curl http://192.168.1.250:3000/admin/sources/m3u

# Forzar refresh de una fuente
curl -X POST http://192.168.1.250:3000/admin/sources/m3u/4/refresh

# Habilitar / deshabilitar fuente
curl -X PATCH http://192.168.1.250:3000/admin/sources/m3u/1 \
  -H "Content-Type: application/json" -d '{"enabled":1}'
```

### Fuentes EPG

```bash
# Listado de fuentes EPG
curl http://192.168.1.250:3000/admin/sources/epg

# Forzar refresh de todas las fuentes EPG
curl -X POST http://192.168.1.250:3000/admin/sources/epg/refresh-all

# Refresh de una fuente específica
curl -X POST http://192.168.1.250:3000/admin/sources/epg/1/refresh

# Preview de EPG para un epg_id
curl "http://192.168.1.250:3000/admin/epg/preview?epg_id=ESPN.mx"
```

### Cache M3U

```bash
# Stats del cache
curl http://192.168.1.250:3000/admin/m3u-cache/stats

# Invalidar cache manualmente
curl -X POST http://192.168.1.250:3000/admin/m3u-cache/invalidate
```

### Monitoreo de IP pública

```bash
# Status actual de IP pública
curl http://192.168.1.250:3000/admin/system/ip-status
# Devuelve IP actual, historial de cambios, última detección
```

---

## Admin Panel Web

Interfaz visual en: `http://192.168.1.250:3000/admin/`

Secciones disponibles en el SPA:
- **Dashboard** — stats generales, fuentes M3U y EPG
- **Canales** — lista completa con filtros, edición, EPG picker, logo picker
- **Stream Checker** — verificar y ver status de streams
- **Fuentes M3U** — administrar fuentes, forzar refresh
- **Fuentes EPG** — administrar fuentes, forzar refresh
- **Usuarios** — gestión de credenciales Xtream

---

## Notas sobre autenticación

- La API Xtream valida `username` + `password` en cada request
- La Admin API no tiene auth (solo accesible en red local por ahora)
- **Pendiente antes de exposición pública:** cambiar credenciales `admin/admin123` y agregar auth a endpoints de admin

---

## Tiempos de respuesta esperados

| Endpoint | Tiempo normal |
|---|---|
| `/health` | < 5ms |
| `/player_api.php` (listado) | 1-3ms |
| `/get.php` (M3U, desde cache) | < 5ms |
| `/get.php` (M3U, sin cache) | 100-500ms |
| `/xmltv.php` (EPG) | ~1.2s |
| `/live/{stream_id}.ts` (redirect) | < 10ms |

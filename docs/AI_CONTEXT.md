# JaiboTV — Contexto para IA

> **Lee este archivo PRIMERO al iniciar cualquier sesión.**
> Después consulta los archivos en orden según necesites más contexto:
> 1. `docs/handoff.md` — estado AHORA, último trabajo y siguiente paso
> 2. `docs/architecture.md` — cómo está armado el sistema
> 3. `docs/bugs.md` — qué está roto y lecciones aprendidas
> 4. `docs/roadmap.md` — qué sigue
> 5. `docs/api.md`, `docs/infra.md`, `docs/sources.md` — referencia detallada

---

## Qué es JaiboTV

Servidor IPTV personal corriendo en hardware propio (HP EliteBook 840 G7, Ubuntu 22.04). Expone una API compatible con **Xtream Codes** (clientes IPTV Smarters, IPTVx, TiviMate), tiene panel admin web, motor EPG con búsqueda fuzzy, scrapers automáticos para fuentes con tokens dinámicos, y manejo de logos.

## Quién es Gustavo

Gustavo Grajales (`gustavograjales` en GitHub). Trabaja en este proyecto como desarrollo personal. Accede al servidor vía SSH desde Windows 11.

## Cómo responderle

- **Idioma:** español, directo, sin rodeos ni disclaimers innecesarios
- **Código:** soluciones completas y probadas, no fragmentos sueltos
- **Comandos:** listos para copiar/pegar, indicando si requieren `sudo`
- **Cambios en archivos existentes:** mostrar el diff o la sección exacta a modificar, no todo el archivo
- **Cambios grandes:** preguntar antes de proponer refactors mayores
- **Información faltante:** pedirla explícitamente (logs, configs, estado actual)
- **Antes de proponer una causa raíz, pedir un query verificador.** No asumir.

## Stack técnico

- **Runtime:** Node.js 20.20.2 LTS
- **Framework:** Fastify 4.x
- **Base de datos:** SQLite (better-sqlite3) — `data/iptv.db` (~2.6 MB)
- **Process manager:** PM2 (procesos `jaibotv` + `temp-monitor`)
- **Reverse proxy:** Nginx (instalado, escuchando :80, **sin reverse proxy configurado** todavía)
- **Otros:** Docker, ffmpeg, UFW firewall
- **Dependencia destacada:** `undici` v7.x para fallback TLS condicional ante certs expirados
- **Sistema de diseño:** JAIBO Design System (CSS variables + theme.ts + Tailwind opcional)

## Servidor

- **Hardware:** HP EliteBook 840 G7 (i5-10310U, 32GB RAM, 256GB SSD)
- **OS:** Ubuntu 22.04 LTS minimal
- **IP local fija:** `192.168.1.250`
- **Hostname:** `jaibotv`
- **Acceso SSH:** `ssh ggajales@192.168.1.250`
- **Path del proyecto:** `/home/ggajales/iptv-server/`

## Convenciones del código

- **ES Modules** (`import/export`), no CommonJS
- **Timezones:** UTC en DB (estándar industrial), CST solo en UI vía helper `formatLocalCST()`
- **Tokens de diseño:** SIEMPRE usar `src/styles/tokens.css`. NUNCA hardcodear colores, spacing o radius
- **Commits:** mensajes descriptivos en español
- **Paths:** absolutos en imports cuando sea posible

## Decisiones arquitectónicas clave

1. **Xtream Codes API** para compatibilidad universal con clientes IPTV
2. **M3U devuelve URLs proxy** del tipo `/live/admin/admin123/{stream_id}.ts`, no URLs directas (los tokens del origen rotan cada pocas horas)
3. **EPG se consolida desde 25 fuentes** con columna `priority` (menor = mayor prioridad) para resolver conflictos cuando varias fuentes publican el mismo `epg_id`
4. **Streams se verifican cada 6h** con UA Chrome (NO `curl` ni `VLC` — tvporinternet2 los bloquea)
5. **TLS:** undici dispatcher por request específico, NUNCA `NODE_TLS_REJECT_UNAUTHORIZED='0'` global (afecta TODO el proceso)
6. **Cache M3U en memoria** con TTL=60s + invalidación explícita en eventos
7. **Scrapers escriben directo a la tabla `channels`** (deuda: necesita validador para importaciones masivas, ver `docs/roadmap.md`)

## Endpoints principales

- **Admin Panel:** http://192.168.1.250:3000/admin/
- **Xtream API:** http://192.168.1.250:3000 (user: `admin`, pass: `admin123`)
- **M3U:** `http://192.168.1.250:3000/get.php?username=admin&password=admin123&type=m3u`
- **EPG (XMLTV):** `http://192.168.1.250:3000/xmltv.php?username=admin&password=admin123`
- **Health:** http://192.168.1.250:3000/health
- **Stats:** http://192.168.1.250:3000/admin/stats

Detalle completo en `docs/api.md`.

## Lecciones críticas (no repetir errores)

1. **Heredocs largos en SSH se corrompen.** La terminal hace line-wrap en strings largos al pegar. Para scripts grandes: escribir a archivo (`cat > /tmp/x.sql << 'EOF' ... EOF` y luego `sqlite3 < /tmp/x.sql`) o usar base64 / scp. NUNCA pegar bloques largos directamente al stdin de sqlite3 o python.
2. **`NODE_TLS_REJECT_UNAUTHORIZED='0'` es global al proceso.** NUNCA usarlo. Solución correcta: `dispatcher` de undici con `Agent({ connect: { rejectUnauthorized: false } })` SOLO para esa request específica.
3. **fast-xml-parser v4 tiene límite hardcoded de 1000 entity expansions.** `processEntities: false` lo desactiva sin riesgo real. Los strings quedan con `&amp;` literal pero se renderizan correctamente como `&` en HTML.
4. **El servidor de tvpori bloquea con `Referer` del propio sitio** — anti-hotlinking inverso. NO enviar `Referer` desde streamChecker.
5. **`pm2 restart` NO recarga `NODE_OPTIONS` ni env vars.** Para aplicar cambios en `ecosystem.config.cjs`: `pm2 delete + pm2 start` o `pm2 restart --update-env`.
6. **No asumir causa raíz sin verificar con un query.** Errores documentados de sesiones pasadas: asumir bugs activos cuando ya estaban resueltos, asumir duplicación masiva sin validar, ejecutar scripts SQL sobre suposiciones.

## Para contexto profundo, leer en orden

1. `docs/handoff.md` ← qué se hizo en la última sesión
2. `docs/architecture.md` ← cómo está armado
3. `docs/bugs.md` ← qué está roto y por qué
4. `docs/roadmap.md` ← qué sigue
5. `docs/api.md`, `docs/infra.md`, `docs/sources.md` ← referencia
6. `docs/design-system.md` ← sistema de diseño JAIBO

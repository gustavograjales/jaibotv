# JaiboTV — CLAUDE.md

> Archivo de instrucciones para Claude Code y otros agentes de IA.
> Para contexto completo del proyecto, leer `docs/AI_CONTEXT.md` primero.

---

## Quién soy

Gustavo Grajales (`gustavograjales` en GitHub). JaiboTV es mi servidor IPTV personal.
Accedo al servidor vía SSH desde Windows 11.

## Cómo responderme

- **Idioma:** español, directo, sin rodeos ni disclaimers innecesarios
- **Código:** soluciones completas y probadas, no fragmentos sueltos
- **Comandos:** listos para copiar/pegar, indicando si requieren `sudo`
- **Cambios en archivos existentes:** muéstrame el diff o la sección exacta, no todo el archivo
- **Cambios grandes:** pregúntame antes de proponer refactors mayores
- **Información faltante:** pídemela explícitamente (logs, configs, estado actual)
- **Antes de concluir una causa raíz:** pide un query o comando verificador. No asumir.

## Dónde está todo

| Archivo | Para qué |
|---|---|
| `docs/AI_CONTEXT.md` | Stack, decisiones, convenciones — leer primero en cada sesión |
| `docs/handoff.md` | Estado de la última sesión + siguiente paso recomendado |
| `docs/architecture.md` | Estructura del proyecto y flujos de datos |
| `docs/infra.md` | Hardware, red, PM2, backups, comandos operativos |
| `docs/api.md` | Endpoints admin + Xtream con ejemplos curl |
| `docs/roadmap.md` | Fases del proyecto + tareas pendientes priorizadas |
| `docs/bugs.md` | Bugs activos numerados + lecciones aprendidas |
| `docs/sources.md` | Catálogo de scrapers, fuentes M3U y EPG |
| `docs/design-system.md` | Sistema de diseño JAIBO (tokens, componentes, paleta) |

## Datos rápidos del servidor

- **IP local:** `192.168.1.250`
- **SSH:** `ssh ggajales@192.168.1.250`
- **Proyecto:** `/home/ggajales/iptv-server/`
- **Admin:** `http://192.168.1.250:3000/admin/`
- **Health:** `http://192.168.1.250:3000/health`
- **Stack:** Node.js 20 + Fastify 4 + SQLite (better-sqlite3) + PM2

## Lecciones críticas (respetar siempre)

1. **Heredocs largos en SSH se corrompen.** Scripts grandes: escribir a archivo y ejecutar separado. NUNCA pegar bloques de SQL/Python directamente en stdin de sqlite3/python en SSH.
2. **`NODE_TLS_REJECT_UNAUTHORIZED='0'` es global.** Nunca usarlo. Usar undici dispatcher por request.
3. **`pm2 restart` NO recarga env vars.** Usar `pm2 restart --update-env` o `pm2 delete + pm2 start`.
4. **No asumir causa raíz.** Siempre pedir un query/comando verificador antes de proponer fix.

## Recordatorio al cerrar sesión

Cuando terminemos una sesión importante, recuérdame:
1. Actualizar `docs/handoff.md` con estado actual, archivos tocados y siguiente paso
2. Hacer commit con mensaje descriptivo
3. Si hay cambios grandes, actualizar `docs/AI_CONTEXT.md` o el archivo relevante en `docs/`

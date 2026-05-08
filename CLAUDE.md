# JaiboTV — CLAUDE.md

> Archivo de instrucciones para Claude Code y otros agentes de IA.
> Para contexto completo del proyecto, leer `docs/AI_CONTEXT.md` primero.

---

## Cómo arrancar cada sesión

Antes de responder cualquier cosa sustantiva sobre el proyecto, leer
en este orden:

1. `CLAUDE.md` (este archivo) — reglas de comportamiento e índice
2. `docs/AI_CONTEXT.md` — stack, convenciones, decisiones arquitectónicas
3. `docs/handoff.md` — qué se hizo en la última sesión y siguiente paso

Luego, según lo que pida Gustavo, consultar el archivo específico:
`docs/architecture.md`, `docs/infra.md`, `docs/api.md`, `docs/roadmap.md`,
`docs/bugs.md`, `docs/sources.md`, `docs/design-system.md`.

## Cómo responderle a Gustavo

- **Idioma:** español, directo, sin rodeos ni disclaimers innecesarios
- **Código:** soluciones completas y probadas, no fragmentos sueltos
- **Comandos de terminal:** listos para copiar/pegar, indicando si requieren `sudo`
- **Cambios en archivos existentes:** mostrar el diff o la sección exacta, no todo el archivo
- **Antes de proponer refactors o cambios grandes:** preguntar
- **Antes de concluir una causa raíz:** pedir un query/comando verificador. No asumir.
- **Información que no se tenga (logs, configs, estado actual):** pedirla explícitamente

## Dónde está todo

| Archivo | Para qué sirve | Cuándo se actualiza |
|---|---|---|
| `CLAUDE.md` | Reglas de comportamiento + índice a docs/ | Casi nunca |
| `docs/AI_CONTEXT.md` | Onboarding rápido para cualquier IA nueva | Cuando cambian convenciones o stack |
| `docs/architecture.md` | Cómo está construido el sistema | Cuando se agrega un módulo nuevo |
| `docs/infra.md` | Cómo correr/operar el servidor | Cuando cambia hardware, red o configs |
| `docs/api.md` | Referencia de endpoints | Cuando se agrega/modifica endpoint |
| `docs/roadmap.md` | Plan a futuro y fases completadas | Al cerrar fase o agregar tarea |
| `docs/handoff.md` | Memoria entre sesiones | **Cada sesión de trabajo** |
| `docs/bugs.md` | Bugs activos + resueltos + lecciones | Cuando aparece o se cierra bug |
| `docs/sources.md` | Catálogo de scrapers y fuentes | Cuando se agrega/quita fuente |
| `docs/design-system.md` | Sistema de diseño JAIBO | Cuando se agrega componente o token |

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

## Protocolo de cierre de sesión

**Al terminar CADA sesión de trabajo, antes del commit final, la IA debe recordarle a Gustavo actualizar la documentación.** La regla es simple: si algo cambió, el archivo correspondiente debe reflejarlo.

### Qué actualizar según lo que ocurrió

| Si en la sesión... | Actualizar |
|---|---|
| Se implementó algo nuevo o se completó una fase | `docs/roadmap.md` — marcar como ✅, agregar fecha |
| Se descubrió o se cerró un bug | `docs/bugs.md` — agregar/tachar bug, agregar lección si aplica |
| Se agregó o quitó un endpoint | `docs/api.md` |
| Se agregó o quitó una fuente (M3U, EPG, scraper) | `docs/sources.md` |
| Cambió hardware, red, PM2 o configs del servidor | `docs/infra.md` |
| Se agregó un módulo o cambió la arquitectura | `docs/architecture.md` |
| Cambiaron convenciones, stack o decisiones de diseño | `docs/AI_CONTEXT.md` |
| **Siempre, en toda sesión** | `docs/handoff.md` — estado actual, archivos tocados, decisiones, siguiente paso |

### Checklist de cierre (la IA lo recita al final, antes de proponer commit)

```
[ ] docs/handoff.md actualizado con:
      - qué se hizo
      - archivos modificados
      - decisiones tomadas
      - bugs nuevos/cerrados
      - siguiente paso recomendado
[ ] Otros docs/ actualizados según la tabla de arriba
[ ] git add + git commit con formato definido abajo
[ ] git push
```

### Commit final de sesión

```bash
cd ~/iptv-server
git add docs/ CLAUDE.md
git commit -m "docs: actualizar handoff + [qué cambió] — sesión YYYY-MM-DD"
git push
```

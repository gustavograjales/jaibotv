# Infraestructura

## Update 2026-05-15 — MUDANZA

### Mudanza física a casa
- **Apagado:** viernes 15-may ~16:00 CST en oficina (Telmex, 192.168.1.250)
- **Encendido:** sábado 16-may en casa (Totalplay FO, red 192.168.100.x, router Huawei HG8145V5)
- **Conexión:** WiFi en ambos lados (NO cable ethernet)

### Hallazgo crítico: interfaz de red
- **Servidor usa WiFi:** `wlp0s20f3` (no `eno1` ni `enp0s*`)
- **MAC WiFi:** `70:9C:D1:17:95:58` → usar para reservar IP estática en el router de casa
- Netplan usa NetworkManager (no IP estática hardcoded en yaml), facilita cambio de red

### Estado al apagado
- 473 canales activos
- 315 con external_id (todos tvpori)
- PM2 jaibotv online, uptime 2h, 144 MB
- Docker `epg-iptv-org` corriendo (8d, huérfano)
- Disco: 7% usado

### Backups pre-mudanza
- DB: `~/backups/db/iptv_pre-mudanza_20260515_142618.db` (2.6 MB)
- Proyecto: `~/backups/iptv-server-pre-mudanza-20260515_142623.tar.gz` (2.3 MB)
- Network state: `~/network-pre-mudanza.txt`
- Papelito: `~/papelito-mudanza.txt`

 — JaiboTV

## Hardware

| Componente | Detalle |
|---|---|
| Equipo | HP EliteBook 840 G7 |
| CPU | Intel Core i5-10310U |
| RAM | 32 GB |
| Disco | 256 GB SSD NVMe (~20 GB usados) |
| Red | WiFi (wlp0s20f3) — considerar cable Ethernet para mejor latencia |
| MAC | `70:9c:d1:17:95:58` |

## Red

| Parámetro | Valor |
|---|---|
| IP local fija | `192.168.1.250` |
| Gateway | `192.168.1.254` (Huawei HG8145V5V3 Infinitum) |
| DNS | `1.1.1.1`, `8.8.8.8` |
| Conexión WiFi | INFINITUM44AC |
| IP pública | dinámica (Telmex) — última conocida: `189.175.131.95` |
| IPv6 | disponible (Telmex asigna IPv6 enrutable) |

La IP fija está configurada en el **servidor** vía NetworkManager, no en el router (la reserva DHCP del router no funcionaba):

```bash
# Ver configuración actual
nmcli connection show "INFINITUM44AC" | grep -E "ipv4\.(addresses|gateway|dns|method)"

# Reconfigurar si es necesario (requiere sudo)
sudo nmcli connection modify "INFINITUM44AC" \
  ipv4.addresses 192.168.1.250/24 \
  ipv4.gateway 192.168.1.254 \
  ipv4.dns "1.1.1.1,8.8.8.8" \
  ipv4.method manual
sudo nmcli connection up "INFINITUM44AC"
```

**Nota:** esta config solo aplica a la red `INFINITUM44AC`. En otras redes WiFi el equipo usa DHCP normal.

## Sistema Operativo

- Ubuntu 22.04 LTS minimal
- Hostname: `jaibotv`
- Usuario: `ggajales`
- Acceso SSH: `ssh ggajales@192.168.1.250`

## Puertos abiertos (UFW)

```bash
sudo ufw status
# 22   (SSH)
# 80   (HTTP — Nginx)
# 443  (HTTPS — pendiente configurar)
# 3000 (Node.js — JaiboTV)
```

## Runtime

- **Node.js:** 20.20.2 LTS
- **npm:** instalado con Node
- **PM2:** global (`npm install -g pm2`)
- **ffmpeg:** instalado (sin uso activo aún)
- **Docker:** instalado (sin uso activo aún)
- **Nginx:** instalado, escuchando :80, **sin reverse proxy configurado aún**

## PM2 — Procesos activos

| ID | Nombre | Modo | Descripción |
|---|---|---|---|
| 0 | `temp-monitor` | fork | Script bash de monitoreo de temperatura |
| 1 | `jaibotv` | fork | Servidor principal JaiboTV |

### Configuración PM2 (`ecosystem.config.cjs`)

```js
// Puntos clave:
NODE_OPTIONS: '--max-old-space-size=512'  // heap 512MB
max_memory_restart: '800M'               // restart si supera 800MB
node_env: 'production'
```

**Importante:** `pm2 restart` NO recarga `NODE_OPTIONS` ni env vars. Para aplicar cambios en `ecosystem.config.cjs`:

```bash
pm2 delete jaibotv
pm2 start ecosystem.config.cjs
# O alternativamente:
pm2 restart jaibotv --update-env
```

### Comandos PM2 de uso frecuente

```bash
# Estado y métricas
pm2 status
pm2 info jaibotv

# Logs (últimas 50 líneas, sin seguir)
pm2 logs jaibotv --lines 50 --nostream

# Solo errores
pm2 logs jaibotv --lines 100 --nostream --err

# Solo stdout
pm2 logs jaibotv --lines 100 --nostream --out

# Reiniciar servidor (sin perder config)
pm2 restart jaibotv

# Parar / iniciar
pm2 stop jaibotv
pm2 start jaibotv

# Guardar estado para que PM2 levante al boot
pm2 save
pm2 startup   # genera el comando de systemd

# Profiling de memoria
pm2 trigger jaibotv km:heapdump
```

## Backups

### Backup automático diario (04:00)

Corre automáticamente y guarda en `~/backups/db/`:

```
~/backups/db/iptv_YYYYMMDD.db
```

**Confirmado que existe y funciona** (verificado 2026-05-07). Contrario a lo que decía CLAUDE.md anterior, este backup SÍ estaba activo.

### Backup manual rápido

```bash
mkdir -p ~/backups/db
cp ~/iptv-server/data/iptv.db ~/backups/db/iptv_$(date +%Y%m%d_%H%M%S).db
```

### Backup completo pre-cambios destructivos

```bash
BACKUP_DIR=~/backups/pre-cambio-$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
sqlite3 ~/iptv-server/data/iptv.db ".backup '$BACKUP_DIR/iptv.db'"
cd ~/iptv-server && git bundle create $BACKUP_DIR/git-full.bundle --all
pm2 save --force && cp ~/.pm2/dump.pm2 $BACKUP_DIR/
echo "Backup en: $BACKUP_DIR"
```

### Restore desde backup

```bash
pm2 stop jaibotv
cp ~/backups/db/iptv_YYYYMMDD.db ~/iptv-server/data/iptv.db
# Verificar integridad:
sqlite3 ~/iptv-server/data/iptv.db "PRAGMA integrity_check; SELECT COUNT(*) FROM channels WHERE enabled=1;"
pm2 start jaibotv
```

## Diagnóstico rápido del servidor

```bash
# Estado general de una sola pasada
pm2 status
free -h
df -h /
curl -s http://localhost:3000/health

# IP pública actual
curl -s https://api.ipify.org && echo

# Stats de canales
sqlite3 ~/iptv-server/data/iptv.db \
  "SELECT stream_status, COUNT(*) FROM channels WHERE enabled=1 GROUP BY stream_status;"

# Ver logs de errores recientes
pm2 logs jaibotv --lines 50 --nostream --err

# Ver crones ejecutados
pm2 logs jaibotv --lines 100 --nostream --out | grep cron
```

## Nginx

Instalado pero **sin reverse proxy configurado aún**. Escucha en :80 con la config default de Ubuntu.

Cuando se configure (Fase 5 del roadmap), el flujo será:

```
Internet → :80/:443 (Nginx) → proxy_pass → :3000 (JaiboTV)
```

Config pendiente:

```nginx
# /etc/nginx/sites-available/jaibotv
server {
    listen 80;
    server_name tudominio.duckdns.org;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## CPU Governor

Configurado en `performance` para evitar throttling durante streaming:

```bash
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor
# performance

# Si vuelve a `powersave` tras reboot:
echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
```

## Suspensión deshabilitada

El equipo está configurado para no suspenderse (servidor 24/7):

```bash
# Verificar
systemctl status sleep.target suspend.target hibernate.target

# Si es necesario deshabilitar de nuevo:
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

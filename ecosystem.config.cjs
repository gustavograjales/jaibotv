module.exports = {
  apps: [{
    name: 'jaibotv',
    script: './src/server.js',
    cwd: '/home/ggajales/iptv-server',
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '600M',
    env: {
      NODE_ENV: 'production',
      NODE_OPTIONS: '--max-old-space-size=512'
    },
    error_file: '/home/ggajales/.pm2/logs/jaibotv-error.log',
    out_file: '/home/ggajales/.pm2/logs/jaibotv-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    time: true
  }]
}

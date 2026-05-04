const isDev = process.env.NODE_ENV !== 'production'

export default {
  env: isDev ? 'development' : 'production',
  port: parseInt(process.env.PORT || '3000'),
  host: '0.0.0.0',
  db: {
    path: process.env.DB_PATH || './data/iptv.db',
  },
  admin: {
    username: process.env.ADMIN_USER || 'admin',
    password: process.env.ADMIN_PASS || 'admin123',
  },
  scheduler: {
    m3uCron:  '0 3 */7 * *',
    epgCron:  '0 4 */7 * *',
    enabled: true,
  },
  cache: {
    epgDir: './data/epg-cache',
    m3uDir: './data/m3u-cache',
    epgDays: 7,
  },
  http: {
    timeout: 30000,
    retries: 2,
  },
  defaultEpgSources: [
    { name: 'EPG México',  url: 'https://epg.pw/xmltv/epg_MX.xml', country: 'MX', enabled: true },
    { name: 'EPG España',  url: 'https://epg.pw/xmltv/epg_ES.xml', country: 'ES', enabled: true },
    { name: 'EPG LATAM',   url: 'https://epg.pw/xmltv/epg_PA.xml', country: 'LATAM', enabled: true },
    { name: 'EPG USA',     url: 'https://epg.pw/xmltv/epg_US.xml', country: 'US', enabled: false },
  ],
  SERVER_IP: process.env.SERVER_IP || '192.168.1.250',
}



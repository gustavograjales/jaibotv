import { getDb } from '../db/schema.js'
import config from '../../config.js'
import { generateConsolidatedEPG } from '../core/epgEngine.js'
import { generateM3U } from '../core/aggregator.js'

function authUser(username, password) {
  return getDb().prepare(`SELECT * FROM users WHERE username=? AND password=? AND status='active'`).get(username, password)
}

function userInfo(user) {
  return {
    username: user.username, password: user.password,
    message: 'Welcome', auth: 1, status: 'Active',
    exp_date: user.expires_at ? String(Math.floor(new Date(user.expires_at).getTime()/1000)) : null,
    is_trial: '0', active_cons: '0',
    created_at: String(Math.floor(new Date(user.created_at).getTime()/1000)),
    max_connections: String(user.max_streams||1),
    allowed_output_formats: ['ts','m3u8','rtmp'],
  }
}

function serverInfo(req) {
  const ip = config.SERVER_IP
  const port = config.port || 3000
  const base = `http://${ip}:${port}`
  return {
    url: base,
    port: String(port),
    https_port: '443',
    rtmp_port: '1935',
    timezone: 'America/Mexico_City',
    time_now: new Date().toISOString().replace('T',' ').slice(0,19)
  }
}

function streamEntry(ch, req) {
  const host = (req.headers["x-forwarded-host"] || req.hostname || "").split(":")[0] || config.SERVER_IP; const base = `${req.protocol||"http"}://${host}:${req.server?.port||3000}`;
  const url = ch.url_fhd||ch.url_hd||ch.url_sd||''
  const ext = url.includes('.m3u8')?'m3u8':'ts'
  return {
    num: ch.stream_id, name: ch.name, stream_type:'live',
    stream_id: ch.stream_id, stream_icon: ch.logo||'',
    epg_channel_id: ch.epg_id||'',
    added: String(Math.floor(new Date(ch.created_at||Date.now()).getTime()/1000)),
    category_id: String(ch.category_id||0),
    category_ids: [ch.category_id||0],
    tv_archive: 0, tv_archive_duration: 0,
    direct_source: '',
    stream_url: `${base}/live/${ch.stream_id}.${ext}`,
  }
}

function stubEPG(ch, count=4) {
  const now = Math.floor(Date.now()/1000)
  return Array.from({length:count},(_,i)=>({
    id: String(ch.stream_id*100+i),
    epg_id: ch.epg_id||String(ch.stream_id),
    title: Buffer.from(ch.name).toString('base64'),
    lang: 'es',
    start: String(now+i*3600),
    end: String(now+(i+1)*3600),
    description: Buffer.from('').toString('base64'),
    channel_id: ch.epg_id||String(ch.stream_id),
    start_timestamp: String(now+i*3600),
    stop_timestamp: String(now+(i+1)*3600),
    now_playing: i===0?1:0, has_archive:0,
  }))
}

export default async function xtreamRoutes(fastify) {

  fastify.get('/player_api.php', async (req, reply) => {
    const { username, password, action, category_id, stream_id } = req.query
    const user = authUser(username, password)
    if (!user) return reply.code(403).send({ user_info:{ auth:0 }, server_info:{} })
    const db = getDb()
    if (!action) return { user_info: userInfo(user), server_info: serverInfo(req) }

    switch(action) {
      case 'get_live_categories':
        return db.prepare(`SELECT c.id,c.name,COUNT(ch.id) as channel_count FROM categories c LEFT JOIN channels ch ON ch.category_id=c.id AND ch.enabled=1 GROUP BY c.id HAVING channel_count>0 ORDER BY c.sort_order,c.name`).all()
          .map(c=>({ category_id:String(c.id), category_name:c.name, parent_id:0 }))

      case 'get_live_streams': {
        let q=`SELECT c.*,cat.name as cat_name FROM channels c LEFT JOIN categories cat ON c.category_id=cat.id WHERE c.enabled=1`
        const p=[]
        if (category_id) { q+=` AND c.category_id=?`; p.push(category_id) }
        q+=` ORDER BY cat.sort_order,c.sort_order,c.name`
        return db.prepare(q).all(...p).map(ch=>streamEntry(ch,req))
      }

      case 'get_vod_categories': return []
      case 'get_vod_streams':    return []
      case 'get_series_categories': return []
      case 'get_series':         return []
      case 'get_series_info':    return { info:{}, episodes:{} }
      case 'get_vod_info':       return { info:{}, movie_data:{} }

      case 'get_short_epg': {
        if (!stream_id) return { epg_listings:[] }
        const ch = db.prepare(`SELECT * FROM channels WHERE stream_id=?`).get(stream_id)
        if (!ch||!ch.epg_id) return { epg_listings:[] }
        return { epg_listings: stubEPG(ch,4) }
      }

      default: return { error:`Unknown action: ${action}` }
    }
  })

  fastify.get('/get.php', async (req, reply) => {
    const { username, password, type, category_id } = req.query
    const user = authUser(username, password)
    if (!user) return reply.code(403).send('Unauthorized')
    if (type==='m3u'||type==='m3u_plus') {
    const epgUrl = `${req.protocol||"http"}://${(req.headers["x-forwarded-host"]||req.hostname||config.SERVER_IP).split(":")[0]}:${req.server?.port||3000}/xmltv.php?username=${username}&password=${password}`
      const m3u = generateM3U({ epgUrl, catId: category_id||null })
      reply.header('Content-Type','application/x-mpegurl; charset=utf-8')
      reply.header('Content-Disposition','attachment; filename="playlist.m3u"')
      return reply.send(m3u)
    }
    return reply.code(400).send({ error:'Invalid type' })
  })

  fastify.get('/xmltv.php', async (req, reply) => {
    const { username, password } = req.query
    if (!authUser(username, password)) return reply.code(403).send('Unauthorized')
    reply.header('Content-Type','application/xml; charset=utf-8')
    return reply.send(generateConsolidatedEPG())
  })

  fastify.get('/live/:username/:password/:streamFile', async (req, reply) => {
    const { username, password, streamFile } = req.params
    if (!authUser(username, password)) return reply.code(403).send('Unauthorized')
    const streamId = parseInt(streamFile.replace(/\.[^.]+$/,''))
    const db = getDb()
    const ch = db.prepare(`SELECT * FROM channels WHERE stream_id=?`).get(streamId)
    if (!ch) return reply.code(404).send('Not found')

    // Obtener mejor URL disponible (prioridad: stream_sources → columnas originales)
    let url = null
    try {
      const src = db.prepare(`
        SELECT url FROM stream_sources
        WHERE channel_id=? AND status = 'ok'
        ORDER BY priority ASC LIMIT 1
      `).get(ch.id)
      url = src?.url
    } catch(e) {}

    // Fallback a columnas originales
    if (!url) url = ch.url_fhd || ch.url_hd || ch.url_sd

    if (!url) return reply.code(404).send('No stream URL')

    // Redirect directo — sin verificar HEAD (más rápido, compatible con más streams)
    return reply.redirect(302, url)
  })

  fastify.get('/movie/:username/:password/:file',  async (req,reply) => reply.code(404).send('VOD not configured'))
  fastify.get('/series/:username/:password/:file', async (req,reply) => reply.code(404).send('Series not configured'))
}

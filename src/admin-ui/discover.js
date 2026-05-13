// JaiboTV — Discover UI
// Vista de descubrimiento tvpori: preview, edición y import

let state = {
  page: 1,
  totalPages: 1,
  total: 0,
  hostFilter: 'both',
  currentItem: null,
  hls: null,
  detectedQuality: null,
  categories: [],
  countries: ['MX', 'AR', 'ES', 'US', 'CO', 'PE', 'CL', 'BR', ''],
}

const $ = (id) => document.getElementById(id)

function toast(msg, type = 'info') {
  const t = $('toast')
  t.textContent = msg
  t.className = `toast show ${type}`
  setTimeout(() => t.classList.remove('show'), 3500)
}

function logMsg(msg, type = '') {
  const log = $('preview-log')
  if (!log) return
  const span = document.createElement('span')
  span.className = type
  span.textContent = msg + '\n'
  log.appendChild(span)
  log.scrollTop = log.scrollHeight
}

function classifyQuality(width, height) {
  if (!width || !height) return null
  const pixels = width * height
  if (pixels >= 1920 * 1080) return { label: 'FHD', desc: `${width}×${height}` }
  if (pixels >= 1280 * 720)  return { label: 'HD',  desc: `${width}×${height}` }
  if (pixels >= 640 * 360)   return { label: 'SD',  desc: `${width}×${height}` }
  return { label: 'LOW', desc: `${width}×${height}` }
}

function cleanupVideo() {
  if (state.hls) {
    try { state.hls.destroy() } catch(e) {}
    state.hls = null
  }
  const v = $('preview-video-el')
  if (v) {
    v.pause()
    v.removeAttribute('src')
    v.load()
  }
}

async function loadStats() {
  try {
    const r = await fetch('/admin/tvpori/discover/last')
    const data = await r.json()
    if (!data.available) {
      $('content').innerHTML = `<div class="empty-state"><h2>Sin descubrimientos previos</h2><p>Lanza un barrido tvpori primero desde el endpoint POST /admin/tvpori/discover</p></div>`
      return false
    }
    let totalAlive = 0, totalInDb = 0
    for (const info of Object.values(data.summary)) {
      totalAlive += info.alive
      totalInDb += info.in_db
    }
    $('stat-total').textContent = totalAlive
    $('stat-imported').textContent = totalInDb
    return true
  } catch (e) {
    toast('Error cargando stats: ' + e.message, 'error')
    return false
  }
}

async function loadCategories() {
  try {
    const r = await fetch('/admin/categories')
    state.categories = await r.json()
  } catch (e) {
    console.error('Error cargando categorías:', e)
  }
}

async function searchEpg(query) {
  if (!query || query.length < 2) return []
  try {
    const r = await fetch('/admin/epg/search?q=' + encodeURIComponent(query) + '&limit=10')
    return await r.json()
  } catch (e) {
    return []
  }
}

async function searchLogo(query) {
  if (!query || query.length < 2) return []
  try {
    const r = await fetch('/admin/logos/search?q=' + encodeURIComponent(query) + '&limit=10')
    return await r.json()
  } catch (e) {
    return []
  }
}

async function loadPage() {
  state.hostFilter = $('filter-host').value
  state.page = parseInt($('goto-page').value) || 1
  cleanupVideo()
  state.detectedQuality = null

  try {
    const url = `/admin/tvpori/discover/pending?host=${state.hostFilter}&page=${state.page}&page_size=1`
    const r = await fetch(url)
    const data = await r.json()
    if (!data.available) {
      $('content').innerHTML = `<div class="empty-state"><h2>Sin pendientes</h2></div>`
      return
    }
    state.total = data.total
    state.totalPages = data.total_pages
    $('stat-pending').textContent = data.total
    $('page-info').textContent = `Página ${data.page} / ${data.total_pages} (${data.total} pendientes)`
    $('btn-prev').disabled = data.page <= 1
    $('btn-next').disabled = data.page >= data.total_pages

    if (data.items.length === 0) {
      $('content').innerHTML = `<div class="empty-state"><h2>🎉 ¡No hay más canales por revisar!</h2><p style="margin-top:16px;"><a href="/admin/" style="color: var(--accent); font-size:16px;">Ir a la lista de canales →</a></p></div>`
      return
    }
    state.currentItem = data.items[0]
    renderCard(state.currentItem)
  } catch (e) {
    toast('Error cargando página: ' + e.message, 'error')
  }
}

function renderCard(item) {
  const defaultName = `${item.host}_${item.stream_id}`
  const defaultCatName = item.host === 'deportes' ? 'Deportes' : 'General'
  const defaultCat = state.categories.find(c => c.name === defaultCatName)
  const defaultCatId = defaultCat ? defaultCat.id : ''

  const catOptions = state.categories
    .map(c => `<option value="${c.id}" ${c.id === defaultCatId ? 'selected' : ''}>${c.icon || ''} ${c.name}</option>`)
    .join('')

  const countryOptions = state.countries
    .map(c => `<option value="${c}" ${c === 'MX' ? 'selected' : ''}>${c || '(sin país)'}</option>`)
    .join('')

  // Construir URL del proxy para preview vía JaiboTV
  // Nota: stream_id del proxy se asigna al importar, por ahora preview vía URL directa
  // (el proxy solo funciona si el canal ya existe en DB).
  // Solución: usar la URL del descubrimiento directamente (browser sale por IP pública del router)
  const previewUrl = item.url

  $('content').innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="id-block">
          <span class="host">${item.host}</span>:<span class="stream">${item.stream_id}</span>
          <div class="external-id">${item.external_id}</div>
        </div>
        <div>
          <span class="quality-badge" id="quality-badge" style="display:none;position:relative;top:0;right:0;"></span>
        </div>
      </div>

      <div class="preview-area">
        <div>
          <div class="preview-video" id="preview-container">
            <div class="preview-placeholder" id="preview-placeholder">
              <div>📺 Preview no cargado</div>
              <button class="btn" onclick="startPreview()">▶️ Preview del stream</button>
            </div>
          </div>
          <div class="log" id="preview-log"></div>
        </div>

        <div class="preview-meta">
          <div class="form-row">
            <label>Nombre del canal</label>
            <input type="text" id="form-name" value="${defaultName}" placeholder="Ej: ESPN HD" />
          </div>
          <div class="form-row">
            <label>Categoría</label>
            <select id="form-category">${catOptions}</select>
          </div>
          <div class="form-row">
            <label>EPG ID <span style="color:var(--muted);font-size:10px;">(opcional, busca o pega manual)</span></label>
            <div style="position:relative;">
              <input type="text" id="form-epg" placeholder="Empieza a escribir para buscar..." autocomplete="off" />
              <div id="epg-suggestions" style="position:absolute;top:100%;left:0;right:0;background:var(--surface);border:1px solid var(--border);border-radius:4px;max-height:200px;overflow-y:auto;display:none;z-index:10;"></div>
            </div>
          </div>
          <div class="form-row">
            <label>Logo URL <span style="color:var(--muted);font-size:10px;">(opcional)</span></label>
            <div style="position:relative;">
              <input type="text" id="form-logo" placeholder="https://... o busca por nombre" autocomplete="off" />
              <div id="logo-suggestions" style="position:absolute;top:100%;left:0;right:0;background:var(--surface);border:1px solid var(--border);border-radius:4px;max-height:200px;overflow-y:auto;display:none;z-index:10;"></div>
            </div>
          </div>
          <div class="form-row">
            <label>País</label>
            <select id="form-country">${countryOptions}</select>
          </div>
        </div>
      </div>

      <div class="actions">
        <button class="btn btn-secondary" onclick="skipItem()">🚫 Skip y siguiente</button>
        <button class="btn btn-success" onclick="importItem()">✅ Importar y siguiente</button>
      </div>
    </div>
  `

  // Setup autocompletes
  setupEpgSearch()
  setupLogoSearch()
}

function setupEpgSearch() {
  const input = $('form-epg')
  const suggestions = $('epg-suggestions')
  let timer = null

  input.addEventListener('input', () => {
    clearTimeout(timer)
    const q = input.value.trim()
    if (q.length < 2) { suggestions.style.display = 'none'; return }
    timer = setTimeout(async () => {
      const results = await searchEpg(q)
      if (results.length === 0) { suggestions.style.display = 'none'; return }
      suggestions.innerHTML = results.slice(0, 10).map(r => `
        <div style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border);font-size:13px;" 
             onmouseover="this.style.background='var(--bg)'" 
             onmouseout="this.style.background=''"
             onclick="selectEpg('${(r.epg_id || '').replace(/'/g, "\\'")}', '${(r.name || '').replace(/'/g, "\\'")}', '${(r.source_name || '').replace(/'/g, "\\'")}')">
          <div style="color:var(--accent);font-weight:600;">${r.name || r.epg_id}</div>
          <div style="color:var(--muted);font-size:11px;">${r.epg_id} • ${r.source_name || '?'}</div>
        </div>
      `).join('')
      suggestions.style.display = 'block'
    }, 300)
  })

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !suggestions.contains(e.target)) {
      suggestions.style.display = 'none'
    }
  })
}

function selectEpg(epgId, name, source) {
  $('form-epg').value = epgId
  $('epg-suggestions').style.display = 'none'
  toast(`EPG seleccionado: ${name} (${source})`, 'success')
}

function setupLogoSearch() {
  const input = $('form-logo')
  const suggestions = $('logo-suggestions')
  let timer = null

  input.addEventListener('input', () => {
    clearTimeout(timer)
    const q = input.value.trim()
    // Si parece URL completa, no buscar
    if (q.startsWith('http://') || q.startsWith('https://')) { suggestions.style.display = 'none'; return }
    if (q.length < 2) { suggestions.style.display = 'none'; return }
    timer = setTimeout(async () => {
      const results = await searchLogo(q)
      if (results.length === 0) { suggestions.style.display = 'none'; return }
      suggestions.innerHTML = results.slice(0, 8).map(r => `
        <div style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:center;font-size:13px;" 
             onmouseover="this.style.background='var(--bg)'" 
             onmouseout="this.style.background=''"
             onclick="selectLogo('${(r.url || '').replace(/'/g, "\\'")}')">
          <img src="${r.url}" style="width:32px;height:32px;object-fit:contain;background:#000;border-radius:4px;" onerror="this.style.display='none'" />
          <span>${r.name || r.url}</span>
        </div>
      `).join('')
      suggestions.style.display = 'block'
    }, 300)
  })

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !suggestions.contains(e.target)) {
      suggestions.style.display = 'none'
    }
  })
}

function selectLogo(url) {
  $('form-logo').value = url
  $('logo-suggestions').style.display = 'none'
}

async function startPreview() {
  if (!state.currentItem) return
  const container = $('preview-container')
  container.innerHTML = '<div class="preview-placeholder"><div>🔄 Obteniendo URL fresca...</div></div>'

  // Hacer scrape fresco para obtener URL con token nuevo
  let url
  try {
    const r = await fetch(`/admin/tvpori/fresh-url?host=${state.currentItem.host}&stream_id=${state.currentItem.stream_id}`)
    const data = await r.json()
    if (!data.ok) {
      logMsg(`❌ Scrape falló: ${data.error}`, 'err')
      container.innerHTML = `<div class="preview-placeholder"><div style="color:var(--error);">❌ ${data.error}</div><button class="btn" onclick="startPreview()">Reintentar</button></div>`
      return
    }
    url = data.url
    logMsg(`✅ URL fresca obtenida`, 'ok')
  } catch (e) {
    logMsg(`❌ Error: ${e.message}`, 'err')
    return
  }

  container.innerHTML = '<video id="preview-video-el" controls autoplay muted></video><span class="quality-badge" id="quality-badge" style="display:none;"></span>'
  const video = $('preview-video-el')

  logMsg(`Cargando: ${url.substring(0, 80)}...`)

  if (typeof Hls !== 'undefined' && Hls.isSupported()) {
    state.hls = new Hls({ debug: false, enableWorker: true })
    state.hls.loadSource(url)
    state.hls.attachMedia(video)
    state.hls.on(Hls.Events.MANIFEST_PARSED, (e, data) => {
      logMsg(`✅ Manifest parsed. Niveles: ${data.levels.length}`, 'ok')
    })
    state.hls.on(Hls.Events.ERROR, (e, data) => {
      logMsg(`❌ Error: ${data.details} fatal=${data.fatal}`, 'err')
      if (data.response) logMsg(`   HTTP ${data.response.code}`, 'err')
    })
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url
  }

  video.addEventListener('loadedmetadata', () => {
    const w = video.videoWidth
    const h = video.videoHeight
    const q = classifyQuality(w, h)
    if (q) {
      state.detectedQuality = q.label
      const badge = $('quality-badge')
      badge.textContent = `${q.label} • ${q.desc}`
      badge.style.display = 'inline-block'
      logMsg(`📊 Calidad detectada: ${q.label} (${q.desc})`, 'ok')
    }
  })
}

async function skipItem() {
  if (!state.currentItem) return
  try {
    await fetch('/admin/tvpori/skip-discovered', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: state.currentItem.host, stream_id: state.currentItem.stream_id }),
    })
    toast(`Saltado: ${state.currentItem.host}:${state.currentItem.stream_id}`, 'success')
    loadPage()
  } catch (e) {
    toast('Error: ' + e.message, 'error')
  }
}

async function importItem() {
  if (!state.currentItem) return

  const name = $('form-name').value.trim() || `${state.currentItem.host}_${state.currentItem.stream_id}`
  const category_id = parseInt($('form-category').value) || null
  const epg_id = $('form-epg').value.trim()
  const logo = $('form-logo').value.trim()
  const country = $('form-country').value

  try {
    const r = await fetch('/admin/tvpori/import-discovered', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: state.currentItem.host,
        stream_id: state.currentItem.stream_id,
        name,
        category_id,
        epg_id: epg_id || undefined,
        logo: logo || undefined,
        country: country || undefined,
        quality_label: state.detectedQuality || undefined,
      }),
    })
    const data = await r.json()
    if (data.ok) {
      toast(`✅ Importado: ${data.channel.name} (id ${data.channel.id})`, 'success')
      cleanupVideo()
      loadPage()
    } else {
      toast('Error: ' + (data.error || 'desconocido'), 'error')
    }
  } catch (e) {
    toast('Error: ' + e.message, 'error')
  }
}

function nextPage() {
  if (state.page < state.totalPages) {
    state.page++
    $('goto-page').value = state.page
    loadPage()
  }
}

function prevPage() {
  if (state.page > 1) {
    state.page--
    $('goto-page').value = state.page
    loadPage()
  }
}

$('filter-host').addEventListener('change', () => {
  state.page = 1
  $('goto-page').value = 1
  loadPage()
})

// Inicialización
(async () => {
  await loadCategories()
  const hasData = await loadStats()
  if (hasData) await loadPage()
})()

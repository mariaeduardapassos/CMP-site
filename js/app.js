// ============================================================
// STATE
// ============================================================
const STATE = {
  page: 'dashboard',
  dashCiclo: 'all',
  vistorias: { page: 1, perPage: 20, filters: { uf:'', status:'', ciclo:'', search:'', esfera:'', fiscal:'', foto:'', ata:'', situacao:'' } },
  fiscais: { search: '', estado: '', municipio: '' },
  pops: { search: '', area: '' },
  simec: { page: 1, perPage: 20, filters: { uf:'', situacao:'', search:'' } },
  pagamentos: { filters: { uf:'', status:'', search:'' } },
  importFile: null,
  editingVistoriaId: null,
  editingFiscalId: null,
  editingPopId: null,
}

// ============================================================
// AUTH
// ============================================================
function doLogin() {
  const user = document.getElementById('loginUser').value
  const pass = document.getElementById('loginPass').value
  const err  = document.getElementById('loginError')
  if (DB.login(user, pass)) {
    document.getElementById('loginOverlay').style.display = 'none'
    const pg = location.hash.replace('#','') || 'dashboard'
    navigate(pg)
  } else {
    err.textContent = 'Usuário ou senha incorretos.'
    err.style.display = 'block'
    document.getElementById('loginPass').value = ''
  }
}

function doLogout() {
  DB.logout()
  document.getElementById('loginOverlay').style.display = 'flex'
  document.getElementById('loginUser').value = ''
  document.getElementById('loginPass').value = ''
  document.getElementById('loginError').style.display = 'none'
  document.getElementById('content').innerHTML = ''
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'))
}

document.getElementById('loginPass').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin()
})
document.getElementById('loginUser').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('loginPass').focus()
})

// ============================================================
// ROUTER
// ============================================================
const PAGE_TITLES = {
  dashboard:   'Dashboard',
  vistorias:   'Vistorias',
  fiscais:     'Fiscais',
  importar:    'Importar Ciclo',
  pops:        'POPs',
  simec:       'Controle no SIMEC',
  precos:      'Preços das Vistorias',
  pagamentos:  'Pagamento de Fiscais'
}

function navigate(page) {
  if (!DB.isLoggedIn()) return
  if (!PAGE_TITLES[page]) page = 'dashboard'
  STATE.page = page
  location.hash = page
  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.page === page)
  )
  document.getElementById('headerTitle').textContent = PAGE_TITLES[page]
  renderPage()
}

function renderPage() {
  const c = document.getElementById('content')
  c.scrollTop = 0
  if (STATE.page === 'dashboard') renderDashboard(c)
  else if (STATE.page === 'vistorias')  renderVistorias(c)
  else if (STATE.page === 'fiscais')    renderFiscais(c)
  else if (STATE.page === 'importar')   renderImport(c)
  else if (STATE.page === 'pops')       renderPops(c)
  else if (STATE.page === 'simec')      renderSimec(c)
  else if (STATE.page === 'precos')     renderPrecos(c)
  else if (STATE.page === 'pagamentos') renderPagamentos(c)
}

// ============================================================
// UTILITIES
// ============================================================
const STATUS_MAP = {
  'AGUARDANDO DOCUMENTOS': 'aguardando-documentos',
  'AGUARDANDO VISTORIA':   'aguardando-vistoria',
  'DIFICULDADE':           'dificuldade',
  'EM AGENDAMENTO':        'em-agendamento',
  'HOMOLOGADO':            'homologado',
  'LANÇADO':               'lancado',
  'NÃO PROSPECTADO':       'nao-prospectado',
  'VISTORIADO':            'vistoriado',
}
const ALL_STATUSES = Object.keys(STATUS_MAP)
const ALL_SITUACOES = ['Execução', 'Concluída', 'Paralisada', 'Inacabada', 'Inacabada - PC Técnica Concluída', 'Licitação', 'Contratação', 'Em Reformulação', 'Obra Cancelada']

function statusBadge(status) {
  const cls = STATUS_MAP[status] || 'default'
  return `<span class="badge badge-${cls}">${esc(status) || '—'}</span>`
}

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function showDrawer() {
  document.getElementById('drawerOverlay').classList.add('open')
  document.getElementById('editDrawer').classList.add('open')
}

function hideDrawer() {
  document.getElementById('drawerOverlay').classList.remove('open')
  document.getElementById('editDrawer').classList.remove('open')
}

function showModal() { document.getElementById('modalOverlay').classList.add('open') }
function hideModal() { document.getElementById('modalOverlay').classList.remove('open') }

function toast(msg, type = 'success') {
  const el = document.createElement('div')
  el.className = `alert alert-${type}`
  el.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;max-width:380px;box-shadow:0 4px 12px rgba(0,0,0,.15)'
  el.innerHTML = msg
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 4000)
}

// ─── CURRENCY ─────────────────────────────────────────────
function formatBRL(val) {
  if (!val && val !== 0) return '—'
  const str = String(val).replace(/R\$\s?/g,'').replace(/\./g,'').replace(',','.')
  const num = parseFloat(str)
  if (isNaN(num)) return String(val) || '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
}

function formatValorInput(input) {
  const str = String(input.value).replace(/R\$\s?/g,'').replace(/\./g,'').replace(',','.')
  const num = parseFloat(str)
  if (!isNaN(num)) input.value = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
}

// ─── DOC TOGGLE (FOTO / ATA / MEMORIAL DE CÁLCULO) ─────────
const DOC_FIELD_LABELS = {
  foto:             { icon: '📷', on: 'Foto registrada',                       off: 'Sem foto — clique para marcar' },
  ata:              { icon: '📄', on: 'ATA registrada',                        off: 'Sem ATA — clique para marcar' },
  memorial_calculo: { icon: '🧮', on: 'Memorial de Cálculo registrado',        off: 'Sem Memorial de Cálculo — clique para marcar' },
}

function toggleDocField(field) {
  const btn = document.getElementById(`${field}Toggle`)
  const inp = document.getElementById(`e_${field}`)
  const isOn = btn.classList.contains('doc-on')
  const lbl = DOC_FIELD_LABELS[field] || { icon: '📄', on: 'Registrado', off: 'Não registrado — clique para marcar' }
  if (isOn) {
    btn.classList.remove('doc-on')
    btn.innerHTML = `<span class="doc-toggle-icon">${lbl.icon}</span><span>${lbl.off}</span>`
    inp.style.display = 'none'
    inp.value = ''
  } else {
    btn.classList.add('doc-on')
    btn.innerHTML = `<span class="doc-toggle-icon">✅</span><span>${lbl.on}</span>`
    inp.style.display = 'block'
    inp.focus()
  }
}

function statusOptions(current) {
  return ['', ...ALL_STATUSES]
    .map(s => `<option value="${esc(s)}" ${current===s?'selected':''}>${s||'— Sem status —'}</option>`).join('')
}

// Called by charts.js on segment hover/click
window.filterVistoriasByStatus = function(status) {
  STATE.vistorias.filters.status = status
  STATE.vistorias.page = 1
  navigate('vistorias')
}

window.filterVistoriasByUF = function(uf) {
  STATE.vistorias.filters.uf = uf
  STATE.vistorias.page = 1
  navigate('vistorias')
}

window.filterVistoriasBySituacao = function(situacao) {
  STATE.vistorias.filters.situacao = situacao
  STATE.vistorias.page = 1
  navigate('vistorias')
}

// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard(container) {
  const all = Object.values(DB.getVistorias())
  const ciclos = DB.getCiclos()

  if (all.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <h3>Nenhum dado ainda</h3>
        <p>Importe uma planilha para visualizar o dashboard.</p>
        <button class="btn btn-primary" onclick="navigate('importar')">📥 Importar Planilha</button>
      </div>`
    return
  }

  const sel = STATE.dashCiclo
  const data = sel === 'all' ? all : all.filter(v => v.ciclos && v.ciclos.includes(sel))
  const total = data.length
  const pct = n => total ? Math.round(n/total*100) : 0

  const emAg  = data.filter(v => v.situacao_os === 'EM AGENDAMENTO').length
  const homol = data.filter(v => v.situacao_os === 'HOMOLOGADO').length
  const vist  = data.filter(v => v.situacao_os === 'VISTORIADO').length
  const dif   = data.filter(v => v.situacao_os === 'DIFICULDADE').length

  const cycleOpts = `<option value="all" ${sel==='all'?'selected':''}>Todos os ciclos</option>` +
    ciclos.map(c => `<option value="${esc(c.nome)}" ${sel===c.nome?'selected':''}>${esc(c.nome)} (${c.total})</option>`).join('')

  container.innerHTML = `
    <div class="cycle-filter">
      <label>Ciclo:</label>
      <select class="filter-select" onchange="STATE.dashCiclo=this.value;renderDashboard(document.getElementById('content'))">
        ${cycleOpts}
      </select>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Total de Obras</div>
        <div class="kpi-value">${total}</div>
        <div class="kpi-sub">${ciclos.length} ciclo(s) importado(s)</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Em Agendamento</div>
        <div class="kpi-value">${emAg}</div>
        <div class="kpi-sub">${pct(emAg)}% do total</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Homologadas</div>
        <div class="kpi-value">${homol}</div>
        <div class="kpi-sub">Vistoriadas: ${vist}</div>
      </div>
      <div class="kpi-card" style="border-top-color:${dif>0?'#ef4444':'var(--accent)'}">
        <div class="kpi-label">Com Dificuldade</div>
        <div class="kpi-value" style="${dif>0?'color:#ef4444':''}">${dif}</div>
        <div class="kpi-sub">${pct(dif)}% do total</div>
      </div>
    </div>

    <!-- Funil Circular (large, full width) -->
    <div class="funnel-layout">
      <div class="funnel-chart-area">
        <h3>Situação da OS — Funil de Acompanhamento</h3>
        <div class="chart-container" style="height:340px"><div id="funnelChart" class="funnel-overlap"></div></div>
      </div>
      <div class="funnel-obs-panel" id="funnelObservation">
        <div class="obs-title">Carregando...</div>
      </div>
    </div>

    <!-- Obras por UF + Mapa do Brasil -->
    <div class="chart-grid">
      <div class="chart-card">
        <h3>Obras por Estado (UF)</h3>
        <div class="chart-container" style="height:260px"><canvas id="ufBarChart"></canvas></div>
      </div>
      <div class="map-card">
        <h3>Mapa do Brasil — Distribuição de Obras</h3>
        <div class="map-container" id="brazilMapContainer"></div>
      </div>
    </div>

    <!-- Esfera + Documentação + Tipologia + Situação da Obra -->
    <div class="chart-grid chart-grid-4">
      <div class="chart-card">
        <h3>Obras por Esfera</h3>
        <div class="chart-container" style="height:220px"><canvas id="esferaChart"></canvas></div>
      </div>
      <div class="chart-card">
        <h3>Cobertura de Documentação</h3>
        <div class="chart-container" style="height:220px"><canvas id="docChart"></canvas></div>
      </div>
      <div class="chart-card">
        <h3>Top Tipologias</h3>
        <div class="chart-container" style="height:220px"><canvas id="tipologiaChart"></canvas></div>
      </div>
      <div class="chart-card">
        <h3>Situação da Obra (Execução)</h3>
        <div class="chart-container" style="height:220px"><canvas id="situacaoChart"></canvas></div>
      </div>
    </div>`

  const cicloArg = sel === 'all' ? null : sel
  setTimeout(() => {
    renderFunnelChart('funnelChart', cicloArg)
    renderUFBarChart('ufBarChart', cicloArg)
    renderBrazilMap('brazilMapContainer', cicloArg)
    renderEsferaChart('esferaChart', cicloArg)
    renderDocumentacaoChart('docChart', cicloArg)
    renderTipologiaChart('tipologiaChart', cicloArg)
    renderSituacaoChart('situacaoChart', cicloArg)
  }, 0)
}

// ============================================================
// VISTORIAS — all columns
// ============================================================
function renderVistorias(container) {
  const ciclos = DB.getCiclos()
  const f = STATE.vistorias.filters
  let data = Object.values(DB.getVistorias())

  if (f.uf) data = data.filter(v => v.uf === f.uf)
  if (f.status === 'SEM STATUS') data = data.filter(v => !v.situacao_os)
  else if (f.status) data = data.filter(v => v.situacao_os === f.status)
  if (f.ciclo)  data = data.filter(v => v.ciclos && v.ciclos.includes(f.ciclo))
  if (f.esfera) data = data.filter(v => v.esfera === f.esfera)
  if (f.situacao) data = data.filter(v => v.situacao === f.situacao)
  if (f.fiscal) data = data.filter(v => v.fiscal === f.fiscal)
  if (f.foto === 'sim') data = data.filter(v => v.foto)
  if (f.foto === 'nao') data = data.filter(v => !v.foto)
  if (f.ata  === 'sim') data = data.filter(v => v.ata)
  if (f.ata  === 'nao') data = data.filter(v => !v.ata)
  if (f.search) {
    const q = f.search.toLowerCase()
    data = data.filter(v =>
      (v.escola||'').toLowerCase().includes(q) ||
      (v.municipio||'').toLowerCase().includes(q) ||
      (v.id_obra||'').toLowerCase().includes(q) ||
      (v.fiscal||'').toLowerCase().includes(q) ||
      (v.tipologia||'').toLowerCase().includes(q)
    )
  }

  const total   = data.length
  const perPage = STATE.vistorias.perPage
  const maxPage = Math.max(1, Math.ceil(total/perPage))
  STATE.vistorias.page = Math.min(STATE.vistorias.page, maxPage)
  const page  = STATE.vistorias.page
  const start = (page-1)*perPage
  const pageData = data.slice(start, start+perPage)

  const allV    = Object.values(DB.getVistorias())
  const ufs     = [...new Set(allV.map(v=>v.uf).filter(Boolean))].sort()
  const esferas = [...new Set(allV.map(v=>v.esfera).filter(Boolean))].sort()
  const fiscaisLst = [...new Set(allV.map(v=>v.fiscal).filter(Boolean))].sort()

  const ufOpts  = `<option value="">Todos os estados</option>` +
    ufs.map(u => `<option value="${esc(u)}" ${f.uf===u?'selected':''}>${esc(u)}</option>`).join('')
  const stOpts  = `<option value="">Todos os status</option>` +
    ALL_STATUSES.map(s => `<option value="${esc(s)}" ${f.status===s?'selected':''}>${esc(s)}</option>`).join('') +
    `<option value="SEM STATUS" ${f.status==='SEM STATUS'?'selected':''}>Sem status</option>`
  const cOpts   = `<option value="">Todos os ciclos</option>` +
    ciclos.map(c => `<option value="${esc(c.nome)}" ${f.ciclo===c.nome?'selected':''}>${esc(c.nome)}</option>`).join('')
  const esOpts  = `<option value="">Todas as esferas</option>` +
    esferas.map(e => `<option value="${esc(e)}" ${f.esfera===e?'selected':''}>${esc(e)}</option>`).join('')
  const sitOpts = `<option value="">Todas as situações</option>` +
    ALL_SITUACOES.map(s => `<option value="${esc(s)}" ${f.situacao===s?'selected':''}>${esc(s)}</option>`).join('')
  const fiscOpts= `<option value="">Todos os fiscais</option>` +
    fiscaisLst.map(n => `<option value="${esc(n)}" ${f.fiscal===n?'selected':''}>${esc(n)}</option>`).join('')
  const fotoOpts= `<option value="" ${f.foto===''?'selected':''}>Foto (todos)</option>
    <option value="sim" ${f.foto==='sim'?'selected':''}>✅ Com Foto</option>
    <option value="nao" ${f.foto==='nao'?'selected':''}>— Sem Foto</option>`
  const ataOpts = `<option value="" ${f.ata===''?'selected':''}>ATA (todos)</option>
    <option value="sim" ${f.ata==='sim'?'selected':''}>✅ Com ATA</option>
    <option value="nao" ${f.ata==='nao'?'selected':''}>— Sem ATA</option>`

  const rows = pageData.length === 0
    ? `<tr><td colspan="16" style="text-align:center;padding:32px;color:#9ca3af">Nenhuma vistoria encontrada</td></tr>`
    : pageData.map(v => `
      <tr onclick="openVistoriaDrawer('${esc(v.id_obra)}')">
        <td><code style="font-size:11px;color:#6b7280">${esc(v.id_obra)}</code></td>
        <td title="${esc(v.escola)}">${esc(v.escola)||'—'}</td>
        <td>${esc(v.municipio)||'—'}</td>
        <td><span class="badge badge-default">${esc(v.uf)}</span></td>
        <td>${esc(v.esfera)||'—'}</td>
        <td title="${esc(v.tipologia)}">${esc(v.tipologia)||'—'}</td>
        <td>${esc(v.situacao)||'—'}</td>
        <td>${esc(v.fiscal)||'—'}</td>
        <td>${esc(v.quem)||'—'}</td>
        <td>${formatBRL(v.valor)}</td>
        <td>${statusBadge(v.situacao_os)}</td>
        <td>${v.foto ? '✅' : '—'}</td>
        <td>${v.ata ? '✅' : '—'}</td>
        <td title="${esc(v.observacao)}">${v.observacao ? esc(v.observacao).substring(0,30)+'…' : '—'}</td>
        <td>${(v.ciclos||[]).map(c=>`<span class="cycle-badge">${esc(c)}</span>`).join(' ')}</td>
        <td>${esc(v.ultima_atualizacao)||'—'}</td>
      </tr>`).join('')

  container.innerHTML = `
    <div class="page-header">
      <h2>Vistorias <span style="font-weight:400;color:#9ca3af;font-size:14px">(${total})</span></h2>
      <button class="btn btn-primary" onclick="navigate('importar')">📥 Importar Ciclo</button>
    </div>

    <div class="filters">
      <input class="filter-input" type="text" placeholder="🔍 Buscar escola, município, ID, fiscal, tipologia..."
        value="${esc(f.search)}"
        oninput="STATE.vistorias.filters.search=this.value;STATE.vistorias.page=1;renderVistorias(document.getElementById('content'))">
      <select class="filter-select" onchange="STATE.vistorias.filters.uf=this.value;STATE.vistorias.page=1;renderVistorias(document.getElementById('content'))">${ufOpts}</select>
      <select class="filter-select" onchange="STATE.vistorias.filters.status=this.value;STATE.vistorias.page=1;renderVistorias(document.getElementById('content'))">${stOpts}</select>
      <select class="filter-select" onchange="STATE.vistorias.filters.ciclo=this.value;STATE.vistorias.page=1;renderVistorias(document.getElementById('content'))">${cOpts}</select>
      <select class="filter-select" onchange="STATE.vistorias.filters.esfera=this.value;STATE.vistorias.page=1;renderVistorias(document.getElementById('content'))">${esOpts}</select>
      <select class="filter-select" onchange="STATE.vistorias.filters.situacao=this.value;STATE.vistorias.page=1;renderVistorias(document.getElementById('content'))">${sitOpts}</select>
      <select class="filter-select" onchange="STATE.vistorias.filters.fiscal=this.value;STATE.vistorias.page=1;renderVistorias(document.getElementById('content'))">${fiscOpts}</select>
      <select class="filter-select" onchange="STATE.vistorias.filters.foto=this.value;STATE.vistorias.page=1;renderVistorias(document.getElementById('content'))">${fotoOpts}</select>
      <select class="filter-select" onchange="STATE.vistorias.filters.ata=this.value;STATE.vistorias.page=1;renderVistorias(document.getElementById('content'))">${ataOpts}</select>
      ${(f.uf||f.status||f.ciclo||f.search||f.esfera||f.situacao||f.fiscal||f.foto||f.ata) ? `<button class="btn btn-secondary btn-sm" onclick="clearFilters()">✖ Limpar filtros</button>` : ''}
    </div>

    <div class="table-card">
      <div class="table-wrap">
        <table class="table-full">
          <thead>
            <tr>
              <th>ID Obra</th><th>Escola</th><th>Município</th><th>UF</th>
              <th>Esfera</th><th>Tipologia</th><th>Situação</th>
              <th>Fiscal</th><th>Responsável</th><th>Valor</th>
              <th>Situação OS</th><th>Foto</th><th>ATA</th>
              <th>Observação</th><th>Ciclo(s)</th><th>Atualizado</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="pagination">
        <span>Mostrando ${total===0?0:start+1}–${Math.min(start+perPage,total)} de ${total} obras</span>
        <div class="pagination-btns">${buildPagination(page, maxPage)}</div>
      </div>
    </div>`
}

function clearFilters() {
  STATE.vistorias.filters = { uf:'', status:'', ciclo:'', search:'', esfera:'', fiscal:'', foto:'', ata:'', situacao:'' }
  STATE.vistorias.page = 1
  renderVistorias(document.getElementById('content'))
}

function buildPagination(current, total, fn = 'changePage') {
  const btns = []
  btns.push(`<button class="btn-page" ${current===1?'disabled':''} onclick="${fn}(${current-1})">‹</button>`)
  const range = []
  if (total<=7) { for(let i=1;i<=total;i++) range.push(i) }
  else {
    range.push(1)
    if (current>3) range.push('…')
    for(let i=Math.max(2,current-1);i<=Math.min(total-1,current+1);i++) range.push(i)
    if (current<total-2) range.push('…')
    range.push(total)
  }
  range.forEach(p => {
    if (p==='…') btns.push(`<span style="padding:4px 6px;color:#9ca3af">…</span>`)
    else btns.push(`<button class="btn-page ${p===current?'active':''}" onclick="${fn}(${p})">${p}</button>`)
  })
  btns.push(`<button class="btn-page" ${current===total?'disabled':''} onclick="${fn}(${current+1})">›</button>`)
  return btns.join('')
}

function changePage(p) { STATE.vistorias.page=p; renderVistorias(document.getElementById('content')) }

// ─── VISTORIA DRAWER: ALL fields editable ────────────────────
function openVistoriaDrawer(id) {
  const v = DB.getVistoria(id)
  if (!v) return
  STATE.editingVistoriaId = id

  document.getElementById('editDrawer').innerHTML = `
    <div class="drawer-header">
      <div>
        <h3 style="margin-bottom:2px">Obra #${esc(v.id_obra)}</h3>
        <div style="font-size:11px;color:#9ca3af">${esc(v.escola)||''}</div>
      </div>
      <button class="drawer-close" onclick="hideDrawer()">×</button>
    </div>
    <div class="drawer-body">
      <div class="drawer-section">
        <div class="drawer-section-title">Identificação</div>
        <div class="edit-grid">
          <div class="form-group">
            <label class="form-label">Escola / Nome</label>
            <input class="form-control" id="e_escola" value="${esc(v.escola)}">
          </div>
          <div class="form-group">
            <label class="form-label">ID da Obra</label>
            <input class="form-control" id="e_id_obra" value="${esc(v.id_obra)}" readonly style="opacity:.6">
          </div>
          <div class="form-group">
            <label class="form-label">Município</label>
            <input class="form-control" id="e_municipio" value="${esc(v.municipio)}">
          </div>
          <div class="form-group">
            <label class="form-label">Estado (UF)</label>
            <input class="form-control" id="e_uf" value="${esc(v.uf)}" maxlength="2" style="text-transform:uppercase">
          </div>
          <div class="form-group">
            <label class="form-label">Esfera</label>
            <select class="form-control" id="e_esfera">
              ${['','Municipal','Estadual','Federal'].map(o=>`<option ${v.esfera===o?'selected':''}>${o}</option>`).join('')}
            </select>
          </div>
          <div class="form-group full">
            <label class="form-label">Tipologia da Obra</label>
            <input class="form-control" id="e_tipologia" value="${esc(v.tipologia)}">
          </div>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title">Situação</div>
        <div class="edit-grid">
          <div class="form-group">
            <label class="form-label">Situação da Obra</label>
            <select class="form-control" id="e_situacao">
              ${['', ...ALL_SITUACOES].map(o=>`<option ${v.situacao===o?'selected':''}>${o}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Situação da OS ⭐</label>
            <select class="form-control" id="e_situacao_os" style="border-color:var(--accent)">
              ${statusOptions(v.situacao_os)}
            </select>
          </div>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title">Equipe</div>
        <div class="edit-grid">
          <div class="form-group">
            <label class="form-label">Fiscal Responsável</label>
            <input class="form-control" id="e_fiscal" value="${esc(v.fiscal)}">
          </div>
          <div class="form-group">
            <label class="form-label">Responsável (Quem)</label>
            <input class="form-control" id="e_quem" value="${esc(v.quem)}">
          </div>
          <div class="form-group">
            <label class="form-label">Valor</label>
            <input class="form-control" id="e_valor" value="${formatBRL(v.valor)||esc(v.valor)}"
                   placeholder="R$ 0,00" onblur="formatValorInput(this)">
          </div>
          <div class="form-group">
            <label class="form-label">Coordenada GPS</label>
            <input class="form-control" id="e_coordenada" value="${esc(v.coordenada)}" placeholder="-7.64, -72.65">
          </div>
          <div class="form-group">
            <label class="form-label">Status de Pagamento (Fiscal)</label>
            <select class="form-control" id="e_status_pagamento">
              ${['','Pago','Não Pago','A Negociar'].map(o=>`<option value="${esc(o)}" ${v.status_pagamento===o?'selected':''}>${o||'— Definir —'}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title">Documentação</div>
        <div class="form-group">
          <label class="form-label">FOTO</label>
          <button type="button" class="doc-toggle ${v.foto?'doc-on':''}" id="fotoToggle"
                  onclick="toggleDocField('foto')">
            <span class="doc-toggle-icon">${v.foto ? '✅' : '📷'}</span>
            <span>${v.foto ? 'Foto registrada' : 'Sem foto — clique para marcar'}</span>
          </button>
          <input class="form-control" id="e_foto" type="text"
                 style="margin-top:8px;${v.foto?'':'display:none'}"
                 value="${esc(v.foto)}" placeholder="Link ou referência da foto (opcional)">
        </div>
        <div class="form-group">
          <label class="form-label">ATA</label>
          <button type="button" class="doc-toggle ${v.ata?'doc-on':''}" id="ataToggle"
                  onclick="toggleDocField('ata')">
            <span class="doc-toggle-icon">${v.ata ? '✅' : '📄'}</span>
            <span>${v.ata ? 'ATA registrada' : 'Sem ATA — clique para marcar'}</span>
          </button>
          <input class="form-control" id="e_ata" type="text"
                 style="margin-top:8px;${v.ata?'':'display:none'}"
                 value="${esc(v.ata)}" placeholder="Link ou referência da ATA (opcional)">
        </div>
        <div class="form-group">
          <label class="form-label">Observação</label>
          <textarea class="form-control" id="e_observacao" rows="3">${esc(v.observacao)}</textarea>
        </div>
      </div>

      <div style="font-size:11px;color:#9ca3af;margin-top:4px">
        Ciclo(s): ${(v.ciclos||[]).join(', ')} · Última atualização: ${v.ultima_atualizacao||'—'}
      </div>
    </div>
    <div class="drawer-footer">
      <button class="btn btn-danger" onclick="confirmDeleteVistoria('${esc(v.id_obra)}','${esc(v.escola)}')">🗑️ Excluir Ordem</button>
      <div style="flex:1"></div>
      <button class="btn btn-secondary" onclick="hideDrawer()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveVistoriaEdit()">Salvar Alterações</button>
    </div>`

  showDrawer()
  // Focus on the most-used field
  setTimeout(() => document.getElementById('e_situacao_os').focus(), 50)
}

function confirmDeleteVistoria(id, nome) {
  if (!confirm(`Excluir permanentemente a ordem "${nome || id}" (ID ${id})? Essa ação não pode ser desfeita.`)) return
  DB.deleteVistoria(id)
  hideDrawer()
  renderVistorias(document.getElementById('content'))
  toast('Ordem excluída.')
}

function saveVistoriaEdit() {
  const id = STATE.editingVistoriaId
  const v = DB.getVistoria(id)
  if (!v) return

  v.escola      = document.getElementById('e_escola').value.trim()
  v.municipio   = document.getElementById('e_municipio').value.trim()
  v.uf          = document.getElementById('e_uf').value.trim().toUpperCase()
  v.esfera      = document.getElementById('e_esfera').value
  v.tipologia   = document.getElementById('e_tipologia').value.trim()
  v.situacao    = document.getElementById('e_situacao').value
  v.situacao_os = document.getElementById('e_situacao_os').value
  v.fiscal      = document.getElementById('e_fiscal').value.trim()
  v.quem        = document.getElementById('e_quem').value.trim()
  v.valor       = document.getElementById('e_valor').value.trim()
  v.coordenada  = document.getElementById('e_coordenada').value.trim()
  v.status_pagamento = document.getElementById('e_status_pagamento').value
  const fotoOn = document.getElementById('fotoToggle').classList.contains('doc-on')
  const ataOn  = document.getElementById('ataToggle').classList.contains('doc-on')
  v.foto = fotoOn ? (document.getElementById('e_foto').value.trim() || 'sim') : ''
  v.ata  = ataOn  ? (document.getElementById('e_ata').value.trim()  || 'sim') : ''
  v.observacao  = document.getElementById('e_observacao').value.trim()
  v.ultima_atualizacao = new Date().toISOString().split('T')[0]

  DB.saveVistoria(id, v)
  hideDrawer()
  renderVistorias(document.getElementById('content'))
  toast('✅ Vistoria atualizada com sucesso!')
}

// ============================================================
// FISCAIS — table with all columns
// ============================================================
function renderFiscais(container) {
  const q  = STATE.fiscais.search.toLowerCase()
  const st = STATE.fiscais.estado
  const mn = STATE.fiscais.municipio
  let data = DB.getFiscais()
  if (q)  data = data.filter(f =>
    (f.nome||'').toLowerCase().includes(q) ||
    (f.estado||'').toLowerCase().includes(q) ||
    (f.municipio||'').toLowerCase().includes(q) ||
    (f.cpf||'').toLowerCase().includes(q) ||
    (f.contato||'').toLowerCase().includes(q)
  )
  if (st) data = data.filter(f => f.estado === st)
  if (mn) data = data.filter(f => f.municipio === mn)

  const rows = data.length === 0
    ? `<tr><td colspan="7" style="text-align:center;padding:40px;color:#9ca3af">
        ${DB.getFiscais().length===0 ? 'Nenhum fiscal cadastrado. Importe uma planilha ou adicione manualmente.' : 'Nenhum resultado para a busca.'}
       </td></tr>`
    : data.map(f => `
      <tr>
        <td><strong>${esc(f.nome)}</strong></td>
        <td><span class="badge badge-default">${esc(f.estado)||'—'}</span></td>
        <td>${esc(f.municipio)||'—'}</td>
        <td><span style="font-family:monospace;font-size:11px">${esc(f.cpf)||'—'}</span></td>
        <td>${esc(f.contato)||'—'}</td>
        <td title="${esc(f.observacao)}" style="color:#6b7280;font-style:italic">${f.observacao ? esc(f.observacao).substring(0,40) : '—'}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-sm btn-secondary" onclick="openFiscalDrawer(${f.id})">✏️ Editar</button>
          <button class="btn btn-sm btn-danger" onclick="confirmDeleteFiscal(${f.id},'${esc(f.nome)}')" style="margin-left:4px">🗑️</button>
        </td>
      </tr>`).join('')

  container.innerHTML = `
    <div class="page-header">
      <h2>Fiscais <span style="font-weight:400;color:#9ca3af;font-size:14px">(${DB.getFiscais().length})</span></h2>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary" onclick="importFiscaisFromFile()">📥 Importar da Planilha</button>
        <button class="btn btn-primary" onclick="openFiscalDrawer(null)">+ Novo Fiscal</button>
      </div>
    </div>
    <div class="filters">
      <input class="filter-input" type="text" placeholder="🔍 Buscar nome, estado, município, CPF, contato..."
        value="${esc(STATE.fiscais.search)}"
        oninput="STATE.fiscais.search=this.value;renderFiscais(document.getElementById('content'))">
      <select class="filter-select" onchange="STATE.fiscais.estado=this.value;STATE.fiscais.municipio='';renderFiscais(document.getElementById('content'))">
        <option value="">Todos os estados</option>
        ${[...new Set(DB.getFiscais().map(f=>f.estado).filter(Boolean))].sort()
          .map(e=>`<option value="${esc(e)}" ${st===e?'selected':''}>${esc(e)}</option>`).join('')}
      </select>
      <select class="filter-select" onchange="STATE.fiscais.municipio=this.value;renderFiscais(document.getElementById('content'))">
        <option value="">Todos os municípios</option>
        ${[...new Set(DB.getFiscais().filter(f=>!st||f.estado===st).map(f=>f.municipio).filter(Boolean))].sort()
          .map(m=>`<option value="${esc(m)}" ${mn===m?'selected':''}>${esc(m)}</option>`).join('')}
      </select>
      ${(q||st||mn) ? `<button class="btn btn-secondary btn-sm" onclick="STATE.fiscais.search='';STATE.fiscais.estado='';STATE.fiscais.municipio='';renderFiscais(document.getElementById('content'))">✖ Limpar</button>` : ''}
    </div>
    <div class="table-card">
      <div class="table-wrap">
        <table class="table-full">
          <thead>
            <tr>
              <th>Nome</th><th>Estado</th><th>Município</th>
              <th>CPF</th><th>Contato</th><th>Observação</th><th>Ações</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`

}

function openFiscalDrawer(id) {
  STATE.editingFiscalId = id
  const f = id ? DB.getFiscais().find(x => x.id === id) : null

  document.getElementById('editDrawer').innerHTML = `
    <div class="drawer-header">
      <h3>${f ? 'Editar Fiscal' : 'Novo Fiscal'}</h3>
      <button class="drawer-close" onclick="hideDrawer()">×</button>
    </div>
    <div class="drawer-body">
      <div class="form-group">
        <label class="form-label">Nome Completo *</label>
        <input class="form-control" id="f_nome" value="${esc(f?.nome)}" placeholder="Nome completo do fiscal">
      </div>
      <div class="edit-grid">
        <div class="form-group">
          <label class="form-label">Estado (UF)</label>
          <input class="form-control" id="f_estado" value="${esc(f?.estado)}" maxlength="2" style="text-transform:uppercase" placeholder="Ex: AC">
        </div>
        <div class="form-group">
          <label class="form-label">Município</label>
          <input class="form-control" id="f_municipio" value="${esc(f?.municipio)}" placeholder="Cidade">
        </div>
        <div class="form-group">
          <label class="form-label">Contato / Telefone</label>
          <input class="form-control" id="f_contato" value="${esc(f?.contato)}" placeholder="(XX) XXXXX-XXXX">
        </div>
        <div class="form-group">
          <label class="form-label">CPF</label>
          <input class="form-control" id="f_cpf" value="${esc(f?.cpf)}" placeholder="XXX.XXX.XXX-XX">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Observação</label>
        <textarea class="form-control" id="f_obs" rows="3" placeholder="Observações sobre o fiscal">${esc(f?.observacao)}</textarea>
      </div>
    </div>
    <div class="drawer-footer">
      <button class="btn btn-secondary" onclick="hideDrawer()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveFiscal()">Salvar</button>
    </div>`

  showDrawer()
  setTimeout(() => document.getElementById('f_nome').focus(), 50)
}

function saveFiscal() {
  const nome = document.getElementById('f_nome').value.trim()
  if (!nome) { toast('O nome é obrigatório.', 'error'); return }

  DB.saveFiscal({
    id:        STATE.editingFiscalId || null,
    nome,
    estado:    document.getElementById('f_estado').value.trim().toUpperCase(),
    municipio: document.getElementById('f_municipio').value.trim(),
    contato:   document.getElementById('f_contato').value.trim(),
    cpf:       document.getElementById('f_cpf').value.trim(),
    observacao:document.getElementById('f_obs').value.trim()
  })

  hideDrawer()
  renderFiscais(document.getElementById('content'))
  toast(STATE.editingFiscalId ? '✅ Fiscal atualizado!' : '✅ Fiscal adicionado!')
}

function confirmDeleteFiscal(id, nome) {
  if (!confirm(`Excluir o fiscal "${nome}"?`)) return
  DB.deleteFiscal(id)
  renderFiscais(document.getElementById('content'))
  toast('Fiscal removido.')
}

// ─── IMPORT FISCAIS (standalone from Fiscais page) ──────────
function importFiscaisFromFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.xlsx,.xls'
  document.body.appendChild(input)
  input.addEventListener('change', function() {
    const file = this.files[0]
    document.body.removeChild(input)
    if (file) handleFiscaisFile(file)
  })
  input.click()
}

async function handleFiscaisFile(file) {
  if (!file) { toast('❌ Nenhum arquivo recebido', 'error'); return }
  if (!file.name.match(/\.xlsx?$/i)) { toast('Use um arquivo .xlsx', 'error'); return }
  toast(`📂 Arquivo: ${file.name} (${(file.size/1024).toFixed(0)} KB)`)
  try {
    const result = await importFiscaisOnly(file)
    toast(`✅ ${result.importados} fiscais importados, ${result.atualizados} atualizados.`)
    renderFiscais(document.getElementById('content'))
  } catch(e) {
    toast('❌ Erro: ' + e.message, 'error')
    console.error('Erro importFiscaisOnly:', e)
  }
}

// ============================================================
// POPS — Procedimentos Operacionais Padrão
// ============================================================
function renderPops(container) {
  const q = STATE.pops.search.toLowerCase()
  const ar = STATE.pops.area
  let data = DB.getPops()
  if (q) data = data.filter(p =>
    (p.titulo||'').toLowerCase().includes(q) ||
    (p.area||'').toLowerCase().includes(q) ||
    (p.responsavel||'').toLowerCase().includes(q) ||
    (p.descricao||'').toLowerCase().includes(q)
  )
  if (ar) data = data.filter(p => p.area === ar)

  const areas = [...new Set(DB.getPops().map(p=>p.area).filter(Boolean))].sort()

  const rows = data.length === 0
    ? `<tr><td colspan="5" style="text-align:center;padding:40px;color:#9ca3af">
        ${DB.getPops().length===0 ? 'Nenhum POP cadastrado ainda. Centralize aqui os procedimentos mapeados na empresa.' : 'Nenhum resultado para a busca.'}
       </td></tr>`
    : data.map(p => `
      <tr>
        <td><strong>${esc(p.titulo)}</strong>${p.link ? ` <a href="${esc(p.link)}" target="_blank" rel="noopener" title="Abrir link" onclick="event.stopPropagation()">🔗</a>` : ''}</td>
        <td><span class="badge badge-default">${esc(p.area)||'—'}</span></td>
        <td>${esc(p.responsavel)||'—'}</td>
        <td>${esc(p.atualizado_em)||'—'}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-sm btn-secondary" onclick="openPopDrawer(${p.id})">✏️ Ver / Editar</button>
          <button class="btn btn-sm btn-danger" onclick="confirmDeletePop(${p.id},'${esc(p.titulo)}')" style="margin-left:4px">🗑️</button>
        </td>
      </tr>`).join('')

  container.innerHTML = `
    <div class="page-header">
      <h2>POPs <span style="font-weight:400;color:#9ca3af;font-size:14px">(${DB.getPops().length})</span></h2>
      <button class="btn btn-primary" onclick="openPopDrawer(null)">+ Novo POP</button>
    </div>
    <div class="filters">
      <input class="filter-input" type="text" placeholder="🔍 Buscar título, área, responsável, descrição..."
        value="${esc(STATE.pops.search)}"
        oninput="STATE.pops.search=this.value;renderPops(document.getElementById('content'))">
      <select class="filter-select" onchange="STATE.pops.area=this.value;renderPops(document.getElementById('content'))">
        <option value="">Todas as áreas</option>
        ${areas.map(a=>`<option value="${esc(a)}" ${ar===a?'selected':''}>${esc(a)}</option>`).join('')}
      </select>
      ${(q||ar) ? `<button class="btn btn-secondary btn-sm" onclick="STATE.pops.search='';STATE.pops.area='';renderPops(document.getElementById('content'))">✖ Limpar</button>` : ''}
    </div>
    <div class="table-card">
      <div class="table-wrap">
        <table class="table-full">
          <thead><tr><th>Título</th><th>Área / Processo</th><th>Responsável</th><th>Atualizado em</th><th>Ações</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`
}

function openPopDrawer(id) {
  STATE.editingPopId = id
  const p = id ? DB.getPops().find(x => x.id === id) : null

  document.getElementById('editDrawer').innerHTML = `
    <div class="drawer-header">
      <h3>${p ? 'Editar POP' : 'Novo POP'}</h3>
      <button class="drawer-close" onclick="hideDrawer()">×</button>
    </div>
    <div class="drawer-body">
      <div class="form-group">
        <label class="form-label">Título *</label>
        <input class="form-control" id="p_titulo" value="${esc(p?.titulo)}" placeholder="Ex: Processo de agendamento de vistoria">
      </div>
      <div class="edit-grid">
        <div class="form-group">
          <label class="form-label">Área / Processo</label>
          <input class="form-control" id="p_area" value="${esc(p?.area)}" placeholder="Ex: Vistorias, Financeiro, Fiscais...">
        </div>
        <div class="form-group">
          <label class="form-label">Responsável</label>
          <input class="form-control" id="p_responsavel" value="${esc(p?.responsavel)}" placeholder="Quem mantém este POP">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Link (opcional)</label>
        <input class="form-control" id="p_link" value="${esc(p?.link)}" placeholder="Link para o documento completo (Drive, Notion...)">
      </div>
      <div class="form-group">
        <label class="form-label">Descrição / Passo a passo</label>
        <textarea class="form-control" id="p_descricao" rows="10" placeholder="Descreva o processo mapeado passo a passo">${esc(p?.descricao)}</textarea>
      </div>
    </div>
    <div class="drawer-footer">
      ${p ? `<button class="btn btn-danger" onclick="confirmDeletePop(${p.id},'${esc(p.titulo)}')">🗑️ Excluir</button><div style="flex:1"></div>` : ''}
      <button class="btn btn-secondary" onclick="hideDrawer()">Cancelar</button>
      <button class="btn btn-primary" onclick="savePopEdit()">Salvar</button>
    </div>`

  showDrawer()
  setTimeout(() => document.getElementById('p_titulo').focus(), 50)
}

function savePopEdit() {
  const titulo = document.getElementById('p_titulo').value.trim()
  if (!titulo) { toast('O título é obrigatório.', 'error'); return }

  DB.savePop({
    id:          STATE.editingPopId || null,
    titulo,
    area:        document.getElementById('p_area').value.trim(),
    responsavel: document.getElementById('p_responsavel').value.trim(),
    link:        document.getElementById('p_link').value.trim(),
    descricao:   document.getElementById('p_descricao').value.trim(),
    atualizado_em: new Date().toISOString().split('T')[0]
  })

  hideDrawer()
  renderPops(document.getElementById('content'))
  toast(STATE.editingPopId ? '✅ POP atualizado!' : '✅ POP adicionado!')
}

function confirmDeletePop(id, titulo) {
  if (!confirm(`Excluir o POP "${titulo}"?`)) return
  DB.deletePop(id)
  hideDrawer()
  renderPops(document.getElementById('content'))
  toast('POP removido.')
}

// ============================================================
// IMPORT
// ============================================================
function renderImport(container) {
  STATE.importFile = null
  const ciclos = DB.getCiclos()
  container.innerHTML = `
    <div class="page-header"><h2>Importar Ciclo</h2></div>
    <div class="import-card">
      <div class="dropzone" id="dropzone" onclick="document.getElementById('fileInput').click()">
        <div class="dropzone-icon">📁</div>
        <div class="dropzone-text">Arraste o arquivo <strong>.xlsx</strong> aqui ou clique para selecionar</div>
        <div class="dropzone-sub">Formato aceito: Excel (.xlsx) — planilha de lista de supervisão (colunas ID, Obra, Unidade Implantadora, Município, UF, Situação da Obra...)</div>
      </div>
      <input type="file" id="fileInput" accept=".xlsx,.xls" style="display:none" onchange="handleFileSelect(this.files[0])">
      <div id="importForm" style="display:none">
        <div class="separator"></div>
        <div class="form-group" style="max-width:320px">
          <label class="form-label">Nome do Ciclo *</label>
          <input class="form-control" id="cicloNome" placeholder="Ex: 9º Ciclo">
        </div>
        <div id="previewSection"></div>
        <div style="display:flex;gap:10px;margin-top:18px">
          <button class="btn btn-primary" id="importBtn" onclick="confirmImport()">✅ Confirmar Importação</button>
          <button class="btn btn-secondary" onclick="renderImport(document.getElementById('content'))">✖ Cancelar</button>
        </div>
      </div>
      <div id="importResult"></div>
    </div>

    <div class="table-card" style="margin-top:24px">
      <div class="page-header" style="padding:14px 18px 0">
        <h3 style="font-size:14px;color:#6b7280;text-transform:uppercase;letter-spacing:.03em">Ciclos importados (${ciclos.length})</h3>
      </div>
      <div class="table-wrap">
        <table class="table-full">
          <thead><tr><th>Ciclo</th><th>Data da importação</th><th>Obras (na época)</th><th>Ações</th></tr></thead>
          <tbody>${ciclos.length === 0
            ? `<tr><td colspan="4" style="text-align:center;padding:24px;color:#9ca3af">Nenhum ciclo importado ainda.</td></tr>`
            : ciclos.map(c => `
              <tr>
                <td><strong>${esc(c.nome)}</strong></td>
                <td>${esc(c.data)||'—'}</td>
                <td>${esc(c.total)}</td>
                <td><button class="btn btn-sm btn-danger" onclick="confirmDeleteCiclo('${esc(c.id)}','${esc(c.nome)}')">🗑️ Excluir ciclo</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`

  const dz = document.getElementById('dropzone')
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover') })
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'))
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('dragover'); handleFileSelect(e.dataTransfer.files[0]) })
}

function confirmDeleteCiclo(cicloId, nome) {
  if (!confirm(`Excluir o ciclo "${nome}"? As obras importadas nele permanecem cadastradas (com o histórico de outras obras), apenas deixam de estar marcadas com esse ciclo.`)) return
  DB.deleteCiclo(cicloId)
  renderImport(document.getElementById('content'))
  toast('Ciclo excluído.')
}

async function handleFileSelect(file) {
  if (!file) return
  if (!file.name.match(/\.xlsx?$/i)) { toast('Use um arquivo .xlsx', 'error'); return }
  STATE.importFile = file
  document.getElementById('importForm').style.display = 'block'
  const m = file.name.match(/(\d+º?\s*ciclo)/i)
  if (m) document.getElementById('cicloNome').value = m[0].replace(/\s+/g,' ').trim()
  document.getElementById('dropzone').innerHTML = `
    <div class="dropzone-icon">📄</div>
    <div class="dropzone-text"><strong>${esc(file.name)}</strong></div>
    <div class="dropzone-sub">${(file.size/1024).toFixed(0)} KB — clique para trocar</div>`
  try {
    const preview = await previewExcel(file)
    const COLS = ['ID DA OBRA','UF','MUNICÍPIO','ESCOLA','ESFERA','SITUAÇÃO','REMOVER DA LISTA'].filter(c=>preview.headers.includes(c))
    document.getElementById('previewSection').innerHTML = `
      <div class="preview-section">
        <div class="preview-label">Prévia — <strong>${preview.total}</strong> registros encontrados na planilha</div>
        <div class="preview-table-wrap">
          <table>
            <thead><tr>${COLS.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead>
            <tbody>${preview.rows.map(r=>`<tr>${COLS.map(c=>`<td title="${esc(r[c])}">${esc(r[c])}</td>`).join('')}</tr>`).join('')}</tbody>
          </table>
        </div>
      </div>`
  } catch(e) {
    document.getElementById('previewSection').innerHTML = `<div class="alert alert-error">Erro ao ler: ${esc(e.message)}</div>`
  }
}

async function confirmImport() {
  const file = STATE.importFile
  const cicloNome = (document.getElementById('cicloNome').value||'').trim()
  if (!file) { toast('Selecione um arquivo', 'error'); return }
  if (!cicloNome) { toast('Informe o nome do ciclo', 'error'); return }
  const btn = document.getElementById('importBtn')
  btn.disabled = true; btn.textContent = '⏳ Importando...'
  try {
    const r = await importExcel(file, cicloNome)
    document.getElementById('importResult').innerHTML = `
      <div class="alert alert-success" style="margin-top:16px">
        ✅ <strong>${esc(cicloNome)} importado!</strong><br>
        ${r.novas} novas obras · ${r.atualizadas} atualizadas
        ${r.ignoradas>0 ? ` · ${r.ignoradas} ignoradas (marcadas como remover da lista)` : ''}
        ${r.fiscaisImportados>0 ? ` · ${r.fiscaisImportados} fiscais importados` : ''}
      </div>`
    document.getElementById('importForm').style.display = 'none'
    document.getElementById('dropzone').innerHTML = `<div class="dropzone-icon">✅</div><div class="dropzone-text">Concluído! Redirecionando...</div>`
    setTimeout(() => navigate('dashboard'), 2000)
  } catch(e) {
    document.getElementById('importResult').innerHTML = `<div class="alert alert-error" style="margin-top:16px">❌ ${esc(e.message)}</div>`
    btn.disabled = false; btn.textContent = '✅ Confirmar Importação'
  }
}

// ============================================================
// CONTROLE NO SIMEC — vinculado à mesma obra/vistoria
// ============================================================
function renderSimec(container) {
  const f = STATE.simec.filters
  let data = Object.values(DB.getVistorias())

  if (f.uf) data = data.filter(v => v.uf === f.uf)
  if (f.situacao) data = data.filter(v => v.situacao === f.situacao)
  if (f.search) {
    const q = f.search.toLowerCase()
    data = data.filter(v =>
      (v.escola||'').toLowerCase().includes(q) ||
      (v.municipio||'').toLowerCase().includes(q) ||
      (v.id_obra||'').toLowerCase().includes(q) ||
      (v.vistoriador||'').toLowerCase().includes(q)
    )
  }

  const total   = data.length
  const perPage = STATE.simec.perPage
  const maxPage = Math.max(1, Math.ceil(total/perPage))
  STATE.simec.page = Math.min(STATE.simec.page, maxPage)
  const page  = STATE.simec.page
  const start = (page-1)*perPage
  const pageData = data.slice(start, start+perPage)

  const allV = Object.values(DB.getVistorias())
  const ufs  = [...new Set(allV.map(v=>v.uf).filter(Boolean))].sort()

  const ufOpts  = `<option value="">Todos os estados</option>` +
    ufs.map(u => `<option value="${esc(u)}" ${f.uf===u?'selected':''}>${esc(u)}</option>`).join('')
  const sitOpts = `<option value="">Todas as situações</option>` +
    ALL_SITUACOES.map(s => `<option value="${esc(s)}" ${f.situacao===s?'selected':''}>${esc(s)}</option>`).join('')

  const rows = pageData.length === 0
    ? `<tr><td colspan="10" style="text-align:center;padding:32px;color:#9ca3af">Nenhum registro encontrado</td></tr>`
    : pageData.map(v => `
      <tr onclick="openSimecDrawer('${esc(v.id_obra)}')">
        <td>${esc(v.uf)||'—'}</td>
        <td>${esc(v.municipio)||'—'}</td>
        <td><code style="font-size:11px;color:#6b7280">${esc(v.id_obra)}</code></td>
        <td title="${esc(v.tipologia)}">${esc(v.tipologia)||'—'}</td>
        <td>${esc(v.situacao)||'—'}</td>
        <td>${v.foto ? '✅' : '—'}</td>
        <td>${v.ata ? '✅' : '—'}</td>
        <td>${v.memorial_calculo ? '✅' : '—'}</td>
        <td>${esc(v.vistoriador)||'—'}</td>
        <td title="${esc(v.obs_simec)}">${v.obs_simec ? esc(v.obs_simec).substring(0,30)+'…' : '—'}</td>
      </tr>`).join('')

  container.innerHTML = `
    <div class="page-header">
      <h2>Controle no SIMEC <span style="font-weight:400;color:#9ca3af;font-size:14px">(${total})</span></h2>
    </div>
    <div class="filters">
      <input class="filter-input" type="text" placeholder="🔍 Buscar escola, município, ID, vistoriador..."
        value="${esc(f.search)}"
        oninput="STATE.simec.filters.search=this.value;STATE.simec.page=1;renderSimec(document.getElementById('content'))">
      <select class="filter-select" onchange="STATE.simec.filters.uf=this.value;STATE.simec.page=1;renderSimec(document.getElementById('content'))">${ufOpts}</select>
      <select class="filter-select" onchange="STATE.simec.filters.situacao=this.value;STATE.simec.page=1;renderSimec(document.getElementById('content'))">${sitOpts}</select>
      ${(f.uf||f.situacao||f.search) ? `<button class="btn btn-secondary btn-sm" onclick="STATE.simec.filters={uf:'',situacao:'',search:''};STATE.simec.page=1;renderSimec(document.getElementById('content'))">✖ Limpar filtros</button>` : ''}
    </div>
    <div class="table-card">
      <div class="table-wrap">
        <table class="table-full">
          <thead>
            <tr>
              <th>UF</th><th>Município</th><th>ID Obra</th><th>Tipologia</th><th>Situação</th>
              <th>Foto</th><th>ATA</th><th>Memorial de Cálculo</th><th>Vistoriador</th><th>Obs. CMP</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="pagination">
        <span>Mostrando ${total===0?0:start+1}–${Math.min(start+perPage,total)} de ${total} obras</span>
        <div class="pagination-btns">${buildPagination(page, maxPage, 'changeSimecPage')}</div>
      </div>
    </div>
    <div style="font-size:12px;color:#9ca3af;margin-top:10px">
      UF, Município, Tipologia e Situação vêm direto da aba Vistorias — para alterá-los, edite a obra em Vistorias. Foto, ATA e os demais campos do SIMEC podem ser editados aqui e refletem automaticamente na aba Vistorias (é o mesmo registro).
    </div>`
}

function changeSimecPage(p) { STATE.simec.page=p; renderSimec(document.getElementById('content')) }

function openSimecDrawer(id) {
  const v = DB.getVistoria(id)
  if (!v) return
  STATE.editingVistoriaId = id

  document.getElementById('editDrawer').innerHTML = `
    <div class="drawer-header">
      <div>
        <h3 style="margin-bottom:2px">Obra #${esc(v.id_obra)}</h3>
        <div style="font-size:11px;color:#9ca3af">${esc(v.escola)||''} — ${esc(v.municipio)}/${esc(v.uf)}</div>
      </div>
      <button class="drawer-close" onclick="hideDrawer()">×</button>
    </div>
    <div class="drawer-body">
      <div class="drawer-section">
        <div class="drawer-section-title">Dados da Obra (somente leitura — edite na aba Vistorias)</div>
        <div class="edit-grid">
          <div class="form-group"><label class="form-label">UF</label><input class="form-control" value="${esc(v.uf)}" readonly style="opacity:.6"></div>
          <div class="form-group"><label class="form-label">Município</label><input class="form-control" value="${esc(v.municipio)}" readonly style="opacity:.6"></div>
          <div class="form-group full"><label class="form-label">Tipologia</label><input class="form-control" value="${esc(v.tipologia)}" readonly style="opacity:.6"></div>
          <div class="form-group full"><label class="form-label">Situação</label><input class="form-control" value="${esc(v.situacao)}" readonly style="opacity:.6"></div>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title">Controle no SIMEC</div>
        <div class="form-group">
          <label class="form-label">FOTO</label>
          <button type="button" class="doc-toggle ${v.foto?'doc-on':''}" id="fotoToggle" onclick="toggleDocField('foto')">
            <span class="doc-toggle-icon">${v.foto ? '✅' : '📷'}</span>
            <span>${v.foto ? 'Foto registrada' : 'Sem foto — clique para marcar'}</span>
          </button>
          <input class="form-control" id="e_foto" type="text" style="margin-top:8px;${v.foto?'':'display:none'}" value="${esc(v.foto)}" placeholder="Link ou referência da foto (opcional)">
        </div>
        <div class="form-group">
          <label class="form-label">ATA</label>
          <button type="button" class="doc-toggle ${v.ata?'doc-on':''}" id="ataToggle" onclick="toggleDocField('ata')">
            <span class="doc-toggle-icon">${v.ata ? '✅' : '📄'}</span>
            <span>${v.ata ? 'ATA registrada' : 'Sem ATA — clique para marcar'}</span>
          </button>
          <input class="form-control" id="e_ata" type="text" style="margin-top:8px;${v.ata?'':'display:none'}" value="${esc(v.ata)}" placeholder="Link ou referência da ATA (opcional)">
        </div>
        <div class="form-group">
          <label class="form-label">MEMORIAL DE CÁLCULO</label>
          <button type="button" class="doc-toggle ${v.memorial_calculo?'doc-on':''}" id="memorial_calculoToggle" onclick="toggleDocField('memorial_calculo')">
            <span class="doc-toggle-icon">${v.memorial_calculo ? '✅' : '🧮'}</span>
            <span>${v.memorial_calculo ? 'Memorial de Cálculo registrado' : 'Sem Memorial de Cálculo — clique para marcar'}</span>
          </button>
          <input class="form-control" id="e_memorial_calculo" type="text" style="margin-top:8px;${v.memorial_calculo?'':'display:none'}" value="${esc(v.memorial_calculo)}" placeholder="Link ou referência (opcional)">
        </div>
        <div class="form-group">
          <label class="form-label">Vistoriador</label>
          <input class="form-control" id="e_vistoriador" value="${esc(v.vistoriador)}" placeholder="Quem lançou/conferiu no SIMEC">
        </div>
        <div class="form-group">
          <label class="form-label">Observações de Lançamento</label>
          <textarea class="form-control" id="e_obs_lancamento" rows="3" placeholder="Observações sobre o lançamento no SIMEC">${esc(v.obs_lancamento)}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Observações CMP</label>
          <textarea class="form-control" id="e_obs_simec" rows="3" placeholder="Observações internas da CMP">${esc(v.obs_simec)}</textarea>
        </div>
      </div>
    </div>
    <div class="drawer-footer">
      <button class="btn btn-secondary" onclick="hideDrawer()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveSimecEdit()">Salvar Alterações</button>
    </div>`

  showDrawer()
  setTimeout(() => document.getElementById('e_vistoriador').focus(), 50)
}

function saveSimecEdit() {
  const id = STATE.editingVistoriaId
  const v = DB.getVistoria(id)
  if (!v) return

  const fotoOn = document.getElementById('fotoToggle').classList.contains('doc-on')
  const ataOn  = document.getElementById('ataToggle').classList.contains('doc-on')
  const memOn  = document.getElementById('memorial_calculoToggle').classList.contains('doc-on')
  v.foto = fotoOn ? (document.getElementById('e_foto').value.trim() || 'sim') : ''
  v.ata  = ataOn  ? (document.getElementById('e_ata').value.trim()  || 'sim') : ''
  v.memorial_calculo = memOn ? (document.getElementById('e_memorial_calculo').value.trim() || 'sim') : ''
  v.vistoriador     = document.getElementById('e_vistoriador').value.trim()
  v.obs_lancamento  = document.getElementById('e_obs_lancamento').value.trim()
  v.obs_simec       = document.getElementById('e_obs_simec').value.trim()
  v.ultima_atualizacao = new Date().toISOString().split('T')[0]

  DB.saveVistoria(id, v)
  hideDrawer()
  renderSimec(document.getElementById('content'))
  toast('✅ Controle SIMEC atualizado!')
}

// ============================================================
// PREÇOS DAS VISTORIAS — valor mínimo por estado
// ============================================================
function renderPrecos(container) {
  const precos = DB.getPrecos()
  const ufs = Object.keys(STATE_CENTROIDS).sort()

  const rows = ufs.map(uf => {
    const p = precos[uf] || {}
    return `
      <tr>
        <td><span class="badge badge-default">${uf}</span> ${esc(STATE_CENTROIDS[uf].name)}</td>
        <td><input class="form-control" style="max-width:160px" value="${esc(p.valorMinimo ? formatBRL(p.valorMinimo) : '')}" placeholder="R$ 0,00"
              onblur="formatValorInput(this);savePrecoField('${uf}','valorMinimo',this.value)"></td>
        <td><input class="form-control" value="${esc(p.observacao)}" placeholder="Observação (opcional)"
              onblur="savePrecoField('${uf}','observacao',this.value)"></td>
      </tr>`
  }).join('')

  container.innerHTML = `
    <div class="page-header">
      <h2>Preços das Vistorias</h2>
    </div>
    <div style="font-size:12px;color:#9ca3af;margin-bottom:12px">
      Valor mínimo que pode ser cobrado por vistoria em cada estado. Preencha o campo e clique fora para salvar.
    </div>
    <div class="table-card">
      <div class="table-wrap">
        <table class="table-full">
          <thead><tr><th>Estado</th><th>Valor mínimo</th><th>Observação</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`
}

function savePrecoField(uf, field, value) {
  DB.savePreco(uf, { [field]: value.trim() })
  toast(`Preço mínimo de ${uf} atualizado.`)
}

// ============================================================
// PAGAMENTO DE FISCAIS — vinculado à mesma obra/vistoria
// ============================================================
function renderPagamentos(container) {
  const f = STATE.pagamentos.filters
  let data = Object.values(DB.getVistorias()).filter(v => v.fiscal)

  if (f.uf) data = data.filter(v => v.uf === f.uf)
  if (f.status) data = data.filter(v => (v.status_pagamento || '—') === f.status)
  if (f.search) {
    const q = f.search.toLowerCase()
    data = data.filter(v =>
      (v.fiscal||'').toLowerCase().includes(q) ||
      (v.municipio||'').toLowerCase().includes(q) ||
      (v.id_obra||'').toLowerCase().includes(q)
    )
  }

  const allV = Object.values(DB.getVistorias()).filter(v => v.fiscal)
  const ufs  = [...new Set(allV.map(v=>v.uf).filter(Boolean))].sort()

  const ufOpts = `<option value="">Todos os estados</option>` +
    ufs.map(u => `<option value="${esc(u)}" ${f.uf===u?'selected':''}>${esc(u)}</option>`).join('')
  const stOpts = `<option value="">Todos os status</option>` +
    ['Pago','Não Pago','A Negociar'].map(s => `<option value="${esc(s)}" ${f.status===s?'selected':''}>${esc(s)}</option>`).join('') +
    `<option value="—" ${f.status==='—'?'selected':''}>Sem status definido</option>`

  const totalValor = data.reduce((sum,v) => {
    const n = parseFloat(String(v.valor||'').replace(/R\$\s?/g,'').replace(/\./g,'').replace(',','.'))
    return sum + (isNaN(n)?0:n)
  }, 0)

  const rows = data.length === 0
    ? `<tr><td colspan="6" style="text-align:center;padding:32px;color:#9ca3af">Nenhuma vistoria com fiscal atribuído encontrada</td></tr>`
    : data.map(v => `
      <tr>
        <td><code style="font-size:11px;color:#6b7280">${esc(v.id_obra)}</code></td>
        <td>${esc(v.municipio)||'—'} <span class="badge badge-default">${esc(v.uf)}</span></td>
        <td>${esc(v.fiscal)}</td>
        <td>${formatBRL(v.valor)}</td>
        <td>
          <select class="filter-select" style="min-width:140px" onchange="setStatusPagamento('${esc(v.id_obra)}',this.value)">
            ${['','Pago','Não Pago','A Negociar'].map(s=>`<option value="${esc(s)}" ${v.status_pagamento===s?'selected':''}>${s||'— Definir —'}</option>`).join('')}
          </select>
        </td>
        <td><button class="btn btn-sm btn-secondary" onclick="openVistoriaDrawer('${esc(v.id_obra)}')">Ver obra</button></td>
      </tr>`).join('')

  container.innerHTML = `
    <div class="page-header">
      <h2>Pagamento de Fiscais <span style="font-weight:400;color:#9ca3af;font-size:14px">(${data.length})</span></h2>
      <div style="font-weight:600">${formatBRL(totalValor)} <span style="font-weight:400;color:#9ca3af;font-size:12px">no filtro atual</span></div>
    </div>
    <div class="filters">
      <input class="filter-input" type="text" placeholder="🔍 Buscar fiscal, município, ID..."
        value="${esc(f.search)}"
        oninput="STATE.pagamentos.filters.search=this.value;renderPagamentos(document.getElementById('content'))">
      <select class="filter-select" onchange="STATE.pagamentos.filters.uf=this.value;renderPagamentos(document.getElementById('content'))">${ufOpts}</select>
      <select class="filter-select" onchange="STATE.pagamentos.filters.status=this.value;renderPagamentos(document.getElementById('content'))">${stOpts}</select>
      ${(f.uf||f.status||f.search) ? `<button class="btn btn-secondary btn-sm" onclick="STATE.pagamentos.filters={uf:'',status:'',search:''};renderPagamentos(document.getElementById('content'))">✖ Limpar filtros</button>` : ''}
    </div>
    <div class="table-card">
      <div class="table-wrap">
        <table class="table-full">
          <thead><tr><th>ID</th><th>Município</th><th>Nome do Fiscal</th><th>Valor</th><th>Status de Pagamento</th><th>Ações</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
    <div style="font-size:12px;color:#9ca3af;margin-top:10px">
      Município, fiscal e valor vêm direto da aba Vistorias — para alterá-los, edite a obra em Vistorias. O status de pagamento pode ser definido aqui e reflete automaticamente lá (é o mesmo registro).
    </div>`
}

function setStatusPagamento(id, status) {
  const v = DB.getVistoria(id)
  if (!v) return
  v.status_pagamento = status
  v.ultima_atualizacao = new Date().toISOString().split('T')[0]
  DB.saveVistoria(id, v)
  toast('Status de pagamento atualizado.')
  renderPagamentos(document.getElementById('content'))
}

// ============================================================
// EVENTS & INIT
// ============================================================
document.getElementById('menuToggle').addEventListener('click', () =>
  document.getElementById('sidebar').classList.toggle('mobile-open')
)

document.getElementById('drawerOverlay').addEventListener('click', hideDrawer)

document.querySelectorAll('.nav-item').forEach(el =>
  el.addEventListener('click', () => document.getElementById('sidebar').classList.remove('mobile-open'))
)

window.addEventListener('hashchange', () => {
  if (DB.isLoggedIn()) navigate(location.hash.replace('#','') || 'dashboard')
})

// INIT
if (DB.isLoggedIn()) {
  document.getElementById('loginOverlay').style.display = 'none'
  navigate(location.hash.replace('#','') || 'dashboard')
} else {
  document.getElementById('loginOverlay').style.display = 'flex'
  setTimeout(() => document.getElementById('loginUser').focus(), 100)
}

// ============================================================
// STATE
// ============================================================
const STATE = {
  page: 'dashboard',
  dashCiclo: 'all',
  vistorias: { page: 1, perPage: 20, filters: { uf:'', status:'', ciclo:'', search:'', esfera:'', fiscal:'', foto:'', ata:'', situacao:'' } },
  fiscais: { search: '', estado: '', municipio: '' },
  importFile: null,
  editingVistoriaId: null,
  editingFiscalId: null,
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
  dashboard: 'Dashboard',
  vistorias: 'Vistorias',
  fiscais:   'Fiscais',
  importar:  'Importar Ciclo'
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
  else if (STATE.page === 'vistorias') renderVistorias(c)
  else if (STATE.page === 'fiscais')   renderFiscais(c)
  else if (STATE.page === 'importar')  renderImport(c)
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
const ALL_SITUACOES = ['Execução', 'Concluída', 'Paralisada', 'Não iniciada']

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

// ─── DOC TOGGLE (FOTO / ATA) ───────────────────────────────
function toggleDocField(field) {
  const btn = document.getElementById(`${field}Toggle`)
  const inp = document.getElementById(`e_${field}`)
  const isOn = btn.classList.contains('doc-on')
  if (isOn) {
    btn.classList.remove('doc-on')
    btn.innerHTML = `<span class="doc-toggle-icon">${field==='foto'?'📷':'📄'}</span><span>${field==='foto'?'Sem foto — clique para marcar':'Sem ATA — clique para marcar'}</span>`
    inp.style.display = 'none'
    inp.value = ''
  } else {
    btn.classList.add('doc-on')
    btn.innerHTML = `<span class="doc-toggle-icon">✅</span><span>${field==='foto'?'Foto registrada':'ATA registrada'}</span>`
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
        <div class="chart-container" style="height:340px"><canvas id="funnelChart"></canvas></div>
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

  if (f.uf)     data = data.filter(v => v.uf === f.uf)
  if (f.status) data = data.filter(v => v.situacao_os === f.status)
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
    ALL_STATUSES.map(s => `<option value="${esc(s)}" ${f.status===s?'selected':''}>${esc(s)}</option>`).join('')
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

function buildPagination(current, total) {
  const btns = []
  btns.push(`<button class="btn-page" ${current===1?'disabled':''} onclick="changePage(${current-1})">‹</button>`)
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
    else btns.push(`<button class="btn-page ${p===current?'active':''}" onclick="changePage(${p})">${p}</button>`)
  })
  btns.push(`<button class="btn-page" ${current===total?'disabled':''} onclick="changePage(${current+1})">›</button>`)
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
              ${['','Execução','Concluída','Paralisada','Não iniciada'].map(o=>`<option ${v.situacao===o?'selected':''}>${o}</option>`).join('')}
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
      <button class="btn btn-secondary" onclick="hideDrawer()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveVistoriaEdit()">Salvar Alterações</button>
    </div>`

  showDrawer()
  // Focus on the most-used field
  setTimeout(() => document.getElementById('e_situacao_os').focus(), 50)
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
// IMPORT
// ============================================================
function renderImport(container) {
  STATE.importFile = null
  container.innerHTML = `
    <div class="page-header"><h2>Importar Ciclo</h2></div>
    <div class="import-card">
      <div class="dropzone" id="dropzone" onclick="document.getElementById('fileInput').click()">
        <div class="dropzone-icon">📁</div>
        <div class="dropzone-text">Arraste o arquivo <strong>.xlsx</strong> aqui ou clique para selecionar</div>
        <div class="dropzone-sub">Formato aceito: Excel (.xlsx) — aba "Geral" obrigatória</div>
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
    </div>`

  const dz = document.getElementById('dropzone')
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover') })
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'))
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('dragover'); handleFileSelect(e.dataTransfer.files[0]) })
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
    const COLS = ['UF','MUNICÍPIO','ID DA OBRA','ESCOLA','FISCAIS','SITUAÇÃO DA OS'].filter(c=>preview.headers.includes(c))
    document.getElementById('previewSection').innerHTML = `
      <div class="preview-section">
        <div class="preview-label">Prévia — <strong>${preview.total}</strong> registros encontrados na aba "Geral"</div>
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
  navigate(location.hash.replace('#','') || 'dashboard')
} else {
  document.getElementById('loginOverlay').style.display = 'flex'
  setTimeout(() => document.getElementById('loginUser').focus(), 100)
}

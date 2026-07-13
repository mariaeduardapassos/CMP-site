const CHARTS = {}

const STATUS_COLORS = {
  'AGUARDANDO DOCUMENTOS': '#f59e0b',
  'AGUARDANDO VISTORIA':   '#3b82f6',
  'DIFICULDADE':           '#ef4444',
  'EM AGENDAMENTO':        '#8b5cf6',
  'HOMOLOGADO':            '#10b981',
  'LANÇADO':               '#06b6d4',
  'NÃO PROSPECTADO':       '#9ca3af',
  'VISTORIADO':            '#059669',
}

const STATUS_DESCRIPTIONS = {
  'NÃO PROSPECTADO':       'Obras identificadas mas ainda não prospectadas para vistoria.',
  'LANÇADO':               'Obras recém-lançadas no sistema, aguardando processamento inicial.',
  'EM AGENDAMENTO':        'Obras com agendamento de vistoria em andamento pela equipe.',
  'AGUARDANDO DOCUMENTOS': 'Obras que aguardam o envio ou validação de documentação.',
  'AGUARDANDO VISTORIA':   'Obras com documentação completa, aguardando realização da vistoria.',
  'VISTORIADO':            'Obras que já tiveram a vistoria realizada com sucesso.',
  'HOMOLOGADO':            'Obras vistoriadas, avaliadas e homologadas. Processo concluído.',
  'DIFICULDADE':           'Obras com alguma dificuldade ou impedimento no processo de vistoria.',
}

// Funnel stage order (from start → end)
const FUNNEL_ORDER = [
  'NÃO PROSPECTADO', 'LANÇADO', 'EM AGENDAMENTO',
  'AGUARDANDO DOCUMENTOS', 'AGUARDANDO VISTORIA',
  'VISTORIADO', 'HOMOLOGADO', 'DIFICULDADE'
]

function getStatusColor(status) {
  return STATUS_COLORS[status] || '#6b7280'
}

function getVistoriasByFilter(cicloId) {
  const all = Object.values(DB.getVistorias())
  if (!cicloId || cicloId === 'all') return all
  return all.filter(v => v.ciclos && v.ciclos.includes(cicloId))
}

function destroyChart(id) {
  if (CHARTS[id]) { CHARTS[id].destroy(); delete CHARTS[id] }
}

// ─── FUNIL SOBREPOSTO (bandas empilhadas, cada uma mais estreita que a anterior) ──
function renderFunnelChart(containerId, cicloId) {
  const container = document.getElementById(containerId)
  if (!container) return

  const data = getVistoriasByFilter(cicloId)
  const counts = {}
  data.forEach(v => { const s = v.situacao_os || 'SEM STATUS'; counts[s] = (counts[s] || 0) + 1 })

  // Sort by funnel order
  const orderedLabels = FUNNEL_ORDER.filter(s => counts[s] > 0)
  const otherLabels = Object.keys(counts).filter(s => !FUNNEL_ORDER.includes(s))
  const labels = [...orderedLabels, ...otherLabels]
  const values = labels.map(l => counts[l])
  const total = values.reduce((a,b) => a+b, 0)
  const maxVal = Math.max(...values, 1)

  if (labels.length === 0) {
    container.innerHTML = `<div style="text-align:center;color:#9ca3af;padding:60px 0">Sem dados de Situação da OS</div>`
    updateFunnelObservation(null, total, 100)
    return
  }

  container.innerHTML = `
    <div class="funnel-total">Total: <strong>${total}</strong> obras</div>
    <div class="funnel-bands">
      ${labels.map((label, i) => {
        const val = values[i]
        const pct = total > 0 ? Math.round(val/total*100) : 0
        const widthPct = Math.max(24, Math.round((val/maxVal) * 100))
        const color = getStatusColor(label)
        return `
          <div class="funnel-band" style="width:${widthPct}%;background:${color};margin-top:${i===0?0:-10}px;z-index:${i+1}"
               onmouseenter="updateFunnelObservation('${esc(label)}',${val},${pct})"
               onmouseleave="updateFunnelObservation(null,${total},100)"
               onclick="filterVistoriasByStatus('${esc(label)}')">
            <span class="funnel-band-label">${esc(label)}</span>
            <span class="funnel-band-count">${val} · ${pct}%</span>
          </div>`
      }).join('')}
    </div>`

  // Initial observation state
  updateFunnelObservation(null, total, 100)
}

function updateFunnelObservation(status, count, pct) {
  const panel = document.getElementById('funnelObservation')
  if (!panel) return

  if (!status) {
    panel.innerHTML = `
      <div class="obs-title" style="color:#1a1a1a">Total de Obras</div>
      <div class="obs-value">${count}</div>
      <div class="obs-desc">Passe o mouse sobre os segmentos para ver detalhes de cada situação.</div>
      <div class="obs-legend" id="obs-legend-list"></div>`
    renderObsLegend()
    return
  }

  const desc = STATUS_DESCRIPTIONS[status] || 'Status da ordem de serviço.'
  const color = getStatusColor(status)
  panel.innerHTML = `
    <div class="obs-title" style="color:${color}">${status}</div>
    <div class="obs-value" style="color:${color}">${count}</div>
    <div class="obs-pct">${pct}% do total</div>
    <div class="obs-desc">${desc}</div>
    <button class="btn btn-sm btn-secondary" style="margin-top:12px" onclick="filterVistoriasByStatus('${status}')">
      Ver obras →
    </button>`
}

function renderObsLegend() {
  const el = document.getElementById('obs-legend-list')
  if (!el) return
  const data = getVistoriasByFilter(null)
  const counts = {}
  data.forEach(v => { const s = v.situacao_os||'SEM STATUS'; counts[s]=(counts[s]||0)+1 })
  const total = Object.values(counts).reduce((a,b)=>a+b,0)

  el.innerHTML = FUNNEL_ORDER
    .filter(s => counts[s])
    .map(s => {
      const pct = total > 0 ? Math.round(counts[s]/total*100) : 0
      return `<div class="obs-leg-item">
        <span class="obs-leg-dot" style="background:${getStatusColor(s)}"></span>
        <span class="obs-leg-label">${s}</span>
        <span class="obs-leg-count">${counts[s]} (${pct}%)</span>
      </div>`
    }).join('')
}

// ─── BAR CHART: Obras por UF ─────────────────────────────────
function renderUFBarChart(canvasId, cicloId) {
  destroyChart(canvasId)
  const canvas = document.getElementById(canvasId)
  if (!canvas) return

  const data = getVistoriasByFilter(cicloId)
  const counts = {}
  data.forEach(v => { if (v.uf) counts[v.uf] = (counts[v.uf] || 0) + 1 })
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])

  CHARTS[canvasId] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: sorted.map(e => e[0]),
      datasets: [{
        label: 'Obras',
        data: sorted.map(e => e[1]),
        backgroundColor: '#efbd3f',
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#f0f0f0' } },
        y: { grid: { display: false } }
      }
    }
  })
}

// ─── OBRAS POR ESFERA ────────────────────────────────────
function renderEsferaChart(canvasId, cicloId) {
  destroyChart(canvasId)
  const canvas = document.getElementById(canvasId)
  if (!canvas) return

  const data = getVistoriasByFilter(cicloId)
  const counts = {}
  data.forEach(v => { const e = v.esfera || 'Não informado'; counts[e] = (counts[e] || 0) + 1 })
  const labels = Object.keys(counts).sort((a, b) => counts[b] - counts[a])
  const values = labels.map(l => counts[l])
  const total  = values.reduce((a, b) => a + b, 0)
  const colors = ['#efbd3f', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b']

  CHARTS[canvasId] = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length), borderWidth: 2, borderColor: '#fff', hoverOffset: 6 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '55%',
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => {
          const pct = total > 0 ? Math.round(ctx.raw / total * 100) : 0
          return ` ${ctx.raw} obras (${pct}%)`
        }}}
      }
    }
  })
}

// ─── SITUAÇÃO DA OBRA ─────────────────────────────────────────
const SITUACAO_COLORS = {
  'Execução':                          '#efbd3f',
  'Concluída':                         '#10b981',
  'Paralisada':                        '#ef4444',
  'Não iniciada':                      '#9ca3af',
  'Inacabada':                         '#f97316',
  'Inacabada - PC Técnica Concluída':  '#fb923c',
  'Licitação':                         '#3b82f6',
  'Contratação':                       '#6366f1',
  'Em Reformulação':                   '#a855f7',
  'Obra Cancelada':                    '#4b5563',
}

function renderSituacaoChart(canvasId, cicloId) {
  destroyChart(canvasId)
  const canvas = document.getElementById(canvasId)
  if (!canvas) return

  const data = getVistoriasByFilter(cicloId)
  const counts = {}
  data.forEach(v => { const s = v.situacao || 'Não informado'; counts[s] = (counts[s] || 0) + 1 })
  const labels = Object.keys(counts).sort((a, b) => counts[b] - counts[a])
  const values = labels.map(l => counts[l])
  const total  = values.reduce((a, b) => a + b, 0)
  const colors = labels.map(l => SITUACAO_COLORS[l] || '#6b7280')

  CHARTS[canvasId] = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: '#fff', hoverOffset: 6 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '55%',
      onClick: (evt, elements) => {
        if (elements.length > 0) window.filterVistoriasBySituacao(labels[elements[0].index])
      },
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => {
          const pct = total > 0 ? Math.round(ctx.raw / total * 100) : 0
          return ` ${ctx.raw} obras (${pct}%)`
        }}}
      }
    }
  })
}

// ─── COBERTURA DE DOCUMENTAÇÃO (Foto + ATA) ──────────────
function renderDocumentacaoChart(canvasId, cicloId) {
  destroyChart(canvasId)
  const canvas = document.getElementById(canvasId)
  if (!canvas) return

  const data  = getVistoriasByFilter(cicloId)
  const total = data.length
  const comFoto = data.filter(v => v.foto).length
  const comAta  = data.filter(v => v.ata).length

  CHARTS[canvasId] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Foto', 'ATA'],
      datasets: [
        {
          label: 'Registrado',
          data: [comFoto, comAta],
          backgroundColor: ['#10b981', '#3b82f6'],
          borderRadius: 5,
          borderWidth: 0,
        },
        {
          label: 'Pendente',
          data: [total - comFoto, total - comAta],
          backgroundColor: ['#d1fae5', '#dbeafe'],
          borderRadius: 5,
          borderWidth: 0,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, grid: { color: '#f0f0f0' } }
      },
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => {
          const pct = total > 0 ? Math.round(ctx.raw / total * 100) : 0
          return ` ${ctx.dataset.label}: ${ctx.raw} (${pct}%)`
        }}}
      }
    }
  })
}

// ─── TOP TIPOLOGIAS ──────────────────────────────────────
function renderTipologiaChart(canvasId, cicloId) {
  destroyChart(canvasId)
  const canvas = document.getElementById(canvasId)
  if (!canvas) return

  const data = getVistoriasByFilter(cicloId)
  const counts = {}
  data.forEach(v => { if (v.tipologia) counts[v.tipologia] = (counts[v.tipologia] || 0) + 1 })
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 7)

  CHARTS[canvasId] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: sorted.map(([t]) => t.length > 28 ? t.substring(0, 28) + '…' : t),
      datasets: [{ label: 'Obras', data: sorted.map(([, c]) => c), backgroundColor: '#efbd3f', borderRadius: 4 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false }, tooltip: { callbacks: {
        title: (items) => sorted[items[0].dataIndex][0]
      }}},
      scales: {
        x: { grid: { color: '#f0f0f0' } },
        y: { grid: { display: false }, ticks: { font: { size: 10 } } }
      }
    }
  })
}

// ─── CONTROLE DE PRAZOS: obras por etapa ─────────────────
function renderPrazoEtapaChart(canvasId) {
  destroyChart(canvasId)
  const canvas = document.getElementById(canvasId)
  if (!canvas) return

  const data = Object.values(DB.getVistorias())
  const counts = {}
  ALL_ETAPAS_PRAZO.forEach(e => counts[e] = 0)
  let semEtapa = 0
  data.forEach(v => { if (v.etapa_prazo && counts[v.etapa_prazo] !== undefined) counts[v.etapa_prazo]++; else semEtapa++ })

  const labels = [...ALL_ETAPAS_PRAZO]
  const values = labels.map(l => counts[l])
  if (semEtapa > 0) { labels.push('Sem etapa definida'); values.push(semEtapa) }

  CHARTS[canvasId] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Obras', data: values, backgroundColor: '#efbd3f', borderRadius: 4 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#f0f0f0' } },
        y: { grid: { display: false }, ticks: { font: { size: 10.5 } } }
      }
    }
  })
}

// ─── CONTROLE DE PRAZOS: distribuição por status do prazo ────
function renderPrazoStatusChart(canvasId) {
  destroyChart(canvasId)
  const canvas = document.getElementById(canvasId)
  if (!canvas) return

  const data = Object.values(DB.getVistorias())
  const counts = {}
  data.forEach(v => { const s = getPrazoInfo(v).status; counts[s] = (counts[s]||0) + 1 })

  const order = ['atrasado', 'proximo', 'no_prazo', 'concluido', 'sem_data']
  const labels = order.filter(k => counts[k] > 0).map(k => PRAZO_LABELS[k].label)
  const values = order.filter(k => counts[k] > 0).map(k => counts[k])
  const colorMap = { atrasado: '#ef4444', proximo: '#f97316', no_prazo: '#10b981', concluido: '#6366f1', sem_data: '#9ca3af' }
  const colors = order.filter(k => counts[k] > 0).map(k => colorMap[k])
  const total = values.reduce((a,b)=>a+b, 0)

  CHARTS[canvasId] = new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: '#fff', hoverOffset: 6 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '55%',
      onClick: (evt, elements) => {
        if (elements.length === 0) return
        const statusKeys = order.filter(k => counts[k] > 0)
        const key = statusKeys[elements[0].index]
        STATE.vistorias.filters.prazo = key
        STATE.vistorias.page = 1
        navigate('vistorias')
      },
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => {
          const pct = total > 0 ? Math.round(ctx.raw / total * 100) : 0
          return ` ${ctx.raw} obras (${pct}%)`
        }}}
      }
    }
  })
}

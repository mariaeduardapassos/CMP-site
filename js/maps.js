// Brazil Bubble Map — state centroids (lon, lat)
const STATE_CENTROIDS = {
  'AC': { lon:-70.3, lat:-9.1,  name:'Acre' },
  'AL': { lon:-36.6, lat:-9.7,  name:'Alagoas' },
  'AM': { lon:-65.0, lat:-3.5,  name:'Amazonas' },
  'AP': { lon:-51.4, lat:1.4,   name:'Amapá' },
  'BA': { lon:-41.7, lat:-12.5, name:'Bahia' },
  'CE': { lon:-39.5, lat:-5.1,  name:'Ceará' },
  'DF': { lon:-47.9, lat:-15.7, name:'Distrito Federal' },
  'ES': { lon:-40.5, lat:-19.5, name:'Espírito Santo' },
  'GO': { lon:-49.0, lat:-16.0, name:'Goiás' },
  'MA': { lon:-44.4, lat:-5.3,  name:'Maranhão' },
  'MG': { lon:-44.5, lat:-18.5, name:'Minas Gerais' },
  'MS': { lon:-54.5, lat:-20.5, name:'Mato Grosso do Sul' },
  'MT': { lon:-56.0, lat:-13.0, name:'Mato Grosso' },
  'PA': { lon:-52.3, lat:-3.5,  name:'Pará' },
  'PB': { lon:-36.5, lat:-7.1,  name:'Paraíba' },
  'PE': { lon:-37.0, lat:-8.5,  name:'Pernambuco' },
  'PI': { lon:-42.5, lat:-7.0,  name:'Piauí' },
  'PR': { lon:-51.5, lat:-24.7, name:'Paraná' },
  'RJ': { lon:-43.0, lat:-22.0, name:'Rio de Janeiro' },
  'RN': { lon:-36.5, lat:-5.8,  name:'Rio Grande do Norte' },
  'RO': { lon:-62.8, lat:-10.8, name:'Rondônia' },
  'RR': { lon:-61.4, lat:1.7,   name:'Roraima' },
  'RS': { lon:-53.0, lat:-30.0, name:'Rio Grande do Sul' },
  'SC': { lon:-50.4, lat:-27.2, name:'Santa Catarina' },
  'SE': { lon:-37.3, lat:-10.6, name:'Sergipe' },
  'SP': { lon:-48.5, lat:-22.2, name:'São Paulo' },
  'TO': { lon:-48.0, lat:-9.7,  name:'Tocantins' },
}

// Geo → SVG coordinate conversion
// Brazil bounds: lon [-73.98, -34.79], lat [5.27, -33.75]
function geoToSvg(lon, lat, W, H) {
  const x = (lon + 73.98) / 39.19 * (W * 0.88) + W * 0.06
  const y = (5.27 - lat)  / 39.02 * (H * 0.88) + H * 0.06
  return { x, y }
}

function lerpColor(a, b, t) {
  const hex = c => parseInt(c, 16)
  const r1=hex(a.slice(1,3)), g1=hex(a.slice(3,5)), b1=hex(a.slice(5,7))
  const r2=hex(b.slice(1,3)), g2=hex(b.slice(3,5)), b2=hex(b.slice(5,7))
  const r=Math.round(r1+(r2-r1)*t).toString(16).padStart(2,'0')
  const g=Math.round(g1+(g2-g1)*t).toString(16).padStart(2,'0')
  const bv=Math.round(b1+(b2-b1)*t).toString(16).padStart(2,'0')
  return `#${r}${g}${bv}`
}

function renderBrazilMap(containerId, cicloId) {
  const container = document.getElementById(containerId)
  if (!container) return

  const data = getVistoriasByFilter(cicloId)
  const ufCounts = {}
  data.forEach(v => { if (v.uf) ufCounts[v.uf] = (ufCounts[v.uf] || 0) + 1 })
  const maxCount = Math.max(...Object.values(ufCounts), 1)

  const W = 560, H = 600
  const NS = 'http://www.w3.org/2000/svg'

  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
  svg.setAttribute('width', '100%')
  svg.style.display = 'block'

  // Background
  const bg = document.createElementNS(NS, 'rect')
  bg.setAttribute('width', W); bg.setAttribute('height', H)
  bg.setAttribute('fill', '#fafafa'); bg.setAttribute('rx', '8')
  svg.appendChild(bg)

  // Title
  const title = document.createElementNS(NS, 'text')
  title.setAttribute('x', W/2); title.setAttribute('y', 22)
  title.setAttribute('text-anchor', 'middle')
  title.setAttribute('font-size', '12'); title.setAttribute('font-weight', '700')
  title.setAttribute('fill', '#6b7280'); title.setAttribute('font-family', 'sans-serif')
  title.setAttribute('letter-spacing', '1')
  title.setAttribute('text-decoration', 'none')
  title.textContent = 'DISTRIBUIÇÃO POR ESTADO'
  svg.appendChild(title)

  // Legend
  const lgY = H - 28
  const legend = document.createElementNS(NS, 'g')
  ;[['#e5e7eb','Sem obras'], ['#fde68a','Poucos'], ['#efbd3f','Médio'], ['#b7860e','Muitos']].forEach(([c,l], i) => {
    const cx = 60 + i * 115
    const circ = document.createElementNS(NS, 'circle')
    circ.setAttribute('cx', cx); circ.setAttribute('cy', lgY); circ.setAttribute('r', 7)
    circ.setAttribute('fill', c); circ.setAttribute('stroke', '#ccc'); circ.setAttribute('stroke-width', '1')
    const txt = document.createElementNS(NS, 'text')
    txt.setAttribute('x', cx+12); txt.setAttribute('y', lgY+4)
    txt.setAttribute('font-size', '10'); txt.setAttribute('fill', '#6b7280')
    txt.setAttribute('font-family', 'sans-serif'); txt.textContent = l
    legend.appendChild(circ); legend.appendChild(txt)
  })
  svg.appendChild(legend)

  // Tooltip element
  const tooltip = document.createElementNS(NS, 'g')
  tooltip.setAttribute('id', 'map-tooltip')
  tooltip.style.display = 'none'
  tooltip.style.pointerEvents = 'none'
  const ttRect = document.createElementNS(NS, 'rect')
  ttRect.setAttribute('rx', '5'); ttRect.setAttribute('fill', '#1c1c1c')
  ttRect.setAttribute('opacity', '0.9')
  const ttText = document.createElementNS(NS, 'text')
  ttText.setAttribute('fill', '#fff'); ttText.setAttribute('font-family', 'sans-serif')
  ttText.setAttribute('font-size', '11')
  tooltip.appendChild(ttRect); tooltip.appendChild(ttText)

  // Draw state bubbles
  Object.entries(STATE_CENTROIDS).forEach(([uf, info]) => {
    const count = ufCounts[uf] || 0
    const { x, y } = geoToSvg(info.lon, info.lat, W, H)
    const t = count > 0 ? Math.sqrt(count / maxCount) : 0
    const r = count > 0 ? Math.max(14, t * 38) : 10
    const fill = count > 0 ? lerpColor('#fde68a', '#b7860e', t) : '#e5e7eb'
    const stroke = count > 0 ? '#d4a832' : '#d1d5db'
    const textFill = count > 0 ? '#1c1c1c' : '#9ca3af'

    const g = document.createElementNS(NS, 'g')
    g.style.cursor = count > 0 ? 'pointer' : 'default'

    const circle = document.createElementNS(NS, 'circle')
    circle.setAttribute('cx', x); circle.setAttribute('cy', y); circle.setAttribute('r', r)
    circle.setAttribute('fill', fill); circle.setAttribute('stroke', stroke)
    circle.setAttribute('stroke-width', count > 0 ? '2' : '1')

    const label = document.createElementNS(NS, 'text')
    label.setAttribute('x', x); label.setAttribute('y', y + 4)
    label.setAttribute('text-anchor', 'middle')
    label.setAttribute('font-size', r > 18 ? '10' : '8')
    label.setAttribute('font-weight', '700')
    label.setAttribute('fill', textFill)
    label.setAttribute('font-family', 'sans-serif')
    label.setAttribute('pointer-events', 'none')
    label.textContent = uf

    g.appendChild(circle); g.appendChild(label)

    if (count > 0) {
      g.addEventListener('mouseenter', (e) => {
        tooltip.style.display = 'block'
        const ttMsg = `${info.name}: ${count} obra${count!==1?'s':''}`
        ttText.textContent = ttMsg
        const tw = ttMsg.length * 6.5 + 12
        ttRect.setAttribute('x', x - tw/2); ttRect.setAttribute('y', y - r - 28)
        ttRect.setAttribute('width', tw); ttRect.setAttribute('height', 20)
        ttText.setAttribute('x', x); ttText.setAttribute('y', y - r - 13)
        ttText.setAttribute('text-anchor', 'middle')
      })
      g.addEventListener('mouseleave', () => { tooltip.style.display = 'none' })
      g.addEventListener('click', () => {
        if (window.filterVistoriasByUF) window.filterVistoriasByUF(uf)
      })
    }

    svg.appendChild(g)
  })

  svg.appendChild(tooltip)

  container.innerHTML = ''
  container.appendChild(svg)
}

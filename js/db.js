// ============================================================
// SUPABASE — dados compartilhados em tempo real entre todos os usuários
// ============================================================
const SUPABASE_URL = 'https://qttjqpamapnkddezcilj.supabase.co'
const SUPABASE_KEY = 'sb_publishable_4aGIu1UODAh8_mZWRh-a3A_-wRkWRxW'
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)

// Cache local em memória, sincronizado com o Supabase. Toda a aplicação
// continua lendo daqui de forma síncrona (igual ao localStorage de antes);
// as gravações atualizam o cache na hora (resposta instantânea na tela) e
// mandam a mudança pro Supabase em segundo plano. Mudanças feitas por
// outras pessoas chegam via realtime e atualizam esse cache também.
const CACHE = {
  vistorias: {},
  ciclos: [],
  fiscais: [],
  pops: [],
  precos: {},
  ready: false,
}

let _onRemoteChange = null
let _realtimeSubscribed = false

function _clone(obj) { return JSON.parse(JSON.stringify(obj)) }

const DB = {
  // Busca tudo do Supabase e popula o cache. Chamado uma vez após o login.
  async init() {
    const [v, c, f, p, pr] = await Promise.all([
      supabaseClient.from('vistorias').select('*'),
      supabaseClient.from('ciclos').select('*'),
      supabaseClient.from('fiscais').select('*'),
      supabaseClient.from('pops').select('*'),
      supabaseClient.from('precos').select('*'),
    ])
    if (v.error || c.error || f.error || p.error || pr.error) {
      console.error('Erro ao carregar dados do Supabase:', v.error, c.error, f.error, p.error, pr.error)
      if (typeof toast === 'function') toast('⚠️ Não foi possível carregar os dados do servidor. Verifique sua conexão.', 'error')
    }

    CACHE.vistorias = {}
    ;(v.data || []).forEach(row => { CACHE.vistorias[row.id_obra] = row })
    CACHE.ciclos = c.data || []
    CACHE.fiscais = f.data || []
    CACHE.pops = p.data || []
    CACHE.precos = {}
    ;(pr.data || []).forEach(row => { CACHE.precos[row.uf] = { valorMinimo: row.valor_minimo || '', observacao: row.observacao || '', ativo: row.ativo } })
    CACHE.ready = true

    this._subscribeRealtime()
  },

  // Registra a função a ser chamada quando algo mudar remotamente (outra pessoa editou).
  onRemoteChange(cb) { _onRemoteChange = cb },

  _subscribeRealtime() {
    if (_realtimeSubscribed) return
    _realtimeSubscribed = true

    let timer = null
    const scheduleRerender = () => {
      clearTimeout(timer)
      timer = setTimeout(() => { if (_onRemoteChange) _onRemoteChange() }, 300)
    }

    const upsertInto = (arr, row, keyField) => {
      const idx = arr.findIndex(x => x[keyField] === row[keyField])
      if (idx >= 0) arr[idx] = row; else arr.push(row)
    }

    supabaseClient.channel('cmp-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vistorias' }, (payload) => {
        if (payload.eventType === 'DELETE') delete CACHE.vistorias[payload.old.id_obra]
        else CACHE.vistorias[payload.new.id_obra] = payload.new
        scheduleRerender()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ciclos' }, (payload) => {
        if (payload.eventType === 'DELETE') CACHE.ciclos = CACHE.ciclos.filter(x => x.id !== payload.old.id)
        else upsertInto(CACHE.ciclos, payload.new, 'id')
        scheduleRerender()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fiscais' }, (payload) => {
        if (payload.eventType === 'DELETE') CACHE.fiscais = CACHE.fiscais.filter(x => x.id !== payload.old.id)
        else upsertInto(CACHE.fiscais, payload.new, 'id')
        scheduleRerender()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pops' }, (payload) => {
        if (payload.eventType === 'DELETE') CACHE.pops = CACHE.pops.filter(x => x.id !== payload.old.id)
        else upsertInto(CACHE.pops, payload.new, 'id')
        scheduleRerender()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'precos' }, (payload) => {
        if (payload.eventType === 'DELETE') delete CACHE.precos[payload.old.uf]
        else CACHE.precos[payload.new.uf] = { valorMinimo: payload.new.valor_minimo || '', observacao: payload.new.observacao || '', ativo: payload.new.ativo }
        scheduleRerender()
      })
      .subscribe()
  },

  _reportError(label, error) {
    console.error(label, error)
    if (typeof toast === 'function') toast(`⚠️ ${label} — verifique sua conexão.`, 'error')
  },

  // VISTORIAS
  getVistorias() { return _clone(CACHE.vistorias) },
  saveVistorias(data) {
    CACHE.vistorias = _clone(data)
    const rows = Object.values(data)
    if (rows.length === 0) return
    supabaseClient.from('vistorias').upsert(rows).then(({ error }) => { if (error) this._reportError('Falha ao salvar vistorias', error) })
  },
  getVistoria(id) { return CACHE.vistorias[id] ? _clone(CACHE.vistorias[id]) : null },
  saveVistoria(id, data) {
    CACHE.vistorias[id] = _clone(data)
    supabaseClient.from('vistorias').upsert({ ...data, id_obra: id }).then(({ error }) => { if (error) this._reportError('Falha ao salvar a obra', error) })
  },
  deleteVistoria(id) {
    delete CACHE.vistorias[id]
    supabaseClient.from('vistorias').delete().eq('id_obra', id).then(({ error }) => { if (error) this._reportError('Falha ao excluir a obra', error) })
  },
  // Remove vistorias órfãs (sem nenhum ciclo associado) — cobre tanto obras
  // que ficaram sem ciclo por algum motivo quanto dados deixados para trás
  // por versões antigas do site, que só desmarcavam o ciclo sem apagar a obra.
  limparVistoriasOrfas() {
    let removidas = 0
    const toDelete = []
    Object.keys(CACHE.vistorias).forEach(id => {
      const v = CACHE.vistorias[id]
      if (!v.ciclos || v.ciclos.length === 0) { delete CACHE.vistorias[id]; removidas++; toDelete.push(id) }
    })
    if (toDelete.length) {
      supabaseClient.from('vistorias').delete().in('id_obra', toDelete).then(({ error }) => { if (error) this._reportError('Falha ao limpar vistorias órfãs', error) })
    }
    return removidas
  },

  // CICLOS
  getCiclos() { return _clone(CACHE.ciclos) },
  addCiclo(ciclo) {
    const idx = CACHE.ciclos.findIndex(c => c.id === ciclo.id)
    if (idx >= 0) CACHE.ciclos[idx] = ciclo; else CACHE.ciclos.push(ciclo)
    supabaseClient.from('ciclos').upsert(ciclo).then(({ error }) => { if (error) this._reportError('Falha ao salvar o ciclo', error) })
  },
  // Apaga o ciclo e todo o histórico ligado só a ele: obras que existiam
  // apenas por causa desse ciclo são removidas por completo (o que também
  // as some do Dashboard, SIMEC e Pagamento de Fiscais, já que essas telas
  // leem o mesmo registro de vistoria). Obras que também pertencem a outro
  // ciclo continuam existindo, só perdem a marcação desse ciclo específico.
  deleteCiclo(cicloId) {
    const ciclo = CACHE.ciclos.find(c => c.id === cicloId)
    if (!ciclo) return { removidas: 0, desmarcadas: 0 }
    CACHE.ciclos = CACHE.ciclos.filter(c => c.id !== cicloId)
    supabaseClient.from('ciclos').delete().eq('id', cicloId).then(({ error }) => { if (error) this._reportError('Falha ao excluir o ciclo', error) })

    let removidas = 0, desmarcadas = 0
    const toDelete = [], toUpdate = []
    Object.keys(CACHE.vistorias).forEach(id => {
      const v = CACHE.vistorias[id]
      if (!v.ciclos || !v.ciclos.includes(ciclo.nome)) return
      v.ciclos = v.ciclos.filter(nome => nome !== ciclo.nome)
      if (v.ciclos.length === 0) { delete CACHE.vistorias[id]; removidas++; toDelete.push(id) }
      else { desmarcadas++; toUpdate.push(v) }
    })
    if (toDelete.length) supabaseClient.from('vistorias').delete().in('id_obra', toDelete).then(({ error }) => { if (error) this._reportError('Falha ao excluir obras do ciclo', error) })
    if (toUpdate.length) supabaseClient.from('vistorias').upsert(toUpdate).then(({ error }) => { if (error) this._reportError('Falha ao atualizar obras do ciclo', error) })
    return { removidas, desmarcadas }
  },

  // FISCAIS
  getFiscais() { return _clone(CACHE.fiscais) },
  saveFiscais(data) { CACHE.fiscais = _clone(data) },
  saveFiscal(fiscal) {
    if (fiscal.id) {
      const idx = CACHE.fiscais.findIndex(f => f.id === fiscal.id)
      if (idx >= 0) CACHE.fiscais[idx] = fiscal
      else CACHE.fiscais.push(fiscal)
    } else {
      fiscal.id = Date.now()
      CACHE.fiscais.push(fiscal)
    }
    supabaseClient.from('fiscais').upsert(fiscal).then(({ error }) => { if (error) this._reportError('Falha ao salvar o fiscal', error) })
    return fiscal
  },
  deleteFiscal(id) {
    CACHE.fiscais = CACHE.fiscais.filter(f => f.id !== id)
    supabaseClient.from('fiscais').delete().eq('id', id).then(({ error }) => { if (error) this._reportError('Falha ao excluir o fiscal', error) })
  },
  deleteAllFiscais() {
    const ids = CACHE.fiscais.map(f => f.id)
    CACHE.fiscais = []
    if (ids.length) supabaseClient.from('fiscais').delete().in('id', ids).then(({ error }) => { if (error) this._reportError('Falha ao excluir os fiscais', error) })
  },

  // POPS — Procedimentos Operacionais Padrão
  getPops() { return _clone(CACHE.pops) },
  savePops(data) { CACHE.pops = _clone(data) },
  savePop(pop) {
    if (pop.id) {
      const idx = CACHE.pops.findIndex(p => p.id === pop.id)
      if (idx >= 0) CACHE.pops[idx] = pop
      else CACHE.pops.push(pop)
    } else {
      pop.id = Date.now()
      CACHE.pops.push(pop)
    }
    supabaseClient.from('pops').upsert(pop).then(({ error }) => { if (error) this._reportError('Falha ao salvar o POP', error) })
    return pop
  },
  deletePop(id) {
    CACHE.pops = CACHE.pops.filter(p => p.id !== id)
    supabaseClient.from('pops').delete().eq('id', id).then(({ error }) => { if (error) this._reportError('Falha ao excluir o POP', error) })
  },

  // PREÇOS — valor mínimo de vistoria por estado (UF)
  getPrecos() { return _clone(CACHE.precos) },
  savePrecos(data) { CACHE.precos = _clone(data) },
  savePreco(uf, data) {
    CACHE.precos[uf] = { ...(CACHE.precos[uf] || {}), ...data }
    const merged = CACHE.precos[uf]
    const row = { uf, valor_minimo: merged.valorMinimo || '', observacao: merged.observacao || '' }
    // Só envia "ativo" quando ele já foi definido alguma vez, para que a
    // edição de valor/observação continue funcionando mesmo antes da coluna
    // "ativo" existir na tabela do Supabase.
    if (merged.ativo !== undefined) row.ativo = merged.ativo
    supabaseClient.from('precos').upsert(row)
      .then(({ error }) => { if (error) this._reportError('Falha ao salvar o preço', error) })
  },

  // AUTH — permanece local por dispositivo (não faz parte dos dados sincronizados)
  login(user, pass) {
    const creds = this._get('cmp_auth', { u: 'admin', p: 'cmp2024' })
    if (user.trim() === creds.u && pass === creds.p) {
      sessionStorage.setItem('cmp_logged', '1')
      return true
    }
    return false
  },
  logout() { sessionStorage.removeItem('cmp_logged') },
  isLoggedIn() { return !!sessionStorage.getItem('cmp_logged') },
  changePassword(u, p) { this._set('cmp_auth', { u, p }) },
  _get(key, def) {
    try { return JSON.parse(localStorage.getItem(key)) ?? def }
    catch { return def }
  },
  _set(key, val) { localStorage.setItem(key, JSON.stringify(val)) },
}

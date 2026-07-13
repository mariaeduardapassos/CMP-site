const DB = {
  _get(key, def) {
    try { return JSON.parse(localStorage.getItem(key)) ?? def }
    catch { return def }
  },
  _set(key, val) { localStorage.setItem(key, JSON.stringify(val)) },

  getVistorias() { return this._get('cmp_vistorias', {}) },
  saveVistorias(data) { this._set('cmp_vistorias', data) },
  getVistoria(id) { return this.getVistorias()[id] || null },
  saveVistoria(id, data) {
    const all = this.getVistorias()
    all[id] = data
    this.saveVistorias(all)
  },

  getCiclos() { return this._get('cmp_ciclos', []) },
  addCiclo(ciclo) {
    const ciclos = this.getCiclos()
    const idx = ciclos.findIndex(c => c.id === ciclo.id)
    if (idx >= 0) ciclos[idx] = ciclo
    else ciclos.push(ciclo)
    this._set('cmp_ciclos', ciclos)
  },

  getFiscais() { return this._get('cmp_fiscais', []) },
  saveFiscais(data) { this._set('cmp_fiscais', data) },
  saveFiscal(fiscal) {
    const all = this.getFiscais()
    if (fiscal.id) {
      const idx = all.findIndex(f => f.id === fiscal.id)
      if (idx >= 0) all[idx] = fiscal
      else all.push(fiscal)
    } else {
      fiscal.id = Date.now()
      all.push(fiscal)
    }
    this._set('cmp_fiscais', all)
    return fiscal
  },
  deleteFiscal(id) {
    const all = this.getFiscais().filter(f => f.id !== id)
    this._set('cmp_fiscais', all)
  },

  // DELETE — ciclo (em massa) e ordem/vistoria individual
  // Apaga o ciclo e todo o histórico ligado só a ele: obras que existiam
  // apenas por causa desse ciclo são removidas por completo (o que também
  // as some do Dashboard, SIMEC e Pagamento de Fiscais, já que essas telas
  // leem o mesmo registro de vistoria). Obras que também pertencem a outro
  // ciclo continuam existindo, só perdem a marcação desse ciclo específico.
  deleteCiclo(cicloId) {
    const ciclos = this.getCiclos()
    const ciclo = ciclos.find(c => c.id === cicloId)
    if (!ciclo) return { removidas: 0, desmarcadas: 0 }
    this._set('cmp_ciclos', ciclos.filter(c => c.id !== cicloId))

    const vistorias = this.getVistorias()
    let removidas = 0, desmarcadas = 0
    Object.keys(vistorias).forEach(id => {
      const v = vistorias[id]
      if (!v.ciclos || !v.ciclos.includes(ciclo.nome)) return
      v.ciclos = v.ciclos.filter(nome => nome !== ciclo.nome)
      if (v.ciclos.length === 0) { delete vistorias[id]; removidas++ }
      else desmarcadas++
    })
    this.saveVistorias(vistorias)
    return { removidas, desmarcadas }
  },
  deleteVistoria(id) {
    const all = this.getVistorias()
    delete all[id]
    this.saveVistorias(all)
  },
  // Remove vistorias órfãs (sem nenhum ciclo associado) — cobre tanto obras
  // que ficaram sem ciclo por algum motivo quanto dados deixados para trás
  // por versões antigas do site, que só desmarcavam o ciclo sem apagar a obra.
  limparVistoriasOrfas() {
    const vistorias = this.getVistorias()
    let removidas = 0
    Object.keys(vistorias).forEach(id => {
      const v = vistorias[id]
      if (!v.ciclos || v.ciclos.length === 0) { delete vistorias[id]; removidas++ }
    })
    if (removidas > 0) this.saveVistorias(vistorias)
    return removidas
  },

  // POPS — Procedimentos Operacionais Padrão
  getPops() { return this._get('cmp_pops', []) },
  savePops(data) { this._set('cmp_pops', data) },
  savePop(pop) {
    const all = this.getPops()
    if (pop.id) {
      const idx = all.findIndex(p => p.id === pop.id)
      if (idx >= 0) all[idx] = pop
      else all.push(pop)
    } else {
      pop.id = Date.now()
      all.push(pop)
    }
    this._set('cmp_pops', all)
    return pop
  },
  deletePop(id) {
    const all = this.getPops().filter(p => p.id !== id)
    this._set('cmp_pops', all)
  },

  // PREÇOS — valor mínimo de vistoria por estado (UF)
  getPrecos() { return this._get('cmp_precos', {}) },
  savePrecos(data) { this._set('cmp_precos', data) },
  savePreco(uf, data) {
    const all = this.getPrecos()
    all[uf] = { ...(all[uf]||{}), ...data }
    this._set('cmp_precos', all)
  },

  clear() {
    localStorage.removeItem('cmp_vistorias')
    localStorage.removeItem('cmp_ciclos')
    localStorage.removeItem('cmp_fiscais')
    localStorage.removeItem('cmp_pops')
    localStorage.removeItem('cmp_precos')
  },

  // AUTH
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
  changePassword(u, p) { this._set('cmp_auth', { u, p }) }
}

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

  clear() {
    localStorage.removeItem('cmp_vistorias')
    localStorage.removeItem('cmp_ciclos')
    localStorage.removeItem('cmp_fiscais')
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

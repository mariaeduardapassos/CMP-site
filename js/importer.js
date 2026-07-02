function importExcel(file, cicloNome) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const wb = XLSX.read(data, { type: 'array' })
        resolve(processWorkbook(wb, cicloNome))
      } catch (err) { reject(err) }
    }
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'))
    reader.readAsArrayBuffer(file)
  })
}

function processWorkbook(wb, cicloNome) {
  const geralName = wb.SheetNames.find(n => n.toLowerCase().includes('geral')) || wb.SheetNames[0]
  if (!geralName) throw new Error('Aba "Geral" não encontrada na planilha')

  const rows = XLSX.utils.sheet_to_json(wb.Sheets[geralName], { defval: '' })
  const vistorias = DB.getVistorias()
  let novas = 0, atualizadas = 0

  for (const row of rows) {
    const id = String(row['ID DA OBRA'] || '').trim()
    if (!id || id === '0') continue

    const baseData = {
      id_obra: id,
      uf: String(row['UF'] || '').trim(),
      quem: String(row['Quem'] || '').trim(),
      esfera: String(row['ESFERA'] || '').trim(),
      municipio: String(row['MUNICÍPIO'] || '').trim(),
      tipologia: String(row['TIPOLOGIA DA OBRA'] || '').trim(),
      situacao: String(row['SITUAÇÃO'] || '').trim(),
      coordenada: String(row['COORDENADA'] || '').trim(),
      escola: String(row['ESCOLA'] || '').trim(),
      fiscal: String(row['FISCAIS'] || '').trim(),
      valor: String(row['VALOR'] || '').trim(),
      situacao_os: String(row['SITUAÇÃO DA OS'] || '').trim(),
    }

    const existing = vistorias[id]
    if (existing) {
      vistorias[id] = {
        ...existing,
        ...baseData,
        foto: existing.foto || String(row['FOTO'] || '').trim(),
        ata: existing.ata || String(row['ATA'] || '').trim(),
        observacao: existing.observacao || String(row['OBSERVAÇÃO'] || '').trim(),
        ciclos: [...new Set([...(existing.ciclos || []), cicloNome])],
        ultima_atualizacao: new Date().toISOString().split('T')[0]
      }
      atualizadas++
    } else {
      vistorias[id] = {
        ...baseData,
        foto: String(row['FOTO'] || '').trim(),
        ata: String(row['ATA'] || '').trim(),
        observacao: String(row['OBSERVAÇÃO'] || '').trim(),
        ciclos: [cicloNome],
        ultima_atualizacao: new Date().toISOString().split('T')[0]
      }
      novas++
    }
  }

  DB.saveVistorias(vistorias)

  const cicloId = cicloNome.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  DB.addCiclo({
    id: cicloId,
    nome: cicloNome,
    data: new Date().toISOString().split('T')[0],
    total: novas + atualizadas
  })

  // Process Fiscais sheet if present
  const fiscaisResult = { importados: 0, atualizados: 0 }
  const fiscaisName = wb.SheetNames.find(n => n.toLowerCase().includes('fiscal'))
  if (fiscaisName) {
    const r = mergeFiscaisSheet(wb.Sheets[fiscaisName])
    fiscaisResult.importados = r.importados
    fiscaisResult.atualizados = r.atualizados
  }

  return { novas, atualizadas, fiscaisImportados: fiscaisResult.importados, total: novas + atualizadas }
}

// ─── FISCAIS MERGE (shared by processWorkbook + importFiscaisOnly) ──
function mergeFiscaisSheet(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  if (!rows.length) return { importados: 0, atualizados: 0 }

  // Case-insensitive column lookup
  const headers = Object.keys(rows[0])
  function col(row, ...candidates) {
    for (const c of candidates) {
      const key = headers.find(h => h.toLowerCase().trim() === c.toLowerCase())
      if (key !== undefined) return String(row[key] || '').trim()
    }
    return ''
  }

  const existing = DB.getFiscais()
  let importados = 0, atualizados = 0

  for (const row of rows) {
    const nome = col(row, 'nome', 'name', 'fiscal', 'nome completo')
    if (!nome) continue
    const idx = existing.findIndex(f => f.nome === nome)
    const entry = {
      nome,
      estado:    col(row, 'estado', 'uf', 'state'),
      municipio: col(row, 'município', 'municipio', 'cidade', 'city'),
      cpf:       col(row, 'cpf'),
      contato:   col(row, 'contato', 'telefone', 'celular', 'tel', 'fone'),
      observacao:col(row, 'observação', 'observacao', 'obs'),
    }
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...entry }
      atualizados++
    } else {
      existing.push({ id: Date.now() + importados, ...entry })
      importados++
    }
  }
  DB.saveFiscais(existing)
  return { importados, atualizados }
}

// ─── STANDALONE FISCAIS IMPORT (from Fiscais page) ──────────
function _findFiscaisSheet(wb) {
  // 1. Try by name (multiple strategies)
  const byName = wb.SheetNames.find(n => {
    const clean = Array.from(n).map(c => c.charCodeAt(0) < 128 ? c.toLowerCase() : c).join('').trim()
    return clean.includes('fiscal') || clean.includes('fiscai')
  })
  if (byName) return byName

  // 2. Fallback: find sheet that has "Nome" + ("Contato" or "CPF") columns
  for (const name of wb.SheetNames) {
    try {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '', range: 0 })
      if (!rows.length) continue
      const keys = Object.keys(rows[0]).map(k => k.toLowerCase().trim())
      if (keys.some(k => k === 'nome') && keys.some(k => k === 'cpf' || k === 'contato')) return name
    } catch(e) { /* skip */ }
  }
  return null
}

function importFiscaisOnly(file) {
  return new Promise((resolve, reject) => {
    if (typeof XLSX === 'undefined') {
      reject(new Error('Biblioteca XLSX não carregada. Recarregue a página.'))
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' })
        const sheetName = _findFiscaisSheet(wb)
        if (!sheetName) throw new Error(`Aba de fiscais não encontrada. Abas disponíveis: ${wb.SheetNames.join(', ')}`)
        const result = mergeFiscaisSheet(wb.Sheets[sheetName])
        resolve(result)
      } catch(err) { reject(err) }
    }
    reader.onerror = (e) => reject(new Error('Falha ao ler arquivo: ' + e.target.error))
    reader.readAsArrayBuffer(file)
  })
}

function previewExcel(file, maxRows = 5) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const wb = XLSX.read(data, { type: 'array' })
        const name = wb.SheetNames.find(n => n.toLowerCase().includes('geral')) || wb.SheetNames[0]
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' })
        resolve({ headers: rows.length ? Object.keys(rows[0]) : [], rows: rows.slice(0, maxRows), total: rows.length })
      } catch (err) { reject(err) }
    }
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'))
    reader.readAsArrayBuffer(file)
  })
}

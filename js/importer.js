function importExcel(file, cicloNome, prazoDataInicio) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const wb = XLSX.read(data, { type: 'array' })
        resolve(processWorkbook(wb, cicloNome, prazoDataInicio))
      } catch (err) { reject(err) }
    }
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'))
    reader.readAsArrayBuffer(file)
  })
}

// ─── LOCALIZAÇÃO DA TABELA DE OBRAS DENTRO DA ABA ───────────
// A planilha real vem com um bloco de observações + uma tabela de resumo por UF
// antes da tabela de obras propriamente dita, tudo na mesma aba. Por isso não dá
// para assumir que o cabeçalho está na linha 1: é preciso procurar a linha que
// contém as colunas "ID" e "Obra" (ou "Situação da Obra") e tratar essa linha
// como cabeçalho, ignorando tudo antes dela.
const OBRAS_HEADER_MARKERS = ['id', 'obra']

function findObrasSheet(wb) {
  for (const name of wb.SheetNames) {
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', blankrows: false })
    const headerRowIdx = findHeaderRowIndex(aoa)
    if (headerRowIdx >= 0) return { name, aoa, headerRowIdx }
  }
  return null
}

function findHeaderRowIndex(aoa) {
  for (let i = 0; i < aoa.length; i++) {
    const row = aoa[i].map(c => String(c || '').trim().toLowerCase())
    const hasAll = OBRAS_HEADER_MARKERS.every(marker => row.includes(marker))
    if (hasAll) return i
  }
  return -1
}

function rowsFromHeaderIndex(aoa, headerRowIdx) {
  const headers = aoa[headerRowIdx].map(h => String(h || '').trim())
  const rows = []
  for (let i = headerRowIdx + 1; i < aoa.length; i++) {
    const raw = aoa[i]
    if (!raw || raw.every(c => String(c || '').trim() === '')) continue
    const obj = {}
    headers.forEach((h, idx) => { if (h) obj[h] = raw[idx] !== undefined ? raw[idx] : '' })
    rows.push(obj)
  }
  return rows
}

// ─── LIMPEZA DE TEXTO ────────────────────────────────────────
function cleanEscolaNome(obraRaw, id, municipio, uf) {
  let s = String(obraRaw || '').trim()
  s = s.replace(/<\/?a[^>]*>/gi, '').trim() // remove tags soltas tipo </a> (resíduo de export)
  const prefix = `(${id}) `
  if (s.startsWith(prefix)) s = s.slice(prefix.length)
  if (municipio && uf) {
    const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const suffixRe = new RegExp(`\\s*[-/]\\s*${escapeRe(municipio)}\\s*[-/]\\s*${escapeRe(uf)}\\s*$`, 'i')
    s = s.replace(suffixRe, '')
  }
  return s.trim()
}

// ─── ESFERA (derivada da Unidade Implantadora, que não tem coluna própria) ──
function classificarEsfera(unidade) {
  const u = String(unidade || '').toUpperCase()
  if (!u) return ''
  if (/^PREF(EITURA)?\s*MUN/.test(u)) return 'Municipal'
  if (/ESTADUAL|ESTADO|SEE[- ]|SECITEC/.test(u)) return 'Estadual'
  if (/FEDERAL|\bMEC\b|\bFNDE\b/.test(u)) return 'Federal'
  return ''
}

// ─── COORDENADAS: "8.34.33.S" (graus.minutos.segundos.direção) → decimal ────
function dmsParaDecimal(valor) {
  const s = String(valor || '').trim()
  const m = s.match(/^(\d+)\.(\d+)\.(\d+)\.?\s*([NSEW])$/i)
  if (!m) return ''
  const [, deg, min, sec, dir] = m
  let dec = Number(deg) + Number(min) / 60 + Number(sec) / 3600
  if (/[SW]/i.test(dir)) dec = -dec
  return dec.toFixed(4)
}

function coordenadaFromLatLon(lat, lon) {
  const latDec = dmsParaDecimal(lat)
  const lonDec = dmsParaDecimal(lon)
  if (!latDec || !lonDec) return ''
  return `${latDec}, ${lonDec}`
}

// ─── IMPORTAÇÃO PRINCIPAL ────────────────────────────────────
function processWorkbook(wb, cicloNome, prazoDataInicio) {
  const found = findObrasSheet(wb)
  if (!found) throw new Error('Não encontrei a tabela de obras na planilha (procurei uma linha de cabeçalho com colunas "ID" e "Obra").')

  const rows = rowsFromHeaderIndex(found.aoa, found.headerRowIdx)
  const vistorias = DB.getVistorias()
  let novas = 0, atualizadas = 0, ignoradas = 0

  for (const row of rows) {
    const id = String(row['ID'] || '').trim()
    if (!id || id === '0') continue

    const removerDaLista = String(row['REMOVER DA LISTA'] || '').trim().toUpperCase()
    if (removerDaLista === 'X') { ignoradas++; continue }

    const municipio = String(row['Município'] || '').trim()
    const uf = String(row['UF'] || '').trim()
    const unidade = String(row['Unidade Implantadora'] || '').trim()

    const baseData = {
      id_obra: id,
      uf,
      esfera: classificarEsfera(unidade),
      municipio,
      tipologia: String(row['Tipologia'] || '').trim(),
      situacao: String(row['Situação da Obra'] || '').trim(),
      coordenada: coordenadaFromLatLon(row['Latitude'], row['Longitude']),
      escola: cleanEscolaNome(row['Obra'], id, municipio, uf),
    }

    const existing = vistorias[id]
    if (existing) {
      vistorias[id] = {
        ...existing,
        ...baseData,
        quem: existing.quem || '',
        fiscal: existing.fiscal || '',
        valor: existing.valor || '',
        situacao_os: existing.situacao_os || '',
        foto: existing.foto || '',
        ata: existing.ata || '',
        observacao: existing.observacao || '',
        memorial_calculo: existing.memorial_calculo || '',
        vistoriador: existing.vistoriador || '',
        obs_lancamento: existing.obs_lancamento || '',
        obs_simec: existing.obs_simec || '',
        status_pagamento: existing.status_pagamento || '',
        prazo_data_inicio: existing.prazo_data_inicio || prazoDataInicio || '',
        etapa_prazo: existing.etapa_prazo || 'Tempo de Organização Extra',
        ciclos: [...new Set([...(existing.ciclos || []), cicloNome])],
        ultima_atualizacao: new Date().toISOString().split('T')[0]
      }
      atualizadas++
    } else {
      vistorias[id] = {
        ...baseData,
        quem: '',
        fiscal: '',
        valor: '',
        situacao_os: '',
        foto: '',
        ata: '',
        observacao: '',
        memorial_calculo: '',
        vistoriador: '',
        obs_lancamento: '',
        obs_simec: '',
        status_pagamento: '',
        prazo_data_inicio: prazoDataInicio || '',
        etapa_prazo: 'Tempo de Organização Extra',
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

  // Aba de Fiscais, se existir (a planilha de obras normalmente não traz uma)
  const fiscaisResult = { importados: 0, atualizados: 0 }
  const fiscaisName = wb.SheetNames.find(n => n.toLowerCase().includes('fiscal'))
  if (fiscaisName) {
    const r = mergeFiscaisSheet(wb.Sheets[fiscaisName])
    fiscaisResult.importados = r.importados
    fiscaisResult.atualizados = r.atualizados
  }

  return { novas, atualizadas, ignoradas, fiscaisImportados: fiscaisResult.importados, total: novas + atualizadas }
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
        const found = findObrasSheet(wb)
        if (!found) throw new Error('Não encontrei a tabela de obras na planilha.')
        const rows = rowsFromHeaderIndex(found.aoa, found.headerRowIdx)
        const preview = rows.slice(0, maxRows).map(row => {
          const id = String(row['ID'] || '').trim()
          const municipio = String(row['Município'] || '').trim()
          const uf = String(row['UF'] || '').trim()
          const unidade = String(row['Unidade Implantadora'] || '').trim()
          return {
            'ID DA OBRA': id,
            'UF': uf,
            'MUNICÍPIO': municipio,
            'ESCOLA': cleanEscolaNome(row['Obra'], id, municipio, uf),
            'ESFERA': classificarEsfera(unidade),
            'SITUAÇÃO': String(row['Situação da Obra'] || '').trim(),
            'REMOVER DA LISTA': String(row['REMOVER DA LISTA'] || '').trim(),
          }
        })
        resolve({ headers: preview.length ? Object.keys(preview[0]) : [], rows: preview, total: rows.length })
      } catch (err) { reject(err) }
    }
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'))
    reader.readAsArrayBuffer(file)
  })
}

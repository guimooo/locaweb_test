// Carregamento dos JSON pré-calculados (em public/dados/).
// Um hook simples com cache em memória — os arquivos são estáticos e pequenos.

import { useEffect, useState } from 'react'

const BASE = `${import.meta.env.BASE_URL}dados/`
const cache = new Map()

async function buscar(nome) {
  if (cache.has(nome)) return cache.get(nome)
  const p = fetch(`${BASE}${nome}.json`).then((r) => {
    if (!r.ok) throw new Error(`falha ao carregar ${nome}.json (${r.status})`)
    return r.json()
  })
  cache.set(nome, p)
  return p
}

/**
 * useDados('kpis', 'serie_diaria') -> { dados: {kpis, serie_diaria}, erro, carregando }
 */
export function useDados(...nomes) {
  const chave = nomes.join(',')
  const [estado, setEstado] = useState({ dados: null, erro: null, carregando: true })

  useEffect(() => {
    let vivo = true
    setEstado({ dados: null, erro: null, carregando: true })
    Promise.all(nomes.map(buscar))
      .then((res) => {
        if (!vivo) return
        const dados = Object.fromEntries(nomes.map((n, i) => [n, res[i]]))
        setEstado({ dados, erro: null, carregando: false })
      })
      .catch((e) => vivo && setEstado({ dados: null, erro: e.message, carregando: false }))
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])

  return estado
}

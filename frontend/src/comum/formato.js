// Formatação pt-BR — números, percentuais e datas.

const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const n0 = (v) => (v == null || Number.isNaN(v) ? '—' : nf0.format(v))
export const n1 = (v) => (v == null || Number.isNaN(v) ? '—' : nf1.format(v))
export const n2 = (v) => (v == null || Number.isNaN(v) ? '—' : nf2.format(v))

export const pct = (v, casas = 1) =>
  v == null || Number.isNaN(v) ? '—' : `${(casas === 0 ? nf0 : nf1).format(v)}%`

export const sinalPct = (v) => {
  if (v == null || Number.isNaN(v)) return '—'
  const s = v > 0 ? '+' : ''
  return `${s}${nf1.format(v)}%`
}

// "2025-12-31" -> "31/12/2025"
export const dataBR = (iso) => {
  if (!iso) return '—'
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

// "2025-12-31" -> "31/12"
export const diaMes = (iso) => {
  if (!iso) return '—'
  const [, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}`
}

// "2025-09" -> "set/25"
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const anoMesBR = (iso) => {
  if (!iso) return '—'
  const [a, m] = iso.slice(0, 7).split('-')
  return `${MES[Number(m) - 1]}/${a.slice(2)}`
}

export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

// nomes de classe/grupo em rótulo legível
export const rotulo = (chave) =>
  ({
    com_intervencao: 'Com intervenção',
    sem_intervencao: 'Sem intervenção',
    total: 'Total (modelo único)',
    erro_aplicacao: 'Erro de aplicação',
    infraestrutura_rede: 'Infraestrutura / rede',
    disponibilidade_servico: 'Disponibilidade de serviço',
    performance_degradada: 'Performance degradada',
    armazenamento_disco: 'Armazenamento / disco',
    banco_de_dados: 'Banco de dados',
    certificado_seguranca: 'Certificado / segurança',
    backup_replicacao: 'Backup / replicação',
    job_processamento: 'Job / processamento',
    nao_rotulado: 'Não rotulado (cauda)',
    outros: 'Outros',
  }[chave] || cap(String(chave).replace(/_/g, ' ')))

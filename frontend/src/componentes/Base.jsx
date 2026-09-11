// Peças de UI reutilizáveis: Painel, KPI, Aviso, Estado (carregando/erro), Selo.

import { n0 } from '../comum/formato.js'

export function Estado({ carregando, erro, children }) {
  if (carregando) return <div className="carregando">Carregando dados…</div>
  if (erro) return <div className="carregando">Não foi possível carregar: {erro}</div>
  return children
}

export function Painel({ titulo, sub, nota, className = '', style, children }) {
  return (
    <section className={`painel ${className}`} style={style}>
      {titulo && <h2>{titulo}</h2>}
      {sub && <p className="sub">{sub}</p>}
      {children}
      {nota && <p className="nota">{nota}</p>}
    </section>
  )
}

export function Kpi({ rotulo, valor, pe, destaque = false }) {
  return (
    <div className={`kpi ${destaque ? 'destaque' : ''}`}>
      <div className="rot">{rotulo}</div>
      <div className="val tabular">{valor}</div>
      {pe && <div className="pe">{pe}</div>}
    </div>
  )
}

export function LinhaKpis({ children }) {
  return <div className="kpis">{children}</div>
}

export function Aviso({ nivel = 'info', titulo, children }) {
  return (
    <div className={`aviso ${nivel}`}>
      {titulo && <b>{titulo}</b>}
      {children}
    </div>
  )
}

const ICONE = { ok: '●', atencao: '▲', critico: '■', neutro: '○' }

export function Selo({ nivel = 'neutro', children }) {
  return (
    <span className={`selo ${nivel}`}>
      <span aria-hidden style={{ display: 'none' }}>{ICONE[nivel]}</span>
      {children}
    </span>
  )
}

export function SeletorData({ datas, valor, onChange, producao }) {
  const i = datas.indexOf(valor)
  const ir = (delta) => {
    const j = Math.min(datas.length - 1, Math.max(0, i + delta))
    onChange(datas[j])
  }
  return (
    <div className="seletor-data">
      <button onClick={() => ir(-1)} disabled={i <= 0} aria-label="dia anterior">‹</button>
      <input
        type="date"
        value={valor}
        min={datas[0]}
        max={datas[datas.length - 1]}
        onChange={(e) => datas.includes(e.target.value) && onChange(e.target.value)}
      />
      <button onClick={() => ir(1)} disabled={i >= datas.length - 1} aria-label="próximo dia">›</button>
      <input
        type="range"
        min={0}
        max={datas.length - 1}
        value={i < 0 ? 0 : i}
        onChange={(e) => onChange(datas[Number(e.target.value)])}
      />
      {valor === producao && <span className="selo atencao">caso de produção</span>}
    </div>
  )
}

export function BarraShare({ valor, total, cor = 'var(--serie-1)' }) {
  const p = total > 0 ? (valor / total) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 8, background: 'var(--plano)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${p}%`, height: '100%', background: cor, borderRadius: 4 }} />
      </div>
      <span className="tabular" style={{ minWidth: 56, textAlign: 'right', color: 'var(--tinta-2)' }}>
        {n0(valor)}
      </span>
    </div>
  )
}

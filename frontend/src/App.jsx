import { NavLink, Outlet } from 'react-router-dom'
import { useDados } from './comum/dados.js'
import { dataBR } from './comum/formato.js'

const ABAS = [
  { para: '/', rot: 'Visão executiva', fim: true },
  { para: '/comando', rot: 'Command Center' },
  { para: '/operacional', rot: 'Análise operacional' },
  { para: '/previsao', rot: 'Tendência & previsão' },
  { para: '/alertas', rot: 'Risco & alertas' },
]

export default function App() {
  const { dados } = useDados('meta', 'kpis')
  const fim = dados?.kpis?.periodo?.fim

  return (
    <div className="casca">
      <header className="topo">
        <div className="topo-interno">
          <div className="marca">
            <span className="ponto" />
            <b>Ddip</b>
            <span>Antecipação de incidentes · Locaweb</span>
          </div>
          <nav className="abas">
            {ABAS.map((a) => (
              <NavLink
                key={a.para}
                to={a.para}
                end={a.fim}
                className={({ isActive }) => (isActive ? 'ativo' : '')}
              >
                {a.rot}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="rodape">
        Retrato estático · dados de {fim ? `até ${dataBR(fim)}` : '2023–2025'} · modelos
        congelados no treino. Este painel não é tempo real. · Projeto challenge_locaweb — grupo Ddip
      </footer>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { useDados } from '../comum/dados.js'
import { Estado, Painel, Kpi, LinhaKpis, Aviso, BarraShare } from '../componentes/Base.jsx'
import { SerieTemporal, BarrasHorizontais } from '../componentes/Grafico.jsx'
import { n0, n1, dataBR, diaMes, rotulo } from '../comum/formato.js'
import { PRIORIDADE, GRUPO } from '../comum/paleta.js'

const VISOES = {
  prioridade: {
    rot: 'Por prioridade',
    series: [
      { chave: '2', nome: 'P2', cor: PRIORIDADE[2] },
      { chave: '3', nome: 'P3', cor: PRIORIDADE[3] },
      { chave: '4', nome: 'P4', cor: PRIORIDADE[4] },
    ],
  },
  tipo: {
    rot: 'Por tipo de tratamento',
    series: [
      { chave: 'com_intervencao', nome: 'Com intervenção', cor: GRUPO.com_intervencao },
      { chave: 'sem_intervencao', nome: 'Sem intervenção', cor: GRUPO.sem_intervencao },
    ],
  },
  total: { rot: 'Total', series: [{ chave: 'total', nome: 'Total', cor: '#14140f' }] },
}

// KPIs recalculados no cliente a partir de serie_diaria — é o que deixa o filtro de
// período (2025 × histórico completo) valer pra página inteira, não só pro gráfico.
function calcularKpis(serie) {
  const totais = serie.map((d) => d.total)
  const somar = (chave) => serie.reduce((a, d) => a + (d[chave] || 0), 0)
  const pico = serie.reduce((m, d) => (d.total > m.total ? d : m), serie[0])
  const total = somar('total')
  return {
    total,
    dias: serie.length,
    media: totais.length ? total / totais.length : 0,
    porPrioridade: { 2: somar('2'), 3: somar('3'), 4: somar('4') },
    comIntervencao: somar('com_intervencao'),
    semIntervencao: somar('sem_intervencao'),
    pico,
  }
}

export default function VisaoExecutiva() {
  const { dados, erro, carregando } = useDados('kpis', 'serie_diaria', 'por_classe')
  const [visao, setVisao] = useState('prioridade')
  const [periodo, setPeriodo] = useState('2025')

  const serie = useMemo(() => {
    if (!dados) return []
    const s = dados.serie_diaria
    return periodo === '2025' ? s.filter((d) => d.data >= '2025-01-01') : s
  }, [dados, periodo])

  const k = useMemo(() => (serie.length ? calcularKpis(serie) : null), [serie])
  const classes = dados?.por_classe[periodo]
  const rotuloPeriodo = periodo === '2025' ? 'em 2025' : 'no histórico completo (2023–2025)'

  return (
    <Estado carregando={carregando} erro={erro}>
      {dados && k && (
        <>
          <div className="pg-cabecalho">
            <h1>Visão executiva</h1>
            <p>O problema operacional da Locaweb em números — quanto volume, onde ele se concentra e o que mudou.</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 12.5, color: 'var(--tinta-2)', fontWeight: 600 }}>Período</span>
            <span className="toggle">
              {['2025', 'tudo'].map((p) => (
                <button key={p} className={periodo === p ? 'on' : ''} onClick={() => setPeriodo(p)}>
                  {p === '2025' ? '2025' : 'Histórico completo'}
                </button>
              ))}
            </span>
            {periodo === 'tudo' && (
              <span style={{ fontSize: 11.5, color: 'var(--tinta-3)' }}>
                inclui 2023–2024, artefato de extração (0,6% da base) — ver nota abaixo
              </span>
            )}
          </div>

          <LinhaKpis>
            <Kpi
              rotulo={`Incidentes ${rotuloPeriodo}`}
              valor={n0(k.total)}
              pe={`${k.dias} dias · P2/P3/P4`}
            />
            <Kpi
              rotulo="Média diária — antes da automação"
              valor={n1(dados.kpis.regimes.r2.media_diaria)}
              pe={dados.kpis.regimes.r2.rotulo}
            />
            <Kpi
              rotulo="Média diária — depois"
              valor={n1(dados.kpis.regimes.r3.media_diaria)}
              pe={dados.kpis.regimes.r3.rotulo}
              destaque
            />
            <Kpi rotulo="Maior volume em um dia" valor={n0(k.pico.total)} pe={dataBR(k.pico.data)} />
            <Kpi
              rotulo="Fecharam sozinhos (monitoramento)"
              valor={n0(k.semIntervencao)}
              pe={`${Math.round((k.semIntervencao / k.total) * 100)}% do total · não consomem analista`}
            />
            <Kpi
              rotulo="Exigiram trabalho humano"
              valor={n0(k.comIntervencao)}
              pe="fatia que sustenta dimensionamento"
            />
          </LinhaKpis>

          <div className="grade" style={{ marginTop: 14 }}>
            <Painel
              className="col-8"
              titulo="Evolução diária de incidentes abertos"
              sub={
                <span className="toggle">
                  {Object.entries(VISOES).map(([kk, v]) => (
                    <button key={kk} className={visao === kk ? 'on' : ''} onClick={() => setVisao(kk)}>
                      {v.rot}
                    </button>
                  ))}
                </span>
              }
              nota="A quebra de 2025-09-03 (linha tracejada) é a entrada do monitoramento automático — toda ela cai na fatia 'sem intervenção'. Antes disso essa série praticamente não existia; por isso a média anual sozinha engana. O período selecionado acima vale pra página inteira: KPIs e 'volume por classe' abaixo também mudam."
            >
              <SerieTemporal
                dados={serie}
                series={VISOES[visao].series}
                fmtX={diaMes}
                referencias={serie.some((d) => d.data === '2025-09-03') ? [{ x: '2025-09-03', rotulo: 'automação' }] : []}
                altura={320}
              />
            </Painel>

            <Painel className="col-4" titulo="Distribuição por prioridade" sub={`Incidentes ${rotuloPeriodo}`}>
              {[2, 3, 4].map((p) => (
                <div key={p} style={{ margin: '10px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <b>P{p}</b>
                    <span style={{ color: 'var(--tinta-3)' }}>{Math.round((k.porPrioridade[p] / k.total) * 100)}%</span>
                  </div>
                  <BarraShare valor={k.porPrioridade[p]} total={k.total} cor={PRIORIDADE[p]} />
                </div>
              ))}
              <p className="nota">
                P4 é o maior volume ({Math.round((k.porPrioridade[4] / k.total) * 100)}%) e tem modelo
                próprio para D+1 e D+7 — só não tem meta de OLA definida no projeto.
              </p>
            </Painel>

            <Painel
              className="col-12"
              titulo="Volume por classe de alerta"
              sub={`Classe de negócio atribuída por LLM sobre os templates que cobrem 95% do volume · ${rotuloPeriodo}`}
              nota={dados.por_classe.nota}
            >
              <BarrasHorizontais
                dados={classes.itens.map((i) => ({ nome: rotulo(i.nome), valor: i.abertos }))}
              />
            </Painel>
          </div>

          <Aviso nivel="info" titulo="Leitura">
            {dados.kpis.nota_regime}
          </Aviso>
        </>
      )}
    </Estado>
  )
}

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

export default function VisaoExecutiva() {
  const { dados, erro, carregando } = useDados('kpis', 'serie_diaria', 'por_classe')
  const [visao, setVisao] = useState('prioridade')
  const [janela, setJanela] = useState('2025')

  const serie = useMemo(() => {
    if (!dados) return []
    const s = dados.serie_diaria
    return janela === '2025' ? s.filter((d) => d.data >= '2025-01-01') : s
  }, [dados, janela])

  return (
    <Estado carregando={carregando} erro={erro}>
      {dados && (
        <>
          <div className="pg-cabecalho">
            <h1>Visão executiva</h1>
            <p>
              O problema operacional da Locaweb em números: quanto volume, onde ele se
              concentra e o que mudou ao longo de {dados.kpis.ano_foco}.
            </p>
          </div>

          <LinhaKpis>
            <Kpi
              rotulo={`Incidentes em ${dados.kpis.ano_foco}`}
              valor={n0(dados.kpis.total_incidentes_ano)}
              pe={`${dados.kpis.dias_no_ano} dias · P2/P3/P4`}
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
            <Kpi
              rotulo="Maior volume em um dia"
              valor={n0(dados.kpis.dia_pico.total)}
              pe={dataBR(dados.kpis.dia_pico.data)}
            />
            <Kpi
              rotulo="Fecharam sozinhos (monitoramento)"
              valor={n0(dados.kpis.sem_intervencao_ano)}
              pe={`${Math.round(
                (dados.kpis.sem_intervencao_ano / dados.kpis.total_incidentes_ano) * 100,
              )}% do total · não consomem analista`}
            />
            <Kpi
              rotulo="Exigiram trabalho humano"
              valor={n0(dados.kpis.com_intervencao_ano)}
              pe="fatia que sustenta dimensionamento"
            />
          </LinhaKpis>

          <div className="grade" style={{ marginTop: 14 }}>
            <Painel
              className="col-8"
              titulo="Evolução diária de incidentes abertos"
              sub={
                <>
                  <span className="toggle" style={{ marginRight: 8 }}>
                    {Object.entries(VISOES).map(([k, v]) => (
                      <button key={k} className={visao === k ? 'on' : ''} onClick={() => setVisao(k)}>
                        {v.rot}
                      </button>
                    ))}
                  </span>
                  <span className="toggle">
                    {['2025', 'tudo'].map((k) => (
                      <button key={k} className={janela === k ? 'on' : ''} onClick={() => setJanela(k)}>
                        {k === '2025' ? '2025' : 'Histórico completo'}
                      </button>
                    ))}
                  </span>
                </>
              }
              nota="A quebra de 2025-09-03 (linha tracejada) é a entrada do monitoramento automático — toda ela cai na fatia 'sem intervenção'. Antes disso essa série praticamente não existia; por isso a média anual sozinha engana."
            >
              <SerieTemporal
                dados={serie}
                series={VISOES[visao].series}
                fmtX={diaMes}
                referencias={
                  janela === 'tudo' || serie.some((d) => d.data === '2025-09-03')
                    ? [{ x: '2025-09-03', rotulo: 'automação' }]
                    : []
                }
                altura={320}
              />
            </Painel>

            <Painel className="col-4" titulo="Distribuição por prioridade" sub={`Incidentes em ${dados.kpis.ano_foco}`}>
              {[2, 3, 4].map((p) => (
                <div key={p} style={{ margin: '10px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <b>P{p}</b>
                    <span style={{ color: 'var(--tinta-3)' }}>
                      {Math.round((dados.kpis.por_prioridade_ano[p] / dados.kpis.total_incidentes_ano) * 100)}%
                    </span>
                  </div>
                  <BarraShare
                    valor={dados.kpis.por_prioridade_ano[p]}
                    total={dados.kpis.total_incidentes_ano}
                    cor={PRIORIDADE[p]}
                  />
                </div>
              ))}
              <p className="nota">
                P4 é o maior volume (
                {Math.round((dados.kpis.por_prioridade_ano[4] / dados.kpis.total_incidentes_ano) * 100)}%) e
                tem modelo próprio para D+1 e D+7 — só não tem meta de OLA definida no projeto.
              </p>
            </Painel>

            <Painel
              className="col-12"
              titulo="Volume por classe de alerta"
              sub="Classe de negócio atribuída por LLM sobre os templates que cobrem 95% do volume"
              nota={dados.por_classe.nota}
            >
              <BarrasHorizontais
                dados={dados.por_classe.itens.map((i) => ({
                  nome: rotulo(i.nome),
                  valor: i.abertos,
                }))}
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

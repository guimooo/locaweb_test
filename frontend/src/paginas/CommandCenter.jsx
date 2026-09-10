import { useEffect, useMemo, useState } from 'react'
import { useDados } from '../comum/dados.js'
import { Estado, Painel, Kpi, LinhaKpis, Aviso, Selo } from '../componentes/Base.jsx'
import { n0, n1, sinalPct, dataBR, rotulo } from '../comum/formato.js'
import { PRIORIDADE } from '../comum/paleta.js'

function usePrevisao() {
  const [e, setE] = useState({ dados: null, pronto: false })
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}dados/previsao.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setE({ dados: d, pronto: true }))
      .catch(() => setE({ dados: null, pronto: true }))
  }, [])
  return e
}

const somaGrupo = (h) => [2, 3, 4].reduce((a, p) => a + (h?.[p]?.previsao ?? 0), 0)
const somaMedia = (h) => [2, 3, 4].reduce((a, p) => a + (h?.[p]?.media_recente ?? 0), 0)
const todosSuperam = (h) => [2, 3, 4].every((p) => h?.[p]?.supera_ingenuo)

export default function CommandCenter() {
  const base = useDados('serie_diaria', 'ola', 'por_time')
  const prev = usePrevisao()
  const p = prev.dados

  const status = useMemo(() => {
    if (!base.dados) return null
    const p3ola = base.dados.ola.atual.p3_duracao
    const tendenciaAlta = p
      ? somaGrupo(p['D+7'].total) > somaMedia(p['D+7'].total) * 1.1
      : false
    if (p3ola != null && p3ola <= 100) return { nivel: 'critico', txt: 'Risco elevado' }
    if ((p3ola != null && p3ola < 150) || tendenciaAlta) return { nivel: 'atencao', txt: 'Atenção' }
    return { nivel: 'ok', txt: 'Operação estável' }
  }, [base.dados, p])

  return (
    <Estado carregando={base.carregando} erro={base.erro}>
      {base.dados && (
        <>
          <div className="pg-cabecalho">
            <h1>Command Center</h1>
            <p>
              Antecipação de incidentes operacionais. Origem da projeção:{' '}
              <b>{p ? dataBR(p.origem) : dataBR(base.dados.ola.atual.data)}</b> — o fim do
              histórico. "Amanhã" e "próxima semana" são projetados a partir daí pelos 18
              modelos ARIMA/SARIMA.
            </p>
          </div>

          {!prev.pronto ? (
            <div className="carregando">Carregando previsão…</div>
          ) : !p ? (
            <Aviso nivel="atencao" titulo="Previsão de produção indisponível">
              O arquivo <code>previsao.json</code> ainda não foi gerado. Rode{' '}
              <code>.venv/Scripts/python scripts/gerar_dados_previsao.py</code>. As demais
              páginas funcionam sem ele.
            </Aviso>
          ) : (
            <>
              <div className="grade">
                <Painel className="col-4" titulo="Status atual">
                  <div style={{ textAlign: 'center', padding: '8px 0' }}>
                    <div
                      style={{
                        fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em',
                        color:
                          status.nivel === 'ok'
                            ? 'var(--ok)'
                            : status.nivel === 'atencao'
                              ? 'var(--atencao)'
                              : 'var(--critico)',
                      }}
                    >
                      {status.txt}
                    </div>
                  </div>
                  <p className="nota" style={{ borderTop: 'none', marginTop: 0 }}>
                    OLA de duração da P3 em {n0(base.dados.ola.atual.p3_duracao)}% (caiu de
                    faixa em 26/12) e a tendência da projeção D+7.
                  </p>
                </Painel>

                <MancheteHorizonte
                  className="col-4"
                  titulo="Amanhã — D+1"
                  sub={`alvo ${dataBR(p['D+1'].total[2].data_alvo)}`}
                  previsto={somaGrupo(p['D+1'].total)}
                  media={somaMedia(p['D+1'].total)}
                  confiavel={todosSuperam(p['D+1'].com_intervencao)}
                />
                <MancheteHorizonte
                  className="col-4"
                  titulo="Próximos 7 dias — D+7"
                  sub={`semana ${dataBR(p['D+7'].total[2].data_alvo)}`}
                  previsto={somaGrupo(p['D+7'].total)}
                  media={somaMedia(p['D+7'].total)}
                  confiavel={todosSuperam(p['D+7'].com_intervencao)}
                  semana
                />
              </div>

              <Painel
                className="col-12"
                titulo="Previsão por prioridade e tipo"
                sub="Previsão [banda 80%] · comparação com a média recente · confiança = o modelo supera a régua ingênua no teste?"
                nota={p.aviso}
              >
                {['D+1', 'D+7'].map((h) => (
                  <div key={h} style={{ marginTop: h === 'D+7' ? 18 : 6 }}>
                    <h3 style={{ fontSize: 13, margin: '0 0 6px', color: 'var(--tinta-2)' }}>
                      {h === 'D+1' ? 'D+1 — incidentes no dia seguinte' : 'D+7 — acumulado da semana'}
                    </h3>
                    <div className="tabela-rol">
                      <table className="dados">
                        <thead>
                          <tr>
                            <th>Grupo</th>
                            {[2, 3, 4].map((pr) => (
                              <th key={pr} className="num">P{pr}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {['com_intervencao', 'sem_intervencao', 'total'].map((g) => (
                            <tr key={g}>
                              <td>{rotulo(g)}</td>
                              {[2, 3, 4].map((pr) => {
                                const c = p[h][g][pr]
                                return (
                                  <td key={pr} className="num">
                                    <b>{n0(c.previsao)}</b>{' '}
                                    <span style={{ color: 'var(--tinta-3)', fontSize: 11 }}>
                                      {sinalPct(c.variacao_vs_media_pct)}
                                    </span>
                                    <div style={{ fontSize: 10, marginTop: 2 }}>
                                      {c.supera_ingenuo ? (
                                        <span className="pos">✓ modelo</span>
                                      ) : (
                                        <span className="neg">✗ use a régua ({n0(c.ingenuo)})</span>
                                      )}
                                    </div>
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </Painel>

              <div className="grade">
                <Painel
                  className="col-7"
                  titulo="Central de alertas preditivos"
                  sub="Dias do período de teste em que o real saiu da banda de 95% do modelo (com intervenção)"
                  nota="A banda vem do modelo mesmo onde a previsão pontual perde para o ingênuo — aqui o que importa é a dispersão, não o ponto. 'Sistêmico' = poucos ICs concentrando o volume."
                >
                  <div className="tabela-rol">
                    <table className="dados">
                      <thead>
                        <tr>
                          <th>Prioridade</th>
                          <th className="num">Dias fora da banda</th>
                          <th className="num">Esperado por acaso</th>
                          <th className="num">Com marca sistêmica</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[2, 3, 4].map((pr) => {
                          const r = p.atipicos_teste[pr].resumo
                          return (
                            <tr key={pr}>
                              <td>
                                <span style={{ color: PRIORIDADE[pr], fontWeight: 700 }}>P{pr}</span>
                              </td>
                              <td className="num"><b>{r.atipicos}</b></td>
                              <td className="num">{n1(r.esperados_por_acaso)}</td>
                              <td className="num">{r.com_marca_de_sistemico}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <UltimosAtipicos dados={p.atipicos_teste} />
                </Painel>

                <Painel
                  className="col-5"
                  titulo="Capacidade — D+7, com intervenção"
                  sub="Analistas/dia para dar conta do volume previsto da semana"
                  nota={p.capacidade[3]?.aviso}
                >
                  <div className="tabela-rol">
                    <table className="dados">
                      <thead>
                        <tr>
                          <th>Prioridade</th>
                          <th className="num">Incid. previstos</th>
                          <th className="num">Analistas/dia</th>
                          <th className="num">Pior caso</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[2, 3, 4].map((pr) => {
                          const c = p.capacidade[pr]
                          if (!c?.disponivel)
                            return (
                              <tr key={pr}>
                                <td>P{pr}</td>
                                <td className="num" colSpan={3} style={{ color: 'var(--tinta-3)' }}>
                                  sem dado utilizável
                                </td>
                              </tr>
                            )
                          return (
                            <tr key={pr}>
                              <td>P{pr}</td>
                              <td className="num">{n0(c.incidentes_previstos)}</td>
                              <td className="num"><b>{n1(c.analistas_por_dia)}</b></td>
                              <td className="num">{n1(c.analistas_pior_caso)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </Painel>
              </div>

              <Painel className="col-12" titulo="Onde agir primeiro">
                <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 2 }}>
                  <li>
                    <b>Semana (D+7), incidentes com intervenção</b> — {n0(somaGrupo(p['D+7'].com_intervencao))}{' '}
                    previstos ({sinalPct(
                      ((somaGrupo(p['D+7'].com_intervencao) - somaMedia(p['D+7'].com_intervencao)) /
                        somaMedia(p['D+7'].com_intervencao)) *
                        100,
                    )}{' '}
                    vs. média). É o corte onde a previsão é confiável — use-o para dimensionar a escala.
                  </li>
                  <li>
                    <b>OLA de duração da P3</b> — já cruzou o corte 201, sem folga até a virada do ano.
                  </li>
                  <li>
                    <b>{base.dados.por_time.itens[0].nome}</b> — concentra{' '}
                    {Math.round(base.dados.por_time.itens[0].share)}% do volume; qualquer pico recai sobre ele.
                  </li>
                </ol>
              </Painel>
            </>
          )}
        </>
      )}
    </Estado>
  )
}

function MancheteHorizonte({ className, titulo, sub, previsto, media, confiavel, semana }) {
  const varPct = media ? ((previsto - media) / media) * 100 : null
  return (
    <Painel className={className} titulo={titulo} sub={sub}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
        <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em' }} className="tabular">
          {n0(previsto)}
        </span>
        <span style={{ color: 'var(--tinta-2)' }}>
          incidentes {semana ? 'na semana' : 'previstos'}
        </span>
      </div>
      <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--tinta-2)' }}>
        média recente <b className="tabular">{n0(media)}</b> ·{' '}
        <span className={varPct > 0 ? 'neg' : 'pos'}>{sinalPct(varPct)}</span>
      </div>
      <div style={{ marginTop: 10 }}>
        {confiavel ? (
          <Selo nivel="ok">previsão confiável neste corte</Selo>
        ) : (
          <Selo nivel="atencao">baixa confiança — a régua simples tende a errar menos</Selo>
        )}
      </div>
    </Painel>
  )
}

function UltimosAtipicos({ dados }) {
  const todos = [2, 3, 4]
    .flatMap((pr) => dados[pr].dias.map((d) => ({ ...d, prioridade: pr })))
    .sort((a, b) => (a.data < b.data ? 1 : -1))
    .slice(0, 6)
  if (!todos.length) return null
  return (
    <div className="tabela-rol" style={{ marginTop: 10 }}>
      <table className="dados">
        <thead>
          <tr>
            <th>Data</th>
            <th>Prio.</th>
            <th className="num">Previsto</th>
            <th className="num">Real</th>
            <th className="num">Fora por</th>
            <th>Leitura</th>
          </tr>
        </thead>
        <tbody>
          {todos.map((d, i) => (
            <tr key={i}>
              <td>{dataBR(d.data)}</td>
              <td style={{ color: PRIORIDADE[d.prioridade], fontWeight: 700 }}>P{d.prioridade}</td>
              <td className="num">{n0(d.previsto)}</td>
              <td className="num"><b>{n0(d.real)}</b></td>
              <td className="num">{sinalPct(d.desvio_pct)}</td>
              <td style={{ fontSize: 11.5 }}>{d.leitura || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

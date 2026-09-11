import { useEffect, useMemo, useState } from 'react'
import { Estado, Painel, Kpi, LinhaKpis, Aviso, Selo, SeletorData } from '../componentes/Base.jsx'
import { n0, sinalPct, dataBR, rotulo } from '../comum/formato.js'

const GRUPOS = ['com_intervencao', 'sem_intervencao', 'total']
const PRIOS = [2, 3, 4]
const PESO_PRIO = { 2: 3, 3: 2, 4: 1 }
const PADRAO = '2025-12-15' // data de demonstração: tem real pra tudo

function useComando() {
  const [e, setE] = useState({ dados: null, erro: null, carregando: true })
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}dados/comando_por_dia.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`comando_por_dia.json (${r.status})`)
        return r.json()
      })
      .then((d) => setE({ dados: d, erro: null, carregando: false }))
      .catch((err) => setE({ dados: null, erro: err.message, carregando: false }))
  }, [])
  return e
}

const soma = (obj) => PRIOS.reduce((a, p) => a + (obj?.[p] ?? 0), 0)
const somaPrev = (obj) => PRIOS.reduce((a, p) => a + (obj?.[p]?.previsto ?? 0), 0)
const somaReal = (obj) => PRIOS.reduce((a, p) => a + (obj?.[p]?.real ?? 0), 0)
const todosSuperam = (obj) => PRIOS.every((p) => obj?.[p]?.supera_ingenuo)

export default function CommandCenter() {
  const { dados, erro, carregando } = useComando()
  const [data, setData] = useState(PADRAO)

  const dia = dados?.por_dia[data]

  const media7 = (g) => PRIOS.reduce((a, p) => a + (dia.media_28d[g]?.[p] ?? 0) * 7, 0)
  const media1 = (g) => PRIOS.reduce((a, p) => a + (dia.media_28d[g]?.[p] ?? 0), 0)

  const status = useMemo(() => {
    if (!dia) return null
    const p3 = dia.ola.p3_duracao
    const t = media7('total')
    const alta = t > 0 && somaPrev(dia.d7.total) > t * 1.15
    if (p3 != null && p3 <= 100) return { nivel: 'critico', txt: 'Risco elevado' }
    if ((p3 != null && p3 < 150) || alta) return { nivel: 'atencao', txt: 'Atenção' }
    return { nivel: 'ok', txt: 'Operação estável' }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dia])

  const ondeAgir = useMemo(() => {
    if (!dia) return []
    const itens = []
    // 1. cortes com alta relevante prevista para a semana (grupo total, por prioridade)
    for (const p of PRIOS) {
      const c = dia.d7.total[p]
      const base = (dia.media_28d.total?.[p] ?? 0) * 7
      if (!c || c.previsto == null || base <= 0) continue
      const pct = ((c.previsto - base) / base) * 100
      if (pct <= 8) continue
      const conf = dia.d7.com_intervencao[p]?.supera_ingenuo
      itens.push({
        tipo: 'volume',
        score: pct * PESO_PRIO[p] * (conf ? 1 : 0.4),
        texto: (
          <>
            <b>P{p}</b> — a semana projeta <b>{n0(c.previsto)}</b> incidentes,{' '}
            <span className="neg">{sinalPct(pct)}</span> vs. a média recente
            {conf ? '' : ' (corte de baixa confiança — confirme com a régua simples)'}.
          </>
        ),
      })
    }
    // 2. OLA de duração da P3
    const p3 = dia.ola.p3_duracao
    if (p3 != null && p3 < 150) {
      itens.push({
        tipo: 'ola',
        score: p3 <= 100 ? 999 : 500,
        texto: (
          <>
            <b>OLA de duração da P3</b> em <b>{n0(p3)}%</b> ({n0(dia.ola.p3_kpi_ac)} violações
            no ano) — {p3 <= 100 ? 'abaixo da meta' : 'sem folga até a virada do ano'}.
          </>
        ),
      })
    }
    // 3. dia atípico: algum real de D+1 caiu fora da banda?
    for (const g of ['com_intervencao']) {
      for (const p of PRIOS) {
        const c = dia.d1[g][p]
        if (!c || c.real == null || !c.banda) continue
        if (c.real >= c.banda[0] && c.real <= c.banda[1]) continue
        itens.push({
          tipo: 'atipico',
          score: 300,
          texto: (
            <>
              <b>Dia atípico ({rotulo(g)}, P{p})</b> — o real de {dataBR(c.data_alvo)} foi{' '}
              <b>{n0(c.real)}</b>, fora da banda prevista [{n0(c.banda[0])}–{n0(c.banda[1])}].
            </>
          ),
        })
      }
    }
    return itens.sort((a, b) => b.score - a.score).slice(0, 4)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dia])

  return (
    <Estado carregando={carregando} erro={erro}>
      {dados && (
        <>
          <div className="pg-cabecalho">
            <h1>Command Center</h1>
            <p>
              Escolha a data de origem. Tudo abaixo recalcula: os incidentes do dia, a
              previsão para o dia seguinte (D+1) e para a semana seguinte (D+7), o
              cumprimento de OLA e as prioridades de ação.
            </p>
          </div>

          <Painel className="col-12">
            <SeletorData
              datas={dados.datas}
              valor={data}
              onChange={setData}
              producao={dados.producao}
            />
            <p className="nota" style={{ borderTop: 'none', marginTop: 8 }}>
              {dados.aviso}
            </p>
          </Painel>

          {!dia ? (
            <Aviso nivel="atencao">Sem dados para {dataBR(data)}.</Aviso>
          ) : (
            <>
              <div className="grade">
                <Painel className="col-4" titulo="Status na data">
                  <div style={{ textAlign: 'center', padding: '10px 0 2px' }}>
                    <div
                      style={{
                        fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em',
                        color:
                          status.nivel === 'ok' ? 'var(--ok)'
                            : status.nivel === 'atencao' ? 'var(--atencao)' : 'var(--critico)',
                      }}
                    >
                      {status.txt}
                    </div>
                  </div>
                  <p className="nota" style={{ borderTop: 'none', marginTop: 0 }}>
                    OLA de duração da P3 em {dia.ola.p3_duracao == null ? '—' : `${n0(dia.ola.p3_duracao)}%`}{' '}
                    e a tendência da projeção D+7.
                  </p>
                </Painel>

                <Manchete
                  className="col-4"
                  titulo="Dia seguinte — D+1"
                  sub={`alvo ${dataBR(dia.d1.total[2].data_alvo)}`}
                  previsto={somaPrev(dia.d1.total)}
                  real={temReal(dia.d1.total) ? somaReal(dia.d1.total) : null}
                  media={media1('total')}
                  confiavel={todosSuperam(dia.d1.com_intervencao)}
                />
                <Manchete
                  className="col-4"
                  titulo="Semana seguinte — D+7"
                  sub={`até ${dataBR(dia.d7.total[2].data_alvo)}`}
                  previsto={somaPrev(dia.d7.total)}
                  real={temReal(dia.d7.total) ? somaReal(dia.d7.total) : null}
                  media={media7('total')}
                  confiavel={todosSuperam(dia.d7.com_intervencao)}
                  semana
                />
              </div>

              <Painel
                className="col-12"
                titulo={`Incidentes em ${dataBR(data)}`}
                sub="volume real registrado no dia — a base de comparação da previsão"
              >
                <LinhaKpis>
                  {GRUPOS.map((g) => (
                    <Kpi
                      key={g}
                      rotulo={rotulo(g)}
                      valor={n0(soma(dia.d0[g]))}
                      pe={PRIOS.map((p) => `P${p} ${n0(dia.d0[g]?.[p])}`).join(' · ')}
                      destaque={g === 'total'}
                    />
                  ))}
                </LinhaKpis>
              </Painel>

              <Painel
                className="col-12"
                titulo="Previsão por prioridade e tipo"
                sub="previsto [banda 80%] · variação vs. média de 28 dias · real quando existe · o modelo supera a régua ingênua?"
              >
                {['d1', 'd7'].map((h) => (
                  <div key={h} style={{ marginTop: h === 'd7' ? 18 : 4 }}>
                    <h3 style={{ fontSize: 13, margin: '0 0 6px', color: 'var(--tinta-2)' }}>
                      {h === 'd1' ? 'D+1 — dia seguinte' : 'D+7 — acumulado da semana'}
                    </h3>
                    <div className="tabela-rol">
                      <table className="dados">
                        <thead>
                          <tr>
                            <th>Grupo</th>
                            {PRIOS.map((p) => <th key={p} className="num">P{p}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {GRUPOS.map((g) => (
                            <tr key={g}>
                              <td>{rotulo(g)}</td>
                              {PRIOS.map((p) => <Celula key={p} c={dia[h][g][p]} escala={h} />)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
                <p className="nota">
                  Selo da origem: {dia.d1.com_intervencao[2].selo}
                  {dia.regime === 3 ? ' · regime pós-automação' : ''}.
                  {dias_em_treino(dia) &&
                    ' Antes de 04/12 as séries "sem intervenção" e "total" ainda estavam em treino — a acurácia ali é otimista por construção.'}
                </p>
              </Painel>

              <div className="grade">
                <Painel className="col-5" titulo={`OLA em ${dataBR(data)}`} sub="regra de duração · escala 150 / 125 / 100 / 75 / 50 / 0">
                  <div className="kpis">
                    {PRIOS.map((p) => {
                      const v = dia.ola[`p${p}_duracao`]
                      return (
                        <div className="kpi" key={p}>
                          <div className="rot">P{p}</div>
                          <div
                            className="val tabular"
                            style={{
                              color: v == null ? 'var(--tinta-3)'
                                : v >= 125 ? 'var(--ok)' : v >= 100 ? 'var(--atencao)' : 'var(--critico)',
                            }}
                          >
                            {v == null ? 'sem meta' : `${n0(v)}%`}
                          </div>
                          <div className="pe">
                            {v == null ? 'P4 sem faixa no projeto' : `${n0(dia.ola[`p${p}_kpi_ac`])} violações no ano`}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <p className="nota">
                    A regra de OLA por volume está estourada o ano inteiro (faixas calibradas para
                    outra escala) — só a de duração está viva.
                  </p>
                </Painel>

                <Painel className="col-7" titulo="Onde agir primeiro" sub={`recalculado para ${dataBR(data)}`}>
                  {ondeAgir.length ? (
                    <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
                      {ondeAgir.map((it, i) => (
                        <li key={i}>{it.texto}</li>
                      ))}
                    </ol>
                  ) : (
                    <p className="vazio">
                      Projeção dentro do padrão — nenhum corte com alta relevante previsto para a
                      semana, e a OLA de duração da P3 na meta.
                    </p>
                  )}
                  <p className="nota">
                    Ranqueado por variação prevista vs. média recente, ponderada pela severidade da
                    prioridade e pela confiança do modelo naquele corte. Não é saída de um modelo de
                    priorização — é uma regra explícita sobre os números da previsão.
                  </p>
                </Painel>
              </div>
            </>
          )}
        </>
      )}
    </Estado>
  )
}

const temReal = (obj) => PRIOS.every((p) => obj?.[p]?.real != null)
const dias_em_treino = (dia) =>
  GRUPOS.some((g) => PRIOS.some((p) => dia.d1[g][p]?.selo === 'TREINO'))

function Celula({ c, escala }) {
  if (!c || c.previsto == null) {
    return <td className="num" style={{ color: 'var(--tinta-3)' }}>{c?.selo === 'SEM FEATURES' ? '—' : (c?.selo || '—')}</td>
  }
  const varPct = c.real != null && c.real > 0 ? ((c.previsto - c.real) / c.real) * 100 : null
  return (
    <td className="num">
      <b>{n0(c.previsto)}</b>{' '}
      <span style={{ color: 'var(--tinta-3)', fontSize: 10 }}>[{n0(c.banda[0])}–{n0(c.banda[1])}]</span>
      <div style={{ fontSize: 10.5, marginTop: 2, color: 'var(--tinta-2)' }}>
        {c.real != null ? (
          <>real {n0(c.real)} {varPct != null && <span className={Math.abs(varPct) > 25 ? 'neg' : ''}>({sinalPct(varPct)})</span>}</>
        ) : (
          <span style={{ color: 'var(--tinta-3)' }}>sem real</span>
        )}
      </div>
      <div style={{ fontSize: 10 }}>
        {c.supera_ingenuo
          ? <span className="pos">✓ modelo</span>
          : <span className="neg">✗ régua ({n0(c.ingenuo)})</span>}
      </div>
    </td>
  )
}

function Manchete({ className, titulo, sub, previsto, real, media, confiavel, semana }) {
  const varPct = media ? ((previsto - media) / media) * 100 : null
  return (
    <Painel className={className} titulo={titulo} sub={sub}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
        <span className="tabular" style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em' }}>
          {n0(previsto)}
        </span>
        <span style={{ color: 'var(--tinta-2)', fontSize: 12.5 }}>
          previstos{semana ? ' na semana' : ''}
        </span>
      </div>
      <div style={{ marginTop: 5, fontSize: 12, color: 'var(--tinta-2)' }}>
        média recente <b className="tabular">{n0(media)}</b>{' '}
        <span className={varPct > 0 ? 'neg' : 'pos'}>{sinalPct(varPct)}</span>
        {real != null && (
          <> · real <b className="tabular">{n0(real)}</b></>
        )}
      </div>
      <div style={{ marginTop: 9 }}>
        {confiavel
          ? <Selo nivel="ok">previsão confiável</Selo>
          : <Selo nivel="atencao">baixa confiança — cheque a régua simples</Selo>}
      </div>
    </Painel>
  )
}

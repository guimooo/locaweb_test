import { useMemo } from 'react'
import { useDados } from '../comum/dados.js'
import { Estado, Painel, Aviso, Selo } from '../componentes/Base.jsx'
import { SerieTemporal } from '../componentes/Grafico.jsx'
import { n0, n1, dataBR, diaMes, rotulo } from '../comum/formato.js'
import { PRIORIDADE } from '../comum/paleta.js'

export default function RiscoAlertas() {
  const { dados, erro, carregando } = useDados('ola', 'sinais', 'por_classe', 'por_time', 'kpis')

  const anomalias = useMemo(
    () => (dados ? [...dados.sinais.anomalias].reverse() : []),
    [dados],
  )

  const topClasseP2 = useMemo(
    () => dados?.por_classe.itens.slice().sort((a, b) => b.p2 - a.p2)[0],
    [dados],
  )

  return (
    <Estado carregando={carregando} erro={erro}>
      {dados && (
        <>
          <div className="pg-cabecalho">
            <h1>Risco &amp; alertas</h1>
            <p>Onde a operação deveria prestar atenção — cumprimento de OLA, dias fora do padrão e prioridades de ação.</p>
          </div>

          <div className="grade">
            <Painel
              className="col-12"
              titulo="Cumprimento de OLA — regra de duração"
              sub={`Situação em ${dataBR(dados.ola.atual.data)} · escala 150 / 125 / 100 / 75 / 50 / 0`}
            >
              <div className="kpis" style={{ marginBottom: 12 }}>
                {[2, 3, 4].map((p) => {
                  const v = dados.ola.atual[`p${p}_duracao`]
                  const nivel = v == null ? 'neutro' : v >= 125 ? 'ok' : v >= 100 ? 'atencao' : 'critico'
                  return (
                    <div className="kpi" key={p}>
                      <div className="rot">P{p} — atingimento</div>
                      <div className="val tabular" style={{ color: `var(--${nivel === 'neutro' ? 'tinta-3' : nivel === 'ok' ? 'ok' : nivel === 'atencao' ? 'atencao' : 'critico'})` }}>
                        {v == null ? 'sem meta' : `${n0(v)}%`}
                      </div>
                      <div className="pe">
                        {v == null
                          ? 'P4 não tem faixa de OLA no projeto'
                          : `${n0(dados.ola.atual[`p${p}_kpi_ac`])} violações no ano`}
                      </div>
                    </div>
                  )
                })}
              </div>

              <SerieTemporal
                dados={dados.ola.historico.filter((d) => d.data >= '2025-06-01')}
                series={[
                  { chave: 'p2_duracao', nome: 'P2', cor: PRIORIDADE[2], tipo: 'linha' },
                  { chave: 'p3_duracao', nome: 'P3', cor: PRIORIDADE[3], tipo: 'linha' },
                ]}
                fmtX={diaMes}
                fmtValor={(v) => `${n0(v)}%`}
                altura={240}
              />

              {dados.ola.ressalvas.map((r, i) => (
                <Aviso key={i} nivel={i === 0 ? 'critico' : 'atencao'} titulo={i === 0 ? 'Ressalva' : ''}>
                  {r}
                </Aviso>
              ))}
            </Painel>

            <Painel
              className="col-7"
              titulo="Central de alertas preditivos — dias fora do padrão"
              sub="Volume total do dia a ±2,5 desvios da média móvel de 30 dias (detecção estatística, dentro do mesmo regime)"
              nota="Detecção estatística simples, não é o modelo de série temporal. Um dia fora do padrão é um candidato a investigar, não um diagnóstico."
            >
              <div className="tabela-rol">
                <table className="dados">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th className="num">Total</th>
                      <th className="num">Média 30d</th>
                      <th className="num">Desvios</th>
                      <th>Direção</th>
                    </tr>
                  </thead>
                  <tbody>
                    {anomalias.map((a) => (
                      <tr key={a.data}>
                        <td>{dataBR(a.data)}</td>
                        <td className="num"><b>{n0(a.total)}</b></td>
                        <td className="num">{n1(a.media_movel_30d)}</td>
                        <td className="num">{n1(a.z)}σ</td>
                        <td>
                          {a.direcao === 'acima' ? (
                            <Selo nivel="critico">pico</Selo>
                          ) : (
                            <Selo nivel="atencao">queda</Selo>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Painel>

            <Painel className="col-5" titulo="Onde agir primeiro" sub="Derivado do histórico de 2025 — sem previsão de modelo">
              <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
                <li>
                  <b>Classe {rotulo(topClasseP2.nome)}</b> — é a que mais gera P2 ({n0(topClasseP2.p2)}{' '}
                  incidentes de alta prioridade no ano).
                </li>
                <li>
                  <b>{dados.por_time.itens[0].nome}</b> — concentra{' '}
                  {Math.round(dados.por_time.itens[0].share)}% de todo o volume. Qualquer
                  escalada passa por ele.
                </li>
                <li>
                  <b>Regra de OLA por volume</b> — está estourada o ano inteiro (0%). Precisa de
                  recalibração com a área antes de virar indicador.
                </li>
              </ol>
              <p className="nota">
                Esta lista é agregação do histórico real, não saída de modelo. A versão preditiva
                (a partir da previsão D+1/D+7) está no Command Center.
              </p>
            </Painel>
          </div>
        </>
      )}
    </Estado>
  )
}

import { useDados } from '../comum/dados.js'
import { Estado, Painel, Aviso, Selo } from '../componentes/Base.jsx'
import { SerieTemporal } from '../componentes/Grafico.jsx'
import { n0, n1, sinalPct, diaMes, dataBR, rotulo } from '../comum/formato.js'
import { GRUPO } from '../comum/paleta.js'

const SERIES_PREV = [
  { chave: 'real', nome: 'Real', cor: '#14140f', tipo: 'linha' },
  { chave: 'previsto', nome: 'Modelo', cor: GRUPO.com_intervencao, tipo: 'linha' },
  { chave: 'ingenuo', nome: 'Regra ingênua', cor: '#eb6834', tipo: 'linha', tracejado: true },
]

export default function TendenciaPrevisao() {
  const { dados, erro, carregando } = useDados('modelos')

  return (
    <Estado carregando={carregando} erro={erro}>
      {dados && (
        <>
          <div className="pg-cabecalho">
            <h1>Tendência &amp; previsão</h1>
            <p>
              O que os modelos entregam, medido contra o real do período de teste e contra a
              régua mais simples possível (a "regra ingênua"). Sem maquiagem.
            </p>
          </div>

          <Aviso nivel="critico" titulo="O resultado, sem maquiagem">
            {dados.modelos.leitura}
          </Aviso>

          <Painel
            className="col-12"
            titulo="Placar — modelo escolhido × baseline ingênuo"
            sub="Leitura geral (3 prioridades juntas), no período de teste. MAE = erro absoluto médio; menor é melhor."
            style={{ marginTop: 14 }}
          >
            <div className="tabela-rol">
              <table className="dados">
                <thead>
                  <tr>
                    <th>Grupo</th>
                    <th>Horizonte</th>
                    <th>Modelo</th>
                    <th className="num">MAE modelo</th>
                    <th className="num">MAE ingênuo</th>
                    <th>Regra ingênua</th>
                    <th className="num">Ganho</th>
                    <th>Veredito</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.modelos.placar.map((r) => (
                    <tr key={`${r.grupo}-${r.horizonte}`}>
                      <td>{rotulo(r.grupo)}</td>
                      <td>{r.horizonte}</td>
                      <td>{r.modelo}</td>
                      <td className="num">{n1(r.mae)}</td>
                      <td className="num">{n1(r.mae_ingenuo)}</td>
                      <td style={{ color: 'var(--tinta-3)' }}>{r.regra_ingenua}</td>
                      <td className={`num ${r.supera_ingenuo ? 'pos' : 'neg'}`}>
                        {sinalPct(r.ganho_vs_ingenuo)}
                      </td>
                      <td>
                        {r.supera_ingenuo ? (
                          <Selo nivel="ok">supera o ingênuo</Selo>
                        ) : (
                          <Selo nivel="critico">perde do ingênuo</Selo>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="nota">
              1 de 6 cortes supera o baseline. A recomendação registrada no projeto: usar o
              modelo onde ele ganha (hoje, "com intervenção" em D+7) e a própria regra ingênua
              como referência operacional nos demais.
            </p>
          </Painel>

          <div className="grade">
            {dados.modelos.previsao_vs_real.map((s) => {
              const ganha = s.grupo === 'com_intervencao'
              return (
                <Painel
                  key={`${s.grupo}-${s.horizonte}`}
                  className="col-6"
                  titulo={`${rotulo(s.grupo)} · ${s.horizonte}`}
                  sub={
                    <>
                      Modelo {s.modelo} · acumulado de 7 dias · P2+P3+P4 ·{' '}
                      {ganha ? (
                        <span className="marca-modelo ganha">o corte que funciona</span>
                      ) : (
                        <span className="marca-modelo perde">o corte que não funciona</span>
                      )}
                    </>
                  }
                  nota={
                    ganha
                      ? 'Aqui o modelo acompanha o real e fica à frente da régua ingênua — é o único caso em que vale usá-lo em produção.'
                      : 'Aqui a régua ingênua (soma da última semana) erra menos que o modelo. O gráfico mostra o modelo previsto ficando atrás do real e da régua.'
                  }
                >
                  <SerieTemporal
                    dados={s.serie}
                    series={SERIES_PREV}
                    fmtX={diaMes}
                    altura={260}
                  />
                </Painel>
              )
            })}
          </div>

          <Aviso nivel="info" titulo="E o detector de anomalias?">
            Mesmo onde a previsão pontual perde, o modelo continua útil como detector: ali o que
            importa não é acertar o número, é ter a <b>banda calibrada</b>. Dias em que o real
            sai da banda são candidatos a evento sistêmico — ver a página de Risco &amp; alertas.
          </Aviso>
        </>
      )}
    </Estado>
  )
}

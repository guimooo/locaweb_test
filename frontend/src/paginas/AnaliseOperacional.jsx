import { useMemo } from 'react'
import { useDados } from '../comum/dados.js'
import { Estado, Painel, Aviso } from '../componentes/Base.jsx'
import {
  BarrasHorizontais, BarrasEmpilhadasH, BarrasAgrupadas,
} from '../componentes/Grafico.jsx'
import { n0, n1, n2, dataBR, rotulo } from '../comum/formato.js'
import { PRIORIDADE, SEQ_AZUL } from '../comum/paleta.js'

export default function AnaliseOperacional() {
  const { dados, erro, carregando } = useDados('por_classe', 'por_time', 'sazonalidade', 'sinais')

  const classePrio = useMemo(
    () =>
      dados?.por_classe.itens
        .slice(0, 8)
        .map((i) => ({ nome: rotulo(i.nome), 2: i.p2, 3: i.p3, 4: i.p4 })) ?? [],
    [dados],
  )

  const sistemicos = useMemo(
    () =>
      dados?.sinais.concentracao_p3_com_intervencao
        .filter((d) => d.razao >= 1.3)
        .sort((a, b) => b.razao - a.razao)
        .slice(0, 12) ?? [],
    [dados],
  )

  return (
    <Estado carregando={carregando} erro={erro}>
      {dados && (
        <>
          <div className="pg-cabecalho">
            <h1>Análise operacional</h1>
            <p>
              Onde os incidentes se concentram — por classe de alerta, por time e no tempo.
              Filtros e recortes para achar as combinações problemáticas.
            </p>
          </div>

          <div className="grade">
            <Painel
              className="col-6"
              titulo="Classe de alerta × prioridade"
              sub="Top 8 classes em 2025, empilhadas por prioridade"
              nota="Cada classe tem um perfil de prioridade próprio: 'erro de aplicação' é quase todo P4; 'performance degradada' concentra P3; 'disponibilidade de serviço' é a que mais gera P2."
            >
              <BarrasEmpilhadasH
                dados={classePrio}
                series={[
                  { chave: '2', nome: 'P2', cor: PRIORIDADE[2] },
                  { chave: '3', nome: 'P3', cor: PRIORIDADE[3] },
                  { chave: '4', nome: 'P4', cor: PRIORIDADE[4] },
                ]}
              />
            </Painel>

            <Painel
              className="col-6"
              titulo="Volume por time responsável"
              sub="Grupo designado, 2025"
              nota={dados.por_time.nota}
            >
              <BarrasHorizontais
                dados={dados.por_time.itens.slice(0, 10).map((i) => ({ nome: i.nome, valor: i.abertos }))}
                corPadrao={SEQ_AZUL}
              />
            </Painel>

            <Painel
              className="col-6"
              titulo="Sazonalidade — dia da semana"
              sub="Média de incidentes/dia em 2025"
              nota="O volume cai no fim de semana, mas não some — a operação é 24×7 e o monitoramento automático não folga."
            >
              <BarrasAgrupadas
                dados={dados.sazonalidade.dia_semana}
                x="dia"
                series={[{ chave: 'media', nome: 'média/dia', cor: SEQ_AZUL }]}
                altura={240}
                fmtValor={n1}
              />
            </Painel>

            <Painel
              className="col-6"
              titulo="Sazonalidade — mês"
              sub="Média de incidentes/dia em 2025"
              nota="O degrau de setembro é a automação entrando, não sazonalidade. De setembro em diante o patamar é outro."
            >
              <BarrasAgrupadas
                dados={dados.sazonalidade.mes}
                x="mes"
                series={[{ chave: 'media', nome: 'média/dia', cor: SEQ_AZUL }]}
                altura={240}
                fmtValor={n1}
              />
            </Painel>

            <Painel
              className="col-12"
              titulo="Dias de concentração — evento sistêmico ou volume espalhado?"
              sub="Incidentes por item de configuração (P3, com intervenção) contra a mediana móvel de 90 dias"
              nota={dados.sinais.nota}
            >
              <div className="tabela-rol">
                <table className="dados">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th className="num">Inc. por IC</th>
                      <th className="num">Mediana 90d</th>
                      <th className="num">Razão</th>
                      <th>Leitura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sistemicos.map((d) => (
                      <tr key={d.data}>
                        <td>{dataBR(d.data)}</td>
                        <td className="num">{n2(d.inc_por_ic)}</td>
                        <td className="num">{n2(d.mediana_90d)}</td>
                        <td className="num">
                          <b>{n2(d.razao)}×</b>
                        </td>
                        <td>
                          {d.razao >= 2
                            ? 'sistêmico — poucos ICs puxando o volume'
                            : 'concentração acima do normal'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Painel>
          </div>

          <Aviso nivel="info" titulo="Por que isso importa">
            400 incidentes espalhados por 200 itens de configuração é volume alto de operação
            normal; 400 incidentes em 3 ICs é um incidente sistêmico. As duas situações têm o
            mesmo total — só a razão as distingue, e ela é o único ganho estatisticamente sólido
            do estudo de features do projeto.
          </Aviso>
        </>
      )}
    </Estado>
  )
}

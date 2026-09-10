// Wrappers finos em torno do Recharts, com o padrão visual do projeto:
// marcas finas, grade discreta, tooltip pt-BR, legenda sempre presente com ≥2 séries.

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { TINTA } from '../comum/paleta.js'
import { n0, n1 } from '../comum/formato.js'

const GRADE = { stroke: TINTA.grade, strokeDasharray: '0' }
const EIXO = {
  tick: { fill: TINTA.fraca, fontSize: 11 },
  axisLine: { stroke: TINTA.eixo },
  tickLine: false,
}

function TooltipViz({ active, payload, label, fmtLabel, fmtValor = n0 }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="tt-viz">
      <div className="tt-data">{fmtLabel ? fmtLabel(label) : label}</div>
      {payload
        .filter((p) => p.value != null)
        .map((p) => (
          <div className="tt-linha" key={p.dataKey}>
            <span className="tt-pt" style={{ background: p.color || p.stroke || p.fill }} />
            <span>{p.name}</span>
            <span className="tt-val">{fmtValor(p.value)}</span>
          </div>
        ))}
    </div>
  )
}

function LegendaViz({ payload }) {
  if (!payload || payload.length < 2) return null
  return (
    <div className="legenda">
      {payload.map((e) => (
        <span key={e.value}>
          <i style={{ background: e.color }} />
          {e.value}
        </span>
      ))}
    </div>
  )
}

/**
 * series: [{ chave, nome, cor, tipo?: 'area'|'linha', tracejado?: bool }]
 */
export function SerieTemporal({
  dados, series, x = 'data', altura = 300, fmtX, fmtValor = n0, referencias = [],
}) {
  return (
    <div style={{ width: '100%', height: altura }}>
      <ResponsiveContainer>
        <AreaChart data={dados} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <defs>
            {series.map((s) => (
              <linearGradient id={`g-${s.chave}`} key={s.chave} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.cor} stopOpacity={0.18} />
                <stop offset="100%" stopColor={s.cor} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid {...GRADE} vertical={false} />
          <XAxis dataKey={x} {...EIXO} minTickGap={40} tickFormatter={fmtX} />
          <YAxis {...EIXO} width={44} tickFormatter={(v) => n0(v)} />
          <Tooltip content={<TooltipViz fmtLabel={fmtX} fmtValor={fmtValor} />} />
          <Legend content={<LegendaViz />} />
          {referencias.map((r) => (
            <ReferenceLine
              key={r.x}
              x={r.x}
              stroke={r.cor || TINTA.secundaria}
              strokeDasharray="4 3"
              label={{ value: r.rotulo, position: 'insideTopRight', fill: TINTA.fraca, fontSize: 10 }}
            />
          ))}
          {series.map((s) =>
            s.tipo === 'linha' ? (
              <Line
                key={s.chave}
                type="monotone"
                dataKey={s.chave}
                name={s.nome}
                stroke={s.cor}
                strokeWidth={2}
                strokeDasharray={s.tracejado ? '5 4' : undefined}
                dot={false}
                connectNulls
              />
            ) : (
              <Area
                key={s.chave}
                type="monotone"
                dataKey={s.chave}
                name={s.nome}
                stroke={s.cor}
                strokeWidth={1.8}
                fill={`url(#g-${s.chave})`}
                dot={false}
                connectNulls
              />
            ),
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * Barras horizontais de magnitude por categoria — um hue só, sem legenda.
 * dados: [{ nome, valor, cor? }]
 */
export function BarrasHorizontais({ dados, altura, fmtValor = n0, corPadrao = '#2a78d6' }) {
  const h = altura || Math.max(120, dados.length * 30 + 20)
  return (
    <div style={{ width: '100%', height: h }}>
      <ResponsiveContainer>
        <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 44, bottom: 4, left: 4 }}>
          <CartesianGrid {...GRADE} horizontal={false} />
          <XAxis type="number" {...EIXO} tickFormatter={(v) => n0(v)} />
          <YAxis
            type="category"
            dataKey="nome"
            {...EIXO}
            width={150}
            tick={{ fill: TINTA.secundaria, fontSize: 12 }}
          />
          <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} content={<TooltipViz fmtValor={fmtValor} />} />
          <Bar dataKey="valor" name="incidentes" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {dados.map((d, i) => (
              <Cell key={i} fill={d.cor || corPadrao} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * Barras horizontais empilhadas — ex.: classe no Y, P2/P3/P4 empilhadas.
 * series: [{ chave, nome, cor }]
 */
export function BarrasEmpilhadasH({ dados, series, altura, fmtValor = n0 }) {
  const h = altura || Math.max(140, dados.length * 32 + 30)
  return (
    <div style={{ width: '100%', height: h }}>
      <ResponsiveContainer>
        <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
          <CartesianGrid {...GRADE} horizontal={false} />
          <XAxis type="number" {...EIXO} tickFormatter={(v) => n0(v)} />
          <YAxis type="category" dataKey="nome" {...EIXO} width={150}
            tick={{ fill: TINTA.secundaria, fontSize: 12 }} />
          <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} content={<TooltipViz fmtValor={fmtValor} />} />
          <Legend content={<LegendaViz />} />
          {series.map((s, i) => (
            <Bar key={s.chave} dataKey={s.chave} name={s.nome} fill={s.cor} stackId="a"
              maxBarSize={22} radius={i === series.length - 1 ? [0, 4, 4, 0] : 0} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * Barras verticais agrupadas — ex.: prioridade por dia da semana / mês.
 * series: [{ chave, nome, cor }]
 */
export function BarrasAgrupadas({ dados, series, x, altura = 260, empilhado = false, fmtValor = n0 }) {
  return (
    <div style={{ width: '100%', height: altura }}>
      <ResponsiveContainer>
        <BarChart data={dados} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid {...GRADE} vertical={false} />
          <XAxis dataKey={x} {...EIXO} />
          <YAxis {...EIXO} width={44} tickFormatter={(v) => n0(v)} />
          <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} content={<TooltipViz fmtValor={fmtValor} />} />
          <Legend content={<LegendaViz />} />
          {series.map((s) => (
            <Bar
              key={s.chave}
              dataKey={s.chave}
              name={s.nome}
              fill={s.cor}
              stackId={empilhado ? 'a' : undefined}
              radius={empilhado ? 0 : [3, 3, 0, 0]}
              maxBarSize={44}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export { n1 }

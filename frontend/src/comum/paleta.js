// Paleta — instância validada da skill dataviz (tema claro).
// Categóricas em ordem fixa, nunca cicladas. Prioridade = rampa ordinal de severidade.

export const SERIE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e34948', '#4a3aa7']

export const PRIORIDADE = {
  2: '#e34948', // alta   — vermelho
  3: '#eb6834', // média  — laranja
  4: '#eda100', // baixa  — amarelo
}

export const GRUPO = {
  com_intervencao: '#2a78d6', // azul
  sem_intervencao: '#1baf7a', // aqua
  total: '#4a3aa7',           // violeta
}

export const STATUS = {
  ok: '#0ca30c',
  atencao: '#d98e00',
  critico: '#d03b3b',
}

// tinta de texto — nunca a cor da série
export const TINTA = {
  primaria: '#14140f',
  secundaria: '#55534c',
  fraca: '#8a887f',
  grade: '#e7e5dd',
  eixo: '#c3c2b7',
}

// Um hue só para "magnitude por categoria" (barras de volume) — sequencial azul.
export const SEQ_AZUL = '#2a78d6'

export const eixoRecharts = {
  tick: { fill: TINTA.fraca, fontSize: 11 },
  axisLine: { stroke: TINTA.eixo },
  tickLine: false,
}

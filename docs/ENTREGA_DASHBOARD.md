# Entrega — Dashboard analítico + Front-end AIOps ("Ddip")

Documento da entrega de interface do projeto `challenge_locaweb`. Descreve o que foi
construído em `frontend/`, as decisões por trás, como rodar, como publicar e o que ainda
falta. Escrito para ser lido pelo grupo e por quem avalia.

> **Contexto.** O projeto já tinha, funcionando: pipeline de dados em 4 camadas, 18 modelos
> ARIMA/SARIMA, uma API FastAPI e uma página web técnica — tudo rodando só na máquina de
> quem desenvolveu. A orientação pedia **duas interfaces**: um dashboard analítico (visão
> histórica do problema operacional) e um front-end "produto AIOps" (antecipação de
> incidentes), publicáveis de graça e apresentáveis. Esta entrega faz as duas coisas numa
> SPA só, publicável no Vercel.

---

## 1. Decisões de arquitetura

| Decisão | Por quê |
|---|---|
| **Site 100% estático**, alimentado por JSON pré-calculado | Os dados do projeto terminam em 2025-12-31 e os modelos estão congelados no treino. Um retrato estático não perde nada, publica no Vercel em minutos e **não tem backend para cair durante a apresentação**. |
| **Não subir a API FastAPI** | Custaria hospedar 19 MB de modelo/dado, conviver com *cold start* de tier gratuito e mais peças para falhar ao vivo. A API continua existindo para quem quiser rodá-la; o site não depende dela. |
| **Reaproveitar o código de serving** (`api/`) para gerar a previsão | Nenhum modelo foi re-treinado nem re-implementado. O gerador chama `api.previsao`, `api.ola`, `api.capacidade`, `api.atipicos` — a mesma lógica que o `pytest` valida contra a camada gold. |
| **Vite + React + Recharts**, tema claro | Stack padrão que o Vercel detecta sozinho; tema claro projeta melhor num telão. |
| **`frontend/` dentro do repositório atual** | Um repositório só. O gerador de dados e os JSON ficam junto do resto do projeto. |

---

## 2. Estrutura

```
frontend/
├── public/dados/*.json         ← 10 arquivos, VERSIONADOS (é o que alimenta o site)
├── src/
│   ├── comum/                  formato pt-BR · paleta · carga dos JSON
│   ├── componentes/            Base (KPI, Painel, Aviso, Selo) · Grafico (wrappers Recharts)
│   ├── paginas/                as 5 telas
│   ├── App.jsx / main.jsx      casca + roteamento (hash router — deep-link sem config no Vercel)
│   └── estilo.css              sistema visual (tema claro, paleta validada)
├── package.json / vite.config.js / index.html
└── README.md                   como rodar, regerar dados e publicar

scripts/
├── gerar_dados_dashboard.py    só stdlib — lê silver/gold, escreve 9 JSON
└── gerar_dados_previsao.py     reusa api/ — roda os 18 modelos, escreve previsao.json
```

**Branch:** `feat/frontend-dashboard-aiops` · **commit:** `330fa0c`

---

## 3. As telas

Todas as telas leem apenas arquivos de `public/dados/`. Nenhum número é digitado à mão —
tudo sai das camadas silver/gold ou dos modelos.

### 3.1 Visão executiva (`/`)

O problema operacional em números.

- **KPIs**: incidentes em 2025 (**121.485**), média diária **por regime** (~123/dia antes
  da automação de setembro, ~762 depois — a média anual sozinha engana), P2/P3/P4, maior
  volume num dia (**1.431 em 22/09/2025**), fatia que fecha sozinha no monitoramento
  (~66%) vs. a que exige trabalho humano.
- **Evolução diária** de incidentes abertos, com alternância prioridade / tipo de
  tratamento / total e janela 2025 ou histórico completo. Linha de referência na quebra
  de 2025-09-03.
- **Distribuição por prioridade** (P4 é o maior volume, ~53%) e **por classe de alerta**
  (líder: `erro de aplicação`, 30,6%).

**Fonte:** `s_fato_diario_prioridade.csv`, `s_fato_diario_classe.csv`.

### 3.2 Command Center (`/comando`)

A tela "produto". Origem da projeção: **31/12/2025** (fim do histórico) — é o caso de uso
real (features existem, o alvo cai no futuro, sem valor real para comparar).

- **Status atual** (🟢/🟡/🔴) derivado do que está medido: cumprimento de OLA da P3 e a
  tendência da projeção D+7.
- **Manchete D+1 e D+7**: volume total previsto vs. média recente, com selo de confiança —
  *"previsão confiável"* onde o modelo supera a régua ingênua no teste, *"baixa confiança —
  a régua simples tende a errar menos"* onde não.
- **Tabela por prioridade e tipo**: previsão [banda 80%], variação vs. média, e por corte
  se vale o modelo ou a régua.
- **Central de alertas preditivos**: dias do período de teste em que o real saiu da banda
  de 95% do modelo, com contagem de "marca sistêmica" (poucos ICs concentrando o volume).
- **Capacidade**: analistas/dia por prioridade para dar conta do D+7 de `com_intervencao`.
- **Onde agir primeiro**: TOP 3.

**Fonte:** `previsao.json`, gerado rodando os 18 modelos via `scripts/gerar_dados_previsao.py`.

### 3.3 Análise operacional (`/operacional`)

- **Classe × prioridade** (barras empilhadas): cada classe tem um perfil próprio —
  `erro de aplicação` é quase todo P4, `performance degradada` concentra P3,
  `disponibilidade de serviço` é a que mais gera P2.
- **Volume por time**: com o aviso de que o `Team14` concentra ~76% de toda a base.
- **Sazonalidade** por dia da semana e por mês.
- **Dias de concentração**: `incidentes por IC` contra a mediana móvel de 90 dias —
  sistêmico vs. volume espalhado.

**Fonte:** `s_fato_diario_classe.csv`, `s_fato_diario_time.csv`, `s_fato_diario_prioridade.csv`.

### 3.4 Tendência & previsão (`/previsao`)

A leitura honesta do que os modelos entregam.

- **Placar dos 6 cortes** (grupo × horizonte): MAE do modelo vs. MAE da régua ingênua,
  com ✅ / ❌ ao lado de cada linha.
- **Previsão vs. real** de dois cortes: `com_intervencao` D+7 (o que funciona — o modelo
  acompanha o real e fica à frente da régua) e `total` D+7 (o que não funciona — a régua
  erra menos).

**Fonte:** `g_avaliacao_modelos.csv`, `g_previsoes.csv` (período de teste, dado real).

### 3.5 Risco & alertas (`/alertas`)

- **Cumprimento de OLA — regra de duração**: atingimento atual de P2 (**75%**) e P3
  (**125%**, caiu de faixa em 26/12), histórico do 2º semestre. P4 marcada como "sem meta".
- **Ressalvas do projeto**, exibidas em vez de escondidas: faixa de OLA por volume
  estourada (0% o ano inteiro), P4 sem faixa.
- **Central de alertas preditivos** (anomalias estatísticas: volume a ±2,5 desvios da
  média móvel de 30 dias, dentro do mesmo regime).
- **Onde agir primeiro** (derivado do histórico, não de modelo).

**Fonte:** `s_fato_ola_prioridade.csv`, `s_fato_diario_prioridade.csv`.

---

## 4. Pipeline de dados

```
2_silver_data/ + 3_gold_data/              models/ (18 .pkl) + api/
        │                                          │
        ▼                                          ▼
scripts/gerar_dados_dashboard.py           scripts/gerar_dados_previsao.py
  (só stdlib do Python)                       (precisa do .venv — statsmodels 0.14.6)
        │                                          │
        ▼                                          ▼
frontend/public/dados/{kpis, serie_diaria,   frontend/public/dados/previsao.json
  por_classe, por_time, sazonalidade,          (previsão D+1/D+7 de produção,
  sinais, ola, modelos, meta}.json              capacidade, dias atípicos)
        │
        └──────────────┬───────────────────────────┘
                       ▼
              frontend/  (Vite build)  →  Vercel  →  site estático
```

Os JSON são **versionados**. O Vercel só roda `vite build` — nunca executa os geradores
Python. Quando os dados ou modelos mudarem: re-rodar os geradores, commitar os JSON, dar
push; o Vercel redeploya sozinho.

---

## 5. Honestidade sobre os modelos

**1 de 6 cortes de modelo supera o baseline ingênuo** — só `com_intervencao` em D+7
(+36,7% de MAE: 58,2 contra 91,9). Nos outros 5 a regra ingênua ("amanhã = hoje" ou "a
semana que vem = a última semana") erra menos que o modelo.

Isso não foi suavizado em lugar nenhum:

- **Tendência & previsão** — placar com ✅ / ❌ e o gráfico do corte que não funciona ao
  lado do que funciona.
- **Command Center** — selo *"baixa confiança — a régua simples tende a errar menos"* na
  manchete e coluna "use a régua (N)" por corte na tabela.
- É medição do projeto (`3_gold_data/g_avaliacao_modelos.csv`), não opinião. A recomendação
  registrada: usar o modelo onde ele ganha e a régua ingênua como referência nos demais.

O detector de dias atípicos continua útil onde a previsão pontual perde — ali o que importa
é a **banda calibrada**, não acertar o número.

---

## 6. Rodar local

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

Regerar os dados (da raiz do repositório), se as camadas ou os modelos mudarem:

```bash
python scripts/gerar_dados_dashboard.py
.venv/Scripts/python.exe scripts/gerar_dados_previsao.py     # precisa do .venv
```

---

## 7. Publicar no Vercel

1. [vercel.com](https://vercel.com) → **Add New… → Project** → importar `jffdevbr/challenge_locaweb`.
2. **Root Directory:** `frontend` — o Vercel detecta o preset **Vite** sozinho
   (build `vite build`, saída `dist/`).
3. **Deploy.** **Nenhuma variável de ambiente.** Sai uma URL `*.vercel.app`.

Para virar a URL principal: fazer merge de `feat/frontend-dashboard-aiops` em `main`
(o Vercel redeploya a produção a cada push na branch conectada).

### Atualizar depois

1. Regerar os JSON (seção 6).
2. `git add frontend/public/dados && git commit && git push`.
3. Redeploy automático.

---

## 8. Verificado

| Item | Estado |
|---|---|
| `npm run build` | ✅ limpo (842 módulos, ~186 KB gzip de JS) |
| `pytest tests/` | ✅ 61/61 — o serving reproduz a camada gold, então os números da previsão são os mesmos que o notebook mediu |
| Números do dashboard conferidos contra a fonte | ✅ amostra (total 2025, split por regime, placar dos 6 cortes) |
| Conferência visual no ambiente real | ⏳ pendente — o preview do Vercel desta branch é o teste |

---

## 9. Limitações conhecidas

- **"Produto/serviço" não tem série diária no projeto** (63% de nulo na base bruta). Onde a
  orientação pede recorte por produto, o dashboard usa **classe de alerta** (`classe_descricao`,
  11 classes rotuladas por LLM) como substituto — é o único eixo qualitativo com série limpa.
- **Timeline dia-a-dia D+1…D+7 não é possível**: os modelos preveem D+1 (o dia) e o
  acumulado de 7 dias; os dias 2 a 6 individuais não são modelados. O Command Center mostra
  D+1 e o total da semana.
- **Faixa de OLA por volume estourada** — herdado do projeto (as faixas foram calibradas
  para outra escala). O painel diz isso; não inventa número.
- **P4 sem meta de OLA** — idem. P4 tem modelo próprio para D+1 e D+7; só não tem faixa de OLA.

---

## 10. Onde cada parte da orientação foi atendida

| Pedido da orientação | Onde |
|---|---|
| Página 1 — Visão Executiva (KPIs, gráficos) | tela **Visão executiva** |
| Página — Análise Operacional (categorias, produtos, equipes, filtros) | tela **Análise operacional** |
| Página — Tendência e Previsão (histórico, D+1, D+7) | tela **Tendência & previsão** + Command Center |
| Página — Risco e Alertas (🔴🟡🟢, metodologia explicável) | tela **Risco & alertas** + status do Command Center |
| Explicabilidade (o quê, por quê, onde, ação) | notas de rodapé em cada painel + bloco "Leitura" / "onde agir primeiro" |
| Front-end "produto AIOps" / Operational Command Center | tela **Command Center** |
| Central de alertas preditivos | Command Center + Risco & alertas |
| "Onde agir primeiro" (TOP 3) | Command Center e Risco & alertas |
| Não inventar dados | todos os números saem de silver/gold/modelos; ressalvas exibidas |
| Reusar a arquitetura existente | geradores chamam `api/`; nenhum modelo re-treinado |
| Deploy gratuito (Vercel) | site estático, Root Directory `frontend`, sem env vars |

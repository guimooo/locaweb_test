# Ddip — painel de antecipação de incidentes

Front-end do projeto `challenge_locaweb`: um **dashboard analítico** (visão histórica do
problema operacional) + um **Command Center** (antecipação D+1 / D+7). SPA em React,
servida como site **estático** e alimentada por JSON pré-calculado a partir das camadas
`2_silver_data/` e `3_gold_data/` e dos 18 modelos.

> **Por que estático.** Os dados do projeto terminam em 2025-12-31 e os modelos estão
> congelados no treino. Um retrato estático não perde nada, não tem backend para cair
> durante a apresentação e publica no Vercel em minutos.

---

## Estrutura

```
frontend/
├── public/dados/*.json      ← dados pré-calculados (VERSIONADOS — é o que alimenta o site)
├── src/
│   ├── comum/               formato pt-BR, paleta, carga dos JSON
│   ├── componentes/         Base (KPI, Painel, Aviso…) e Grafico (wrappers de Recharts)
│   ├── paginas/             VisãoExecutiva · CommandCenter · AnáliseOperacional ·
│   │                        TendênciaPrevisão · RiscoAlertas
│   ├── App.jsx  main.jsx    casca + roteamento (hash router)
│   └── estilo.css           sistema visual (tema claro, paleta validada da skill dataviz)
└── ...
```

Os geradores de dados ficam em `../scripts/` (Python):

| Script | Gera | Precisa de |
|---|---|---|
| `scripts/gerar_dados_dashboard.py` | `kpis`, `serie_diaria`, `por_classe`, `por_time`, `sazonalidade`, `sinais`, `ola`, `modelos` | só a stdlib do Python |
| `scripts/gerar_dados_previsao.py` | `previsao.json` (previsão de produção D+1/D+7, capacidade, dias atípicos) | o `.venv` do projeto (statsmodels 0.14.6) |

---

## Rodar local

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

Se os JSON de `public/dados/` sumirem ou os dados mudarem, regere-os da raiz do repo:

```bash
python scripts/gerar_dados_dashboard.py
.venv/Scripts/python.exe scripts/gerar_dados_previsao.py     # Windows; precisa do .venv
```

## Build

```bash
npm run build          # -> dist/
npm run preview        # serve o dist localmente
```

---

## Variáveis de ambiente

**Nenhuma.** O site não fala com nenhuma API — lê só os arquivos de `public/dados/`. Não há
o que configurar para rodar local nem para publicar.

## Deploy no Vercel

1. `git push` do repositório (com a pasta `frontend/` e os JSON de `public/dados/`).
2. Vercel → **Add New… → Project** → importar o repositório `challenge_locaweb`.
3. Em **Root Directory**, selecionar `frontend`. O Vercel detecta o preset **Vite** sozinho
   (build `vite build`, saída `dist`). Nada mais a configurar.
4. **Deploy.** Sai uma URL `*.vercel.app`.

### Atualizar o site depois

1. Regerar os JSON (comandos acima) se os dados/modelos mudaram.
2. `git add frontend/public/dados && git commit && git push`.
3. O Vercel redeploya sozinho a cada push na branch conectada.

---

## Honestidade sobre os modelos

**1 de 6 cortes de modelo supera o baseline ingênuo** — só `com_intervencao` em D+7
(+36,7% de MAE). Isso aparece na página *Tendência & previsão* (placar com ✅/❌), no
*Command Center* (selo "baixa confiança — a régua simples tende a errar menos") e não está
escondido em lugar nenhum. É medição do projeto, não opinião.

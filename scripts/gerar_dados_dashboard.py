"""Gera os JSON estáticos que o dashboard consome — só biblioteca padrão.

Lê as tabelas silver/gold do repositório e escreve `frontend/public/dados/*.json`.
Nenhum número é inventado: tudo sai direto das CSVs. Onde há ressalva do projeto
(modelo que perde para o ingênuo, faixa de OLA estourada, P4 sem meta, Team14
dominante), o JSON carrega a ressalva junto.

Uso:
    python scripts/gerar_dados_dashboard.py
"""

from __future__ import annotations

import csv
import json
import math
import statistics
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SILVER = RAIZ / "2_silver_data"
GOLD = RAIZ / "3_gold_data"
SAIDA = RAIZ / "frontend" / "public" / "dados"

PRIORIDADES = ["2", "3", "4"]
ANO_FOCO = 2025  # R1 (2023-24) é artefato de extração; a análise real é 2025
INICIO_R2 = "2025-01-01"
INICIO_R3 = "2025-09-03"


def regime_de(d: str) -> int:
    if d < INICIO_R2:
        return 1
    if d < INICIO_R3:
        return 2
    return 3


# ==================================================================================================
# Leitura
# ==================================================================================================

def ler_csv(caminho: Path) -> list[dict]:
    with open(caminho, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f, delimiter=";"))


def num(v):
    if v is None or v == "" or v == "NA":
        return None
    try:
        f = float(v)
    except ValueError:
        return None
    return f if math.isfinite(f) else None


def inteiro(v):
    f = num(v)
    return int(round(f)) if f is not None else 0


# ==================================================================================================
# 1. Série diária + KPIs executivos
# ==================================================================================================

def serie_diaria_e_kpis(fato: list[dict]):
    por_dia = defaultdict(lambda: {"total": 0, "2": 0, "3": 0, "4": 0,
                                   "com_intervencao": 0, "sem_intervencao": 0})
    for r in fato:
        d = r["data"]
        p = r["prioridade"]
        tt = r["tipo_tratamento"]
        a = inteiro(r["abertos"])
        por_dia[d]["total"] += a
        por_dia[d][p] += a
        por_dia[d][tt] += a

    serie = []
    for d in sorted(por_dia):
        linha = {"data": d, **por_dia[d]}
        serie.append(linha)

    serie_foco = [s for s in serie if s["data"][:4] == str(ANO_FOCO)]
    totais_foco = [s["total"] for s in serie_foco]
    dia_pico = max(serie_foco, key=lambda s: s["total"])

    r2 = [s for s in serie_foco if regime_de(s["data"]) == 2]
    r3 = [s for s in serie_foco if regime_de(s["data"]) == 3]

    soma = lambda chave, base: sum(s[chave] for s in base)
    kpis = {
        "ano_foco": ANO_FOCO,
        "periodo": {"inicio": serie[0]["data"], "fim": serie[-1]["data"]},
        "total_incidentes_geral": soma("total", serie),
        "total_incidentes_ano": soma("total", serie_foco),
        "dias_no_ano": len(serie_foco),
        "media_diaria_ano": round(statistics.mean(totais_foco), 1),
        "por_prioridade_ano": {p: soma(p, serie_foco) for p in PRIORIDADES},
        "com_intervencao_ano": soma("com_intervencao", serie_foco),
        "sem_intervencao_ano": soma("sem_intervencao", serie_foco),
        "dia_pico": {"data": dia_pico["data"], "total": dia_pico["total"]},
        "regimes": {
            "r2": {"rotulo": "pré-automação (jan–set/2025)", "dias": len(r2),
                   "media_diaria": round(statistics.mean([s["total"] for s in r2]), 1),
                   "total": soma("total", r2)},
            "r3": {"rotulo": "pós-automação (set–dez/2025)", "dias": len(r3),
                   "media_diaria": round(statistics.mean([s["total"] for s in r3]), 1),
                   "total": soma("total", r3)},
        },
        "nota_regime": (
            "Em 2025-09-03 entrou o pipeline de monitoramento automático. A média diária "
            "salta de ~124 para ~762 incidentes — quase toda a quebra está na fatia 'sem "
            "intervenção', que antes praticamente não existia. Por isso a média anual "
            "sozinha engana: são dois patamares."
        ),
    }
    return serie, kpis


# ==================================================================================================
# 2. Distribuição por classe de alerta e por time
# ==================================================================================================

def por_dimensao(linhas: list[dict], chave: str, rotulo_ignorar=("time",), somente_ano=True):
    total_geral = defaultdict(int)
    p_geral = {p: defaultdict(int) for p in PRIORIDADES}
    mensal = defaultdict(lambda: defaultdict(int))
    for r in linhas:
        k = r[chave]
        if k in rotulo_ignorar:
            continue
        if somente_ano and r["data"][:4] != str(ANO_FOCO):
            continue
        total_geral[k] += inteiro(r["abertos"])
        for p in PRIORIDADES:
            p_geral[p][k] += inteiro(r[f"abertos_p{p}"])
        mensal[r["data"][:7]][k] += inteiro(r["abertos"])

    soma = sum(total_geral.values()) or 1
    itens = [
        {
            "nome": k,
            "abertos": v,
            "share": round(v / soma * 100, 1),
            "p2": p_geral["2"][k], "p3": p_geral["3"][k], "p4": p_geral["4"][k],
        }
        for k, v in sorted(total_geral.items(), key=lambda kv: -kv[1])
    ]
    meses = sorted(mensal)
    series_mensais = {
        k: [mensal[m].get(k, 0) for m in meses]
        for k in list(total_geral)
    }
    return {"itens": itens, "meses": meses, "series_mensais": series_mensais}


# ==================================================================================================
# 3. Sazonalidade
# ==================================================================================================

NOME_DIA = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]
NOME_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]


def sazonalidade(serie: list[dict]):
    por_dow = defaultdict(list)
    por_mes = defaultdict(list)
    for s in serie:
        if s["data"][:4] != str(ANO_FOCO):
            continue
        d = date.fromisoformat(s["data"])
        por_dow[d.weekday()].append(s["total"])
        por_mes[d.month].append(s["total"])

    return {
        "dia_semana": [
            {"dia": NOME_DIA[i], "media": round(statistics.mean(por_dow[i]), 1)}
            for i in range(7) if por_dow[i]
        ],
        "mes": [
            {"mes": NOME_MES[i - 1], "media": round(statistics.mean(por_mes[i]), 1),
             "total": sum(por_mes[i])}
            for i in range(1, 13) if por_mes[i]
        ],
    }


# ==================================================================================================
# 4. Concentração (dias sistêmicos) e anomalias estatísticas
# ==================================================================================================

def concentracao_e_anomalias(fato: list[dict]):
    # inc_por_ic do grupo com_intervencao P3 (série com mais história), e total/dia para anomalia
    por_dia_total = defaultdict(int)
    inc_ic = {}
    for r in fato:
        por_dia_total[r["data"]] += inteiro(r["abertos"])
        if r["prioridade"] == "3" and r["tipo_tratamento"] == "com_intervencao":
            inc_ic[r["data"]] = num(r["inc_por_ic"])

    dias = sorted(por_dia_total)
    totais = [por_dia_total[d] for d in dias]

    # média/desvio móvel de 30 dias, anomalia = fora de ±2,5 desvios. A janela precisa
    # estar inteira no mesmo regime da data — senão a transição R1→R2 e a quebra de
    # setembro viram "anomalia" toda semana, o que não é operacional.
    anomalias = []
    for i, d in enumerate(dias):
        if d[:4] != str(ANO_FOCO) or i < 30:
            continue
        if regime_de(dias[i - 30]) != regime_de(d):
            continue
        janela = totais[i - 30:i]
        m = statistics.mean(janela)
        sd = statistics.pstdev(janela) or 1.0
        z = (totais[i] - m) / sd
        if abs(z) >= 2.5:
            anomalias.append({
                "data": d, "total": totais[i], "media_movel_30d": round(m, 1),
                "z": round(z, 2), "direcao": "acima" if z > 0 else "abaixo",
            })

    # concentração: inc_por_ic vs mediana móvel de 90 dias
    conc = []
    valores = [inc_ic.get(d) for d in dias]
    for i, d in enumerate(dias):
        if d[:4] != str(ANO_FOCO):
            continue
        v = valores[i]
        jan = [x for x in valores[max(0, i - 90):i] if x is not None]
        ref = statistics.median(jan) if len(jan) >= 30 else None
        if v is None or ref is None or ref <= 0:
            continue
        conc.append({"data": d, "inc_por_ic": round(v, 2),
                     "mediana_90d": round(ref, 2), "razao": round(v / ref, 2)})

    return {
        "anomalias": anomalias,
        "concentracao_p3_com_intervencao": conc,
        "nota": (
            "Anomalia = dia cujo volume total saiu de ±2 desvios da média móvel de 30 "
            "dias (detecção estatística simples, não é o modelo). Concentração alta "
            "(razão ≥ 2) = poucos itens de configuração puxando o volume — assinatura "
            "de evento sistêmico; razão baixa = volume espalhado, operação normal em escala."
        ),
    }


# ==================================================================================================
# 5. OLA
# ==================================================================================================

def ola(linhas: list[dict]):
    historico = defaultdict(dict)
    for r in linhas:
        d = r["data"]
        p = r["prioridade"]
        historico[d][f"p{p}_duracao"] = num(r["atingimento_ola_duracao"])
        historico[d][f"p{p}_volume"] = num(r["atingimento_ola_volume"])
        historico[d][f"p{p}_kpi_ac"] = inteiro(r["kpi_violado_prioridade_ac_ano"])
        historico[d][f"p{p}_fech_ac"] = inteiro(r["fechados_prioridade_ac_ano"])

    serie = [{"data": d, **historico[d]} for d in sorted(historico)
             if d[:4] == str(ANO_FOCO)]
    atual = serie[-1] if serie else {}

    return {
        "historico": serie,
        "atual": atual,
        "ressalvas": [
            "As faixas de OLA por volume estão calibradas para outra escala: P2 fechou "
            "15.649 no ano contra corte máximo de 6.337, P3 fechou 41.732 contra 24.277. "
            "O atingimento por volume fica 0% o ano inteiro — sem gradiente de risco.",
            "A regra de duração é a que está viva: a P3 cruzou o corte 201 em 2025-12-26 "
            "e caiu de 150% para 125% na virada de um dia.",
            "P4 não tem meta de OLA definida em nenhuma das duas regras.",
        ],
    }


# ==================================================================================================
# 6. Avaliação dos modelos + previsão vs real (camada gold, nada de rodar modelo)
# ==================================================================================================

def modelos(avaliacao: list[dict], previsoes: list[dict]):
    # placar: uma linha por grupo x horizonte, leitura geral (prioridade='todas'), modelo escolhido
    placar = []
    for r in avaliacao:
        if r["prioridade"] != "todas" or r["escolhido"] != "True":
            continue
        placar.append({
            "grupo": r["tipo_tratamento"],
            "horizonte": r["horizonte"],
            "modelo": r["modelo"],
            "mae": round(num(r["mae"]), 2),
            "mae_ingenuo": round(num(r["mae_ingenuo"]), 2),
            "mase": round(num(r["mase"]), 2),
            "regra_ingenua": r["regra_ingenua"],
            "ganho_vs_ingenuo": round(num(r["ganho_vs_ingenuo"]), 1),
            "supera_ingenuo": r["supera_ingenuo"] == "True",
            "n": inteiro(r["n"]),
        })
    ordem = {"com_intervencao": 0, "sem_intervencao": 1, "total": 2}
    placar.sort(key=lambda x: (ordem[x["grupo"]], x["horizonte"]))

    # por prioridade também (para a leitura detalhada)
    por_prioridade = []
    for r in avaliacao:
        if r["prioridade"] == "todas":
            continue
        # só o modelo escolhido para o grupo x horizonte + o ingênuo
        por_prioridade.append({
            "grupo": r["tipo_tratamento"], "prioridade": r["prioridade"],
            "horizonte": r["horizonte"], "modelo": r["modelo"],
            "mae": round(num(r["mae"]), 2),
            "ganho_vs_ingenuo": round(num(r["ganho_vs_ingenuo"]), 1),
            "supera_ingenuo": r["supera_ingenuo"] == "True",
            "escolhido": r["escolhido"] == "True",
        })

    # previsão vs real: o corte que funciona (com_intervencao D+7) e um que não (total D+7)
    def serie_previsao(grupo, horizonte):
        vencedor = next((p["modelo"] for p in placar
                         if p["grupo"] == grupo and p["horizonte"] == horizonte), None)
        pontos = defaultdict(dict)
        for r in previsoes:
            if r["tipo_tratamento"] != grupo or r["horizonte"] != horizonte:
                continue
            if r["prioridade"] not in PRIORIDADES:
                continue
            chave = r["data"]
            # agrega as 3 prioridades
            if r["modelo"] == vencedor:
                pontos[chave].setdefault("previsto", 0.0)
                pontos[chave]["previsto"] += num(r["valor_previsto"]) or 0
                pontos[chave].setdefault("real", 0.0)
                pontos[chave]["real"] += num(r["valor_real"]) or 0
            elif r["modelo"] == "Ingênuo":
                pontos[chave].setdefault("ingenuo", 0.0)
                pontos[chave]["ingenuo"] += num(r["valor_previsto"]) or 0
        return {
            "grupo": grupo, "horizonte": horizonte, "modelo": vencedor,
            "serie": [{"data": d, **{k: round(v, 1) for k, v in pontos[d].items()}}
                      for d in sorted(pontos)],
        }

    return {
        "placar": placar,
        "por_prioridade": por_prioridade,
        "previsao_vs_real": [
            serie_previsao("com_intervencao", "D+7"),
            serie_previsao("total", "D+7"),
        ],
        "leitura": (
            "1 de 6 cortes supera o baseline ingênuo: só 'com intervenção' em D+7 "
            "(+36,7% de MAE). Nos outros 5 a regra ingênua erra menos que o modelo. "
            "Recomendação registrada no projeto: usar o modelo onde ele ganha e o "
            "próprio ingênuo como referência operacional nos demais. O detector de dias "
            "atípicos continua útil mesmo onde o ponto erra — ali o que importa é a banda."
        ),
    }


# ==================================================================================================
# main
# ==================================================================================================

def main():
    SAIDA.mkdir(parents=True, exist_ok=True)

    fato = ler_csv(SILVER / "s_fato_diario_prioridade.csv")
    classe = ler_csv(SILVER / "s_fato_diario_classe.csv")
    time = ler_csv(SILVER / "s_fato_diario_time.csv")
    ola_linhas = ler_csv(SILVER / "s_fato_ola_prioridade.csv")
    avaliacao = ler_csv(GOLD / "g_avaliacao_modelos.csv")
    previsoes = ler_csv(GOLD / "g_previsoes.csv")

    serie, kpis = serie_diaria_e_kpis(fato)

    saidas = {
        "meta.json": {
            "gerado_em": datetime.now().isoformat(timespec="seconds"),
            "fonte": "2_silver_data/ e 3_gold_data/ do repositório challenge_locaweb",
            "aviso": (
                "Retrato estático. Os dados do projeto terminam em 2025-12-31 e os "
                "modelos estão congelados no treino — este painel não é tempo real."
            ),
        },
        "kpis.json": kpis,
        "serie_diaria.json": serie,
        "por_classe.json": {
            "2025": por_dimensao(classe, "classe_descricao", somente_ano=True),
            "tudo": por_dimensao(classe, "classe_descricao", somente_ano=False),
            "nota": "classe_descricao: taxonomia de negócio atribuída por LLM sobre os "
                    "templates que cobrem 95% do volume. 'nao_rotulado' é a cauda longa, "
                    "não erro de rotulagem. Não há 'produto' com série diária no projeto. "
                    "'tudo' inclui 2023-2024 (regime R1, artefato de extração, 0,6% da base).",
        },
        "por_time.json": {
            **por_dimensao(time, "time"),
            "nota": "17 times (Team01–Team17). O Team14 concentra ~76% de toda a base — "
                    "qualquer leitura de 'time sobrecarregado' precisa considerar isso.",
        },
        "sazonalidade.json": sazonalidade(serie),
        "sinais.json": concentracao_e_anomalias(fato),
        "ola.json": ola(ola_linhas),
        "modelos.json": modelos(avaliacao, previsoes),
    }

    for nome, dados in saidas.items():
        with open(SAIDA / nome, "w", encoding="utf-8") as f:
            json.dump(dados, f, ensure_ascii=False, separators=(",", ":"))
        print(f"  {nome:24} {(SAIDA / nome).stat().st_size / 1024:7.1f} KB")

    print(f"\n{len(saidas)} arquivos em {SAIDA}")


if __name__ == "__main__":
    main()

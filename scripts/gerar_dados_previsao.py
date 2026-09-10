"""Gera `frontend/public/dados/previsao.json` — a previsão de PRODUÇÃO.

Roda os 18 modelos a partir da última data do histórico (2025-12-31) e projeta D+1 e
D+7 para os 3 grupos × P2/P3/P4. É o caso de uso real: features existem, o alvo cai
depois do fim da série (selo SEM RESPOSTA), não há valor real para comparar.

Reaproveita os módulos de serving do projeto (`api/`) — nada de reimplementar. Precisa
do ambiente `.venv` (statsmodels 0.14.6, mesmas versões do treino).

Uso:
    .venv/Scripts/python.exe scripts/gerar_dados_previsao.py
"""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from api import atipicos as mod_atipicos  # noqa: E402
from api import capacidade as mod_capacidade  # noqa: E402
from api import config as cfg  # noqa: E402
from api import dominio as dom  # noqa: E402
from api import ola as mod_ola  # noqa: E402
from api import previsao as prev  # noqa: E402

SAIDA = RAIZ / "frontend" / "public" / "dados" / "previsao.json"
JANELA_MEDIA = 28


def media_recente(serie, coluna, dias=JANELA_MEDIA):
    v = serie[coluna].dropna().to_numpy(dtype=float)
    v = v[np.isfinite(v)]
    return float(np.mean(v[-dias:])) if len(v) else None


def card(dominio, modelos, grupo, prioridade, horizonte, origem):
    r = prev.prever(dominio, modelos, grupo, prioridade, horizonte, origem)
    if r["previsao"] is None:
        return {"previsao": None, "selo": r["situacao"]["selo"],
                "explicacao": r["situacao"]["explicacao"]}

    s = dominio.serie(grupo, prioridade)
    md = media_recente(s, "abertos")
    referencia = md if horizonte == "D+1" else (md * cfg.PASSO_MAXIMO if md is not None else None)
    var_pct = (round((r["previsao"] - referencia) / referencia * 100, 1)
               if referencia else None)

    d = r["desempenho_no_teste"]
    return {
        "previsao": r["previsao"],
        "banda": r["banda"],
        "media_recente": None if referencia is None else round(referencia, 1),
        "variacao_vs_media_pct": var_pct,
        "ingenuo": r["ingenuo"]["valor"],
        "regra_ingenua": r["ingenuo"]["regra"],
        "modelo": r["modelo"],
        "selo": r["situacao"]["selo"],
        "data_alvo": r["situacao"]["data_alvo"],
        "supera_ingenuo": d["supera_ingenuo"],
        "ganho_vs_ingenuo": round(d["ganho_vs_ingenuo"], 1),
        "mae_teste": round(d["mae"], 1),
    }


def painel_capacidade(dominio, modelos, prioridade, origem):
    p = mod_capacidade.painel(dominio, modelos, prioridade, origem, "D+7",
                              cfg.JORNADA_H_PADRAO, cfg.OCUPACAO_PADRAO,
                              cfg.FATOR_ESFORCO_PADRAO)
    dim = p.get("dimensionamento")
    if not dim:
        return {"disponivel": False}
    return {
        "disponivel": True,
        "incidentes_previstos": p["entrada"]["incidentes_previstos"],
        "analistas_por_dia": dim["analistas_por_dia"],
        "analistas_pior_caso": dim["analistas_por_dia_pior_caso"],
        "horas_por_dia": dim["horas_por_dia"],
        "por_turno": [{"turno": t["turno"], "analistas": t["analistas"]}
                      for t in p["por_turno"]],
        "aviso": p["avisos"][0]["texto"] if p.get("avisos") else None,
    }


def varredura_atipicos(dominio, modelos, prioridade):
    corte = pd.Timestamp(cfg.JANELA["com_intervencao"]["corte"])
    r = mod_atipicos.varrer(dominio, modelos, "com_intervencao", prioridade,
                            corte, dominio.data_max)
    return {
        "resumo": r["resumo"],
        "dias": [
            {"data": d["data"], "previsto": d["previsto"], "real": d["real"],
             "desvio_pct": d["desvio_pct"], "direcao": d["direcao"],
             "leitura": d["concentracao"]["leitura"] if d.get("concentracao") else None}
            for d in r["atipicos"]
        ],
    }


def main():
    dominio = dom.obter_dominio()
    modelos = prev.obter_modelos()
    origem = dominio.data_max
    print(f"origem = {origem:%Y-%m-%d} | {len(modelos)} modelos")

    horizontes = {}
    for h in cfg.HORIZONTES:
        horizontes[h] = {
            g: {p: card(dominio, modelos, g, p, h, origem) for p in cfg.PRIORIDADES}
            for g in cfg.GRUPOS
        }
        print(f"  {h}: ok")

    capacidade = {p: painel_capacidade(dominio, modelos, p, origem) for p in cfg.PRIORIDADES}
    print("  capacidade: ok")

    atipicos = {p: varredura_atipicos(dominio, modelos, p) for p in cfg.PRIORIDADES}
    print("  atipicos: ok")

    saida = {
        "gerado_em": datetime.now().isoformat(timespec="seconds"),
        "origem": origem.date().isoformat(),
        "janela_media_dias": JANELA_MEDIA,
        **horizontes,
        "capacidade": capacidade,
        "atipicos_teste": atipicos,
        "aviso": (
            "Previsão de produção: as features da origem existem, mas o alvo cai depois do "
            "fim do histórico — não há valor real para comparar (selo SEM RESPOSTA). A "
            "coluna de confiança diz, por corte, se o modelo supera a régua ingênua no "
            "período de teste: onde não supera, a recomendação do projeto é usar a régua."
        ),
    }

    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    with open(SAIDA, "w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False, separators=(",", ":"))
    print(f"\n{SAIDA}  ({SAIDA.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()

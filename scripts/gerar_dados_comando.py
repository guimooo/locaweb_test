"""Gera `frontend/public/dados/comando_por_dia.json` — o Command Center interativo.

Para cada data de origem no período em que os modelos têm previsão avaliável
(2025-11-20 → 2025-12-31), roda os 18 modelos e guarda:

- `d0`  — incidentes reais NO dia (a série `abertos`);
- `d1`  — previsão para o dia seguinte (previsto, real, régua ingênua, banda, selo);
- `d7`  — previsão para a semana seguinte (acumulado de D+1 a D+7);
- `ola` — atingimento de OLA na data;
- `media_28d` — média diária das últimas 28 dias, por grupo e prioridade (base da variação).

O front-end escolhe a data e recalcula tudo, inclusive o "onde agir primeiro".

Reaproveita `api/` — nada de reimplementar serving. Precisa do `.venv`.

Uso:
    .venv/Scripts/python.exe scripts/gerar_dados_comando.py
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

from api import config as cfg  # noqa: E402
from api import dominio as dom  # noqa: E402
from api import previsao as prev  # noqa: E402

SAIDA = RAIZ / "frontend" / "public" / "dados" / "comando_por_dia.json"
JANELA_MEDIA = 28
INICIO = pd.Timestamp("2025-11-20")   # corte de teste de com_intervencao — 1ª data com previsão out-of-sample


def media_28d(serie, i):
    v = serie["abertos"].iloc[max(0, i - JANELA_MEDIA + 1):i + 1].to_numpy(dtype=float)
    v = v[np.isfinite(v)]
    return round(float(v.mean()), 1) if len(v) else None


def card(dominio, modelos, grupo, prioridade, horizonte, origem):
    r = prev.prever(dominio, modelos, grupo, prioridade, horizonte, origem)
    if r["previsao"] is None:
        return {"previsto": None, "selo": r["situacao"]["selo"]}
    d = r["desempenho_no_teste"]
    return {
        "previsto": r["previsao"],
        "real": r["real"],
        "ingenuo": r["ingenuo"]["valor"],
        "regra_ingenua": r["ingenuo"]["regra"],
        "banda": [r["banda"]["inferior"], r["banda"]["superior"]],
        "modelo": r["modelo"],
        "selo": r["situacao"]["selo"],
        "data_alvo": r["situacao"]["data_alvo"],
        "supera_ingenuo": d["supera_ingenuo"],
        "ganho_vs_ingenuo": round(d["ganho_vs_ingenuo"], 1),
    }


def main():
    dominio = dom.obter_dominio()
    modelos = prev.obter_modelos()
    fim = dominio.data_max
    datas = pd.date_range(INICIO, fim, freq="D")
    print(f"{len(datas)} datas | {INICIO:%d/%m} a {fim:%d/%m} | {len(modelos)} modelos")

    ola = dominio.ola
    por_dia = {}
    for origem in datas:
        chave = origem.date().isoformat()
        dia = {"regime": None, "d0": {}, "d1": {}, "d7": {}, "media_28d": {}, "ola": {}}

        for g in cfg.GRUPOS:
            dia["d0"][g], dia["d1"][g], dia["d7"][g], dia["media_28d"][g] = {}, {}, {}, {}
            for p in cfg.PRIORIDADES:
                s = dominio.serie(g, p)
                i = dominio.indice_da_data(g, p, origem)
                if i is not None:
                    dia["d0"][g][p] = int(s["abertos"].iloc[i])
                    dia["media_28d"][g][p] = media_28d(s, i)
                    if dia["regime"] is None and "regime" in s.columns:
                        rv = s["regime"].iloc[i]
                        dia["regime"] = int(rv) if pd.notna(rv) else None
                dia["d1"][g][p] = card(dominio, modelos, g, p, "D+1", origem)
                dia["d7"][g][p] = card(dominio, modelos, g, p, "D+7", origem)

        linha_ola = ola[(ola.data == origem)]
        for _, lo in linha_ola.iterrows():
            pr = int(lo["prioridade"])
            dia["ola"][f"p{pr}_duracao"] = (None if pd.isna(lo["atingimento_ola_duracao"])
                                            else float(lo["atingimento_ola_duracao"]))
            dia["ola"][f"p{pr}_kpi_ac"] = int(lo["kpi_violado_prioridade_ac_ano"])

        por_dia[chave] = dia
        print(f"  {chave} ok")

    saida = {
        "gerado_em": datetime.now().isoformat(timespec="seconds"),
        "janela_media_dias": JANELA_MEDIA,
        "datas": [d.date().isoformat() for d in datas],
        "producao": fim.date().isoformat(),
        "por_dia": por_dia,
        "aviso": (
            "Os modelos só têm previsão avaliável no período de teste "
            f"({INICIO:%d/%m/%Y} a {fim:%d/%m/%Y}). Antes de 04/12 as séries 'sem "
            "intervenção' e 'total' ainda estavam em treino (selo TREINO — leitura "
            "otimista). Em 31/12 o alvo cai no futuro: é o caso de produção, sem real."
        ),
    }
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    with open(SAIDA, "w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False, separators=(",", ":"))
    print(f"\n{SAIDA}  ({SAIDA.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()

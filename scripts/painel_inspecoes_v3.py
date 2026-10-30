#!/usr/bin/env python3
"""Painel de Inspeções v3 — filtro por ano e os 8 gráficos pedidos.

Módulo isolado: substitui o bloco "inspecoes" do data.js sem alterar o
processa_dados.py. Importa os utilitários do próprio processa_dados.
"""
from __future__ import annotations

import re
import sys
from datetime import date
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from processa_dados import _norm, _sem_acento, MES_ORDEM  # noqa: E402


def _andar_do_setor(setor: str) -> str:
    """Usa apenas referências explícitas; nomes de serviços não comprovam andar."""
    s = _sem_acento(str(setor)).lower().strip()
    if "subsolo" in s:
        return "Subsolo"
    if "terreo" in s:
        return "Térreo"
    if "cobertura" in s:
        return "Cobertura"
    # Exemplos explícitos: 2°C, 2D, 3º andar, Oncologia (1°D).
    m = re.search(r"(?<!\d)([1-9])\s*[°ºo]?\s*(?:andar\b|[abcd]\b)", s)
    return f"{m.group(1)}° Andar" if m else "Não identificado"


# grafias equivalentes -> nome canonico (para nao duplicar setor no grafico)
_CANON_SETOR = {
    "2c": "2°C", "2°c": "2°C", "2ºc": "2°C",
    "2d": "2°D", "2°d": "2°D", "2ºd": "2°D",
    "3d": "3°D", "3°d": "3°D", "3°d internacao": "3°D Internação",
    "4d": "4°D", "4°d": "4°D", "4°d ala de internacao": "4°D",
    "oncologia- 1d": "Oncologia (1°D)", "oncologia - 1d": "Oncologia (1°D)",
    "oncologia ou 1°d": "Oncologia (1°D)",
    "uti ped": "UTI Pediátrica", "uti neo": "UTI Neonatal",
    "rm e uss": "RM e USS", "ressonancia magnetica": "Ressonância Magnética",
    "ressonancia magnetica hvc": "Ressonância Magnética",
    "ultrassom": "Ultrassom", "tomografia e ultrassom": "Tomografia e Ultrassom",
    "ps adulto": "PS Adulto", "pronto socorro": "Pronto Socorro",
    "pronto socorro infantil": "PS Infantil", "psa": "PSA", "psi": "PSI",
    "almoxarifado": "Almoxarifado", "almoxarifado e caf": "Almoxarifado e CAF",
    "cozinha e dnd": "Cozinha", "cozinha terreo": "Cozinha",
    "recepcao internacao": "Recepção da Internação",
    "recepcao da internacao": "Recepção da Internação",
    "corredor 2º andar": "Corredor 2° Andar", "corredor do terreo": "Corredor do Térreo",
    "terreo circulacao": "Térreo — circulação",
    "semi intensiva 1": "Semi Intensiva 1",
    "3ºc - semi intensiva": "3°C Semi Intensiva",
    "unidade neurologica": "Unidade Neurológica",
    "atual apoio cirurgico": "Apoio Cirúrgico",
    "docas, rouparia, necroterio, maquinas, abrigo de residuos": "Docas e Apoio",
}


def _canon_setor(setor: str) -> str:
    s = str(setor).strip()
    k = _sem_acento(s).lower().strip()
    if k in _CANON_SETOR:
        return _CANON_SETOR[k]
    if k.startswith("corredor e ala inoperante"):
        return "Corredor e Ala Inoperante"
    return s


ROTULO_PRI = {
    "imediata": "Imediata", "alta": "Alta", "moderada": "Moderada",
    "baixa": "Baixa", "sem avaliacao": "Sem avaliação",
    "pendente de avaliacao": "Pendente de avaliação",
}


def painel_inspecoes(df: pd.DataFrame) -> dict:
    brutas = len(df)
    df = df.dropna(subset=["Data_Registro"]).copy()
    df["data"] = pd.to_datetime(df["Data_Registro"], errors="coerce", dayfirst=True)
    df = df.dropna(subset=["data"])
    invalidas = df["data"] < pd.Timestamp("2000-01-01")
    if invalidas.any():
        print(f"[inspecoes] AVISO: {int(invalidas.sum())} linha(s) com data anterior a 2000 "
              f"descartada(s): {df.loc[invalidas, 'data'].dt.strftime('%d/%m/%Y').tolist()}")
        df = df[~invalidas]
    print(f"[inspecoes] {brutas} -> {len(df)} ações")

    df["status_n"] = df["Status"].map(_norm).replace({"": "em andamento", "nan": "em andamento"})
    df["concluido"] = df["status_n"] == "concluido"
    df["prioridade"] = df["Prioridade GUT"].map(_norm).replace({"": "sem avaliacao", "nan": "sem avaliacao"})
    df["gut"] = pd.to_numeric(df["Pontuação GUT"], errors="coerce")
    df["setor_canon"] = df["Setor"].map(_canon_setor)
    df["andar"] = df["Setor"].map(_andar_do_setor)
    df["ano"] = df["data"].dt.year.astype(int)
    df["mes_ano"] = df["data"].dt.to_period("M")

    hoje = pd.Timestamp(date.today())

    def prazo_final(r):
        v = r["Prazo"]
        if isinstance(v, str) and v.strip():
            m = [int(x) for x in re.findall(r"\d+", v)]
            if m:
                return r["data"] + pd.Timedelta(days=m[0])
            return pd.NaT
        return pd.to_datetime(v, errors="coerce")

    df["prazo_dt"] = df.apply(prazo_final, axis=1)

    def situacao(r):
        if r["concluido"]:
            return "concluida"
        if pd.isna(r["prazo_dt"]):
            return "sem_prazo"
        if r["prazo_dt"] < hoje:
            return "atrasada"
        if r["prazo_dt"] <= hoje + pd.Timedelta(days=7):
            return "vence_7d"
        return "no_prazo"

    df["situacao"] = df.apply(situacao, axis=1)

    def bloco(sub: pd.DataFrame) -> dict:
        ab = sub[~sub["concluido"]]
        conc = sub[sub["concluido"]]

        g = sub.groupby(["mes_ano", "concluido"]).size().unstack(fill_value=0)
        g = g.reindex(columns=[False, True], fill_value=0)
        if len(g):
            idx = pd.period_range(g.index.min(), g.index.max(), freq="M")
            g = g.reindex(idx, fill_value=0)
        apont_mes = {
            "labels": [f"{str(p)[5:7]}/{str(p)[2:4]}" for p in g.index] if len(g) else [],
            "concluidos": [int(v) for v in g[True]] if len(g) and True in g else [],
            "andamento": [int(v) for v in g[False]] if len(g) and False in g else [],
        }

        atr = sub[sub["situacao"] == "atrasada"]
        atrasos_resp = [{"setor": s, "total": int(n)} for s, n in
                        atr["Setor Responsável"].fillna("Não informado").astype(str).str.strip()
                        .value_counts().items()]
        apontamentos_resp = [{"setor": s, "total": int(n)} for s, n in
                             sub["Setor Responsável"].fillna("Não informado").astype(str).str.strip()
                             .replace("", "Não informado").value_counts().items()]
        responsaveis = sub["Setor Responsável"].fillna("Não informado").astype(str).str.strip().replace("", "Não informado")
        conclusao_resp = []
        for setor, grupo in sub.groupby(responsaveis):
            total = len(grupo)
            concluidos = int(grupo["concluido"].sum())
            conclusao_resp.append({"setor": setor, "total": total,
                                   "concluidos": concluidos, "abertos": total - concluidos})

        abertos_setor = [{"setor": s, "total": int(n)} for s, n in
                         ab["setor_canon"].fillna("Não informado").value_counts().items()]

        abertos_andar = [{"andar": a, "total": int(n)} for a, n in
                         ab["andar"].value_counts().items()]

        prioridade = {ROTULO_PRI.get(k, k.title()): int(v) for k, v in ab["prioridade"].value_counts().items()}

        cat_fms = [{"categoria": c, "total": int(n)} for c, n in
                   ab["Categoria por Tópico do FMS"].fillna("Não informado").astype(str).str.strip()
                   .value_counts().items()]
        cat_fms_total = [{"categoria": c, "total": int(n)} for c, n in
                         sub["Categoria por Tópico do FMS"].fillna("Não informado").astype(str).str.strip()
                         .replace("", "Não informado").value_counts().items()]

        insp = sub.drop_duplicates(["data", "setor_canon"]).groupby("mes_ano").size()
        if len(insp):
            idx = pd.period_range(insp.index.min(), insp.index.max(), freq="M")
            insp = insp.reindex(idx, fill_value=0)
        insp_mes = {
            "labels": [f"{str(p)[5:7]}/{str(p)[2:4]}" for p in insp.index] if len(insp) else [],
            "valores": [int(v) for v in insp] if len(insp) else [],
        }

        alta = ab[ab["prioridade"].isin(["imediata", "alta"])].sort_values("data", ascending=False)
        tabela_alta = [
            {
                "data": r["data"].strftime("%d/%m/%Y"),
                "setor": str(r["setor_canon"]),
                "apontamento": str(r["Apontamento"])[:150],
                "responsavel": str(r["Setor Responsável"]),
                "prioridade": ROTULO_PRI.get(r["prioridade"], str(r["Prioridade GUT"])),
                "situacao": {"atrasada": "Atrasada", "sem_prazo": "Sem prazo",
                             "vence_7d": "Vence em 7 dias", "no_prazo": "No prazo"}.get(r["situacao"], ""),
                "gut": int(r["gut"]) if pd.notna(r["gut"]) else None,
            }
            for _, r in alta.head(40).iterrows()
        ]

        return {
            "total": int(len(sub)),
            "abertos": int(len(ab)),
            "concluidos": int(len(conc)),
            "pct_conclusao": round(len(conc) / len(sub) * 100, 1) if len(sub) else 0,
            "inspecoes": int(sub.groupby(["data", "setor_canon"]).ngroups) if len(sub) else 0,
            "apontamentos_mes": apont_mes,
            "status": {"Concluídos": int(len(conc)), "Em andamento": int(len(ab))},
            "atrasos_responsavel": atrasos_resp,
            "apontamentos_responsavel": apontamentos_resp,
            "conclusao_responsavel": conclusao_resp,
            "abertos_setor": abertos_setor,
            "abertos_andar": abertos_andar,
            "prioridade_aberto": prioridade,
            "categoria_fms_aberto": cat_fms,
            "categoria_fms": cat_fms_total,
            "inspecoes_mes": insp_mes,
            "situacao_prazo": {k: int(v) for k, v in sub["situacao"].value_counts().items()},
            "gut_medio": round(float(sub["gut"].mean()), 1) if sub["gut"].notna().any() else None,
            "prioridade_alta": tabela_alta,
        }

    anos = sorted(int(a) for a in df["ano"].unique())
    por_ano = {a: bloco(df[df["ano"] == a]) for a in anos}

    comparativo = [
        {
            "ano": a,
            "total": por_ano[a]["total"],
            "inspecoes": por_ano[a]["inspecoes"],
            "concluidos": por_ano[a]["concluidos"],
            "abertos": por_ano[a]["abertos"],
            "pct_conclusao": por_ano[a]["pct_conclusao"],
        }
        for a in anos
    ]

    return {
        "anos": anos,
        "total": bloco(df),
        "por_ano": por_ano,
        "comparativo": comparativo,
    }


def calcular(abas: dict) -> dict:
    """Gera o bloco 'inspecoes' completo (total + por ano)."""
    return painel_inspecoes(abas["Inspeção das Instalações"])

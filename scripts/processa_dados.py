#!/usr/bin/env python3
"""
Dashboard Integrado da Qualidade — HVC (Vinicius Analista Qualidade).

Lê data/planos_de_acao_qualidade.xlsx (9 abas de dados) e gera dashboard/data.js
com um bloco por painel:

  1. Inspeção das Instalações -> painel "inspecoes" (GUT, prioridade, setores, prazos)
  2. Rounds                    -> painel "rounds" (realizados x previstos, % por setor)
  3. Interações Rounds         -> painel "rounds" (categorias por mês/ano)
  4. Interações Round          -> painel "rounds" (detalhe por setor/quarto)
  5. Planos de ação Huddle     -> painel "huddle" (ações por área/categoria/status)
  6. Foloow Up Huddle          -> painel "huddle" (follow-up de problemas)
  7. Pacientes Watcher         -> painel "watcher" (ANONIMIZADO: sem prontuário/nome/nascimento)
  8. Planos de ação JCI        -> painel "jci" (conformidade por capítulo)
  9. Planos de Ação            -> painel "jci" (planos de comitês)

Regras gerais:
  - Linhas totalmente vazias ou de template são descartadas
  - Huddle/Follow-up: cabeçalho na linha 2 (linha 1 vazia)
  - Categorias com grafia dupla são normalizadas
  - Watcher: descarta Prontuário, N° Atendimento, Paciente, Nascimento;
    desfecho normalizado; tempo de permanência calculado
  - Rounds: meses futuros (Realizados=0 e Previstos=0) descartados;
    painel com filtro por ano (2023-2026) e interações por ano
"""
from __future__ import annotations

import json
import unicodedata
from datetime import date, datetime
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUT = ROOT / "dashboard" / "data.js"

FONTES = ["planos_de_acao_qualidade.xlsx", "planos_de_acao_qualidade.csv"]

MESES_PT = {
    "janeiro": 1, "fevereiro": 2, "março": 3, "marco": 3, "abril": 4,
    "maio": 5, "junho": 6, "julho": 7, "agosto": 8, "setembro": 9,
    "outubro": 10, "novembro": 11, "dezembro": 12,
}
MES_ORDEM = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
             "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]

# Abas que NÃO viram painel
ABAS_APOIO = {"Listas", "Dicionario_de_Campos", "Dashboard_Modelo"}


def _sem_acento(txt: str) -> str:
    return unicodedata.normalize("NFKD", txt).encode("ascii", "ignore").decode()


def _norm(txt) -> str:
    return _sem_acento(str(txt).strip().lower())


def _mes_num(v) -> int | None:
    """Aceita 'Janeiro', 1, '1' e devolve 1..12."""
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    if isinstance(v, (int, float)):
        n = int(v)
        return n if 1 <= n <= 12 else None
    s = _norm(v)
    return MESES_PT.get(s)


def ler_abas() -> dict[str, pd.DataFrame]:
    for nome in FONTES:
        caminho = DATA_DIR / nome
        if caminho.exists():
            if caminho.suffix == ".xlsx":
                todas = pd.read_excel(caminho, sheet_name=None, header=None)
            else:
                todas = pd.read_csv(caminho, header=None)
            abas: dict[str, pd.DataFrame] = {}
            for titulo, bruta in todas.items():
                if titulo in ABAS_APOIO:
                    print(f"[aba] {titulo} — apoio, ignorada")
                    continue
                # localiza a primeira linha com >=3 células preenchidas = cabeçalho
                inicio = 0
                for i, linha in bruta.iterrows():
                    if linha.notna().sum() >= 3:
                        inicio = i
                        break
                df = bruta.iloc[inicio + 1:].copy()
                # limpa cabeçalhos: espaços e apóstrofos/aspas sobrando ('Categoria')
                cols = [str(c).strip().strip("'\"").strip() for c in bruta.iloc[inicio]]
                df.columns = cols
                df = df.dropna(how="all").reset_index(drop=True)
                abas[titulo] = df
                print(f"[aba] {titulo} — {len(df)} linhas de dados")
            return abas
    raise SystemExit("Planilha não encontrada em data/planos_de_acao_qualidade.(xlsx|csv)")


# --------------------------------------------------------------------------- #
# 1. Inspeção das Instalações
# --------------------------------------------------------------------------- #
def painel_inspecoes(df: pd.DataFrame) -> dict:
    brutas = len(df)
    df = df.dropna(subset=["Data_Registro"]).copy()
    df["data"] = pd.to_datetime(df["Data_Registro"], errors="coerce", dayfirst=True)
    df = df.dropna(subset=["data"])
    print(f"[inspecoes] {brutas} -> {len(df)} ações")

    df["status"] = df["Status"].map(_norm).replace({"": "em andamento", "nan": "em andamento"})
    status_cnt = df["status"].value_counts().to_dict()

    hoje = pd.Timestamp(date.today())

    def prazo_final(r):
        v = r["Prazo"]
        if isinstance(v, str) and v.strip():
            m = [int(x) for x in __import__("re").findall(r"\d+", v)]
            if m:
                return r["data"] + pd.Timedelta(days=m[0])
            return pd.NaT
        return pd.to_datetime(v, errors="coerce")

    df["prazo_dt"] = df.apply(prazo_final, axis=1)

    def situacao(r):
        if _norm(r["status"]) == "concluido":
            return "concluida"
        if pd.isna(r["prazo_dt"]):
            return "sem_prazo"
        if r["prazo_dt"] < hoje:
            return "atrasada"
        if r["prazo_dt"] <= hoje + pd.Timedelta(days=7):
            return "vence_7d"
        return "no_prazo"

    df["situacao"] = df.apply(situacao, axis=1)
    situacao_cnt = df["situacao"].value_counts().to_dict()

    prior_cnt = df["Prioridade GUT"].map(_norm).replace({"": "sem avaliação", "nan": "sem avaliação"}).value_counts().to_dict()
    setor_resp = df["Setor Responsável"].fillna("Não informado").astype(str).str.strip().replace({"": "Não informado"}).value_counts().to_dict()
    setor_origem = df["Setor"].fillna("Não informado").astype(str).str.strip().value_counts().to_dict()
    categoria = df["Categoria por Tópico do FMS"].fillna("Não informado").astype(str).str.strip().value_counts().to_dict()

    por_mes = df.groupby(df["data"].dt.to_period("M")).size()
    evolucao = [{"mes": str(p), "total": int(n)} for p, n in por_mes.items()]

    alta = df[df["Prioridade GUT"].map(_norm).isin(["imediata", "alta"])]
    tabela_alta = [
        {
            "data": r["data"].strftime("%d/%m/%Y"),
            "setor": str(r["Setor"]),
            "apontamento": str(r["Apontamento"])[:160],
            "responsavel": str(r.get("Setor Responsável", "")),
            "prioridade": str(r["Prioridade GUT"]),
            "status": str(r["Status"] or "Em andamento"),
        }
        for _, r in alta.head(40).iterrows()
    ]

    return {
        "total": int(len(df)),
        "status": {k.title(): int(v) for k, v in status_cnt.items()},
        "situacao_prazo": {k: int(v) for k, v in situacao_prazo.items()},
        "prioridade": {k.title(): int(v) for k, v in prior_cnt.items()},
        "setor_responsavel": setor_resp,
        "setor_origem": setor_origem,
        "categoria": categoria,
        "evolucao": evolucao,
        "prioridade_alta": tabela_alta,
    }


# --------------------------------------------------------------------------- #
# 2/3/4. Rounds + Interações Rounds + Interações Round
# --------------------------------------------------------------------------- #
def painel_rounds(rounds: pd.DataFrame, detalhe: pd.DataFrame) -> dict:
    r = rounds.copy()
    r = r.dropna(subset=["Setores"])
    r["Ano"] = pd.to_numeric(r["Ano"], errors="coerce")
    r["Realizados"] = pd.to_numeric(r["Realizados"], errors="coerce").fillna(0)
    r["Previstos"] = pd.to_numeric(r["Previstos"], errors="coerce").fillna(0)
    r["Pendentes"] = pd.to_numeric(r["Pendentes"], errors="coerce").fillna(0)
    r["mes_n"] = r["Meses"].map(_mes_num)
    r = r.dropna(subset=["mes_n"])
    r["mes_n"] = r["mes_n"].astype(int)
    # descarta meses futuros / sem programação (Realizados=0 e Previstos=0)
    r = r[~((r["Realizados"] == 0) & (r["Previstos"] == 0))]
    r["Ano"] = r["Ano"].fillna(0).astype(int)
    anos = sorted(a for a in r["Ano"].unique() if a)
    print(f"[rounds] {len(rounds)} -> {len(r)} registros válidos, anos {anos}")

    # por ano: o gráfico "realizados x previstos por ano"
    por_ano = []
    for a in anos:
        ra = r[r["Ano"] == a]
        real, prev = int(ra["Realizados"].sum()), int(ra["Previstos"].sum())
        por_ano.append({"ano": int(a), "realizados": real, "previstos": prev,
                        "pendentes": int(ra["Pendentes"].sum()),
                        "pct": round(real / prev * 100, 1) if prev else 0})

    # evolução mensal, setores e responsáveis SEPARADOS POR ANO
    evolucao, setores, responsaveis = {}, {}, {}
    for a in anos:
        ra = r[r["Ano"] == a]
        pm = ra.groupby("mes_n")[["Realizados", "Previstos", "Pendentes"]].sum().reindex(range(1, 13), fill_value=0)
        evolucao[int(a)] = [
            {"mes": MES_ORDEM[m - 1], "realizados": int(pm.loc[m, "Realizados"]),
             "previstos": int(pm.loc[m, "Previstos"]), "pendentes": int(pm.loc[m, "Pendentes"])}
            for m in range(1, 13) if pm.loc[m, ["Realizados", "Previstos"]].sum() > 0
        ]
        ps = ra.groupby("Setores")[["Realizados", "Previstos"]].sum().sort_values("Realizados", ascending=False)
        setores[int(a)] = [
            {"setor": s, "realizados": int(row["Realizados"]), "previstos": int(row["Previstos"]),
             "pct": round(float(row["Realizados"] / row["Previstos"]) * 100, 1) if row["Previstos"] else 0}
            for s, row in ps.iterrows()
        ]
        pr = ra.groupby("Responsáveis")[["Realizados", "Previstos"]].sum().sort_values("Realizados", ascending=False)
        responsaveis[int(a)] = [
            {"responsavel": s, "realizados": int(row["Realizados"]), "previstos": int(row["Previstos"]),
             "pct": round(float(row["Realizados"] / row["Previstos"]) * 100, 1) if row["Previstos"] else 0}
            for s, row in pr.iterrows()
        ]

    # Interações Round (detalhe, COM ano) — substitui a aba agregada sem ano
    d = detalhe.copy()
    d["Ano"] = pd.to_numeric(d["Ano"], errors="coerce")
    d = d.dropna(subset=["Ano"])
    d["Ano"] = d["Ano"].astype(int)
    d["Categoria"] = d["Categoria"].astype(str).str.strip().str.title()
    d["Setor"] = d["Setor"].astype(str).str.strip()
    d["mes_n"] = d["Mês"].map(_mes_num)
    d = d.dropna(subset=["mes_n"])
    d["mes_n"] = d["mes_n"].astype(int)
    print(f"[rounds] interações: {len(detalhe)} -> {len(d)} com ano válido ({sorted(d['Ano'].unique())})")

    interacoes = {"anos": sorted(int(a) for a in d["Ano"].unique()), "por_ano": {}}
    for a in interacoes["anos"]:
        da = d[d["Ano"] == a]
        cats = [{"categoria": c, "total": int(n)} for c, n in da["Categoria"].value_counts().items()]
        meses = [{"mes": MES_ORDEM[m - 1], "total": int(n)} for m, n in da.groupby("mes_n").size().items()]
        sets_ = [{"setor": s, "total": int(n)} for s, n in da["Setor"].value_counts().items()]
        top_cats = [c["categoria"] for c in cats[:5]]
        sub = (da[da["Categoria"].isin(top_cats)]
               .groupby(["mes_n", "Categoria"]).size().unstack(fill_value=0)
               .reindex(range(1, 13), fill_value=0))
        presentes = [m for m in range(1, 13) if sub.loc[m].sum() > 0]
        interacoes["por_ano"][a] = {
            "total": int(len(da)),
            "categorias": cats,
            "meses": meses,
            "setores": sets_,
            "mes_categoria": {
                "meses": [MES_ORDEM[m - 1] for m in presentes],
                "series": [{"categoria": c, "valores": [int(sub.loc[m, c]) for m in presentes]} for c in top_cats],
            },
        }

    return {
        "total_registros": int(len(r)),
        "total_interacoes": int(len(d)),
        "anos": [int(a) for a in anos],
        "por_ano": por_ano,
        "evolucao": evolucao,
        "setores": setores,
        "responsaveis": responsaveis,
        "interacoes": interacoes,
    }


# --------------------------------------------------------------------------- #
# 5/6. Huddle: Planos de ação + Follow Up
# --------------------------------------------------------------------------- #
def painel_huddle(planos: pd.DataFrame, follow: pd.DataFrame) -> dict:
    p = planos.copy()
    p = p.dropna(subset=["Data_Registro"])
    p["data"] = pd.to_datetime(p["Data_Registro"], errors="coerce", dayfirst=True)
    p = p.dropna(subset=["data"])
    p["status"] = p["Status"].fillna("Em andamento").astype(str).str.strip()
    p["Area"] = p["Unidade"].fillna("Não informado").astype(str).str.strip()
    p["Categoria"] = p["Categoria"].fillna("Não informado").astype(str).str.strip()
    p["Ano"] = p["Ano"].fillna(p["data"].dt.year).astype(int)
    print(f"[huddle] {len(planos)} -> {len(p)} planos de ação")

    status_cnt = p["status"].value_counts().to_dict()
    area_cnt = p["Area"].value_counts().to_dict()
    cat_cnt = p["Categoria"].value_counts().head(12).to_dict()

    por_ano = p.groupby("Ano").size()
    por_ano_st = p.groupby(["Ano", "status"]).size().unstack(fill_value=0)
    evolucao = [
        {"ano": int(a),
         "total": int(por_ano.get(a, 0)),
         "concluido": int(por_ano_st.loc[a].get("Concluído", 0) if a in por_ano_st.index else 0)}
        for a in sorted(por_ano.index)
    ]

    f = follow.copy()
    f = f.dropna(subset=["Data Ocorrência"])
    f["data"] = pd.to_datetime(f["Data Ocorrência"], errors="coerce", dayfirst=True)
    f = f.dropna(subset=["data"])
    f["status"] = f["Status"].fillna("Em andamento").astype(str).str.strip()
    f["Area"] = f["Área"].fillna("Não informado").astype(str).str.strip()
    f["Categoria"] = f["Categoria"].fillna("Não informado").astype(str).str.strip()
    f["Ano"] = f["Ano"].fillna(f["data"].dt.year).astype(int)
    print(f"[huddle] follow-up: {len(follow)} -> {len(f)} registros")

    f_status = f["status"].value_counts().to_dict()
    f_area = f["Area"].value_counts().head(15).to_dict()
    f_cat = f["Categoria"].value_counts().head(12).to_dict()
    f_ano = f.groupby("Ano").size()

    return {
        "planos_total": int(len(p)),
        "planos_status": status_cnt,
        "planos_area": area_cnt,
        "planos_categoria": cat_cnt,
        "planos_evolucao": evolucao,
        "follow_total": int(len(f)),
        "follow_status": f_status,
        "follow_area": f_area,
        "follow_categoria": f_cat,
        "follow_evolucao": [{"ano": int(a), "total": int(n)} for a, n in f_ano.items()],
    }


# --------------------------------------------------------------------------- #
# 7. Pacientes Watcher (ANONIMIZADO)
# --------------------------------------------------------------------------- #
def painel_watcher(df: pd.DataFrame) -> dict:
    brutas = len(df)
    # ANONIMIZAÇÃO: remove identificadores diretos e quase-identificadores
    # (quarto/leito quase identifica o paciente; Responsável tem nomes próprios da equipe)
    w = df.drop(columns=["Prontuário", "N° Atendimento", "Paciente", "Nascimento",
                         "Setor inicial", "Setor final", "Histórico de setores",
                         "Responsável", "Observações de qualidade"],
                errors="ignore").copy()
    w = w.dropna(subset=["Data de entrada"])
    w["entrada"] = pd.to_datetime(w["Data de entrada"], errors="coerce", dayfirst=True)
    w = w.dropna(subset=["entrada"])
    print(f"[watcher] {brutas} -> {len(w)} pacientes (anonimizados)")

    def limpa(v):
        s = str(v).strip().replace("\xa0", "")
        return s if s and s.lower() != "nan" else "Não informado"

    w["desfecho"] = w["Desfecho final"].map(limpa).map(
        lambda s: "Óbito" if s.lower() == "óbito" + "") else s)
    # motivo: minúsculas pra juntar grafias ('Risco de deterioração' = 'Risco de Deterioração')
    w["motivo"] = w["Motivo"].map(limpa).map(
        lambda s: s.lower() if s != "Não informado" else s)
    w["evolucao"] = w["Última evolução"].map(limpa).map(
        lambda s: s if s in ("Estável", "Crítico", "Paliativo") else "Não informado")
    w["Ano"] = w["Ano"].fillna(w["entrada"].dt.year).astype(int)

    alta_dt = pd.to_datetime(w["Data Alta/óbito"], errors="coerce", dayfirst=True)
    w["permanencia_dias"] = (alta_dt - w["entrada"]).dt.days
    perm = w["permanencia_dias"].dropna()
    perm = perm[(perm >= 0) & (perm <= 365)]

    desfecho_cnt = w["desfecho"].value_counts().to_dict()
    motivo_cnt = {k.capitalize(): int(v) for k, v in
                  w["motivo"].value_counts().head(12).items()}
    evolucao_cnt = w["evolucao"].value_counts().to_dict()
    ano_cnt = w.groupby("Ano").size()

    def faixa(d):
        if d <= 1: return "Até 1 dia"
        if d <= 3: return "2-3 dias"
        if d <= 7: return "4-7 dias"
        if d <= 14: return "8-14 dias"
        if d <= 30: return "15-30 dias"
        return "Mais de 30 dias"

    faixas = perm.map(faixa).value_counts().reindex(
        ["Até 1 dia", "2-3 dias", "4-7 dias", "8-14 dias", "15-30 dias", "Mais de 30 dias"],
        fill_value=0)

    return {
        "total": int(len(w)),
        "desfechos": desfecho_cnt,
        "motivos": motivo_cnt,
        "evolucao_clinica": evolucao_cnt,
        "evolucao": [{"ano": int(a), "total": int(n)} for a, n in ano_cnt.items()],
        "permanencia_faixas": {k: int(v) for k, v in faixas.items()},
        "permanencia_media": round(float(perm.mean()), 1) if len(perm) else None,
        "anonimizado": True,
    }


# --------------------------------------------------------------------------- #
# 8/9. JCI + Comitês
# --------------------------------------------------------------------------- #
def painel_jci(jci: pd.DataFrame, comites: pd.DataFrame) -> dict:
    j = jci.copy()
    j = j.dropna(subset=["Capítulo"])
    j["Capítulo"] = j["Capítulo"].astype(str).str.strip()

    def classif(v):
        s = _norm(v)
        if "nao conforme" in s: return "Não Conforme"
        if s.startswith("conforme"): return "Conforme"
        if "aplica" in s: return "Não se aplica"
        return "Não avaliado"

    j["classe"] = j["Classificação (C - N)"].map(classif)
    print(f"[jci] {len(jci)} -> {len(j)} elementos avaliados")

    por_cap = j.groupby(["Capítulo", "classe"]).size().unstack(fill_value=0)
    capitulos = []
    for cap in por_cap.index:
        row = por_cap.loc[cap]
        total = int(row.sum())
        nc = int(row.get("Não Conforme", 0))
        conf = int(row.get("Conforme", 0))
        aval = conf + nc
        capitulos.append({
            "capitulo": cap, "total": total, "conforme": conf,
            "nao_conforme": nc, "na": int(row.get("Não se aplica", 0)),
            "pct_conformidade": round(conf / aval * 100, 1) if aval else 0,
        })
    capitulos.sort(key=lambda x: x["nao_conforme"], reverse=True)

    classe_cnt = j["classe"].value_counts().to_dict()

    c = comites.copy()
    c = c.dropna(subset=["ID_Plano"])
    c["status"] = c["Status"].fillna("Em Andamento").astype(str).str.strip()
    c["comite"] = c["Comite_Origem"].fillna("Não informado").astype(str).str.strip()
    c["data"] = pd.to_datetime(c["Data_Reuniao"], errors="coerce", dayfirst=True)
    print(f"[comites] {len(c)} planos de comitê")

    comites_lista = [
        {
            "id": str(r["ID_Plano"]),
            "comite": str(r["comite"]),
            "data": r["data"].strftime("%d/%m/%Y") if pd.notna(r["data"]) else "",
            "plano": str(r["Plano_de_Acao"])[:200],
            "responsaveis": str(r["Responsaveis"]),
            "prazo": str(r["Prazo_Informado"]),
            "status": str(r["status"]),
            "historico": str(r["Historico"]) if pd.notna(r["Historico"]) else "",
        }
        for _, r in c.iterrows()
    ]
    comites_status = c["status"].value_counts().to_dict()
    comites_origem = c["comite"].value_counts().to_dict()

    return {
        "total_elementos": int(len(j)),
        "classes": classe_cnt,
        "capitulos": capitulos,
        "comites_total": int(len(c)),
        "comites_status": comites_status,
        "comites_origem": comites_origem,
        "comites_lista": comites_lista,
    }


# --------------------------------------------------------------------------- #
def main():
    abas = ler_abas()

    dados = {
        "gerado_em": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "inspecoes": painel_inspecoes(abas["Inspeção das Instalações"]),
        "rounds": painel_rounds(abas["Rounds"], abas["Interações Round"]),
        "huddle": painel_huddle(abas["Planos de ação Huddle"], abas["Foloow Up Huddle"]),
        "watcher": painel_watcher(abas["Pacientes Watcher"]),
        "jci": painel_jci(abas["Planos de ação JCI"], abas["Planos de Ação "]),
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUT.with_suffix(".js.tmp")
    tmp.write_text("const DADOS = " + json.dumps(dados, ensure_ascii=False) + ";\n",
                   encoding="utf-8")
    tmp.rename(OUT)
    print(f"[ok] {OUT} ({OUT.stat().st_size / 1024:.0f} KB)")

    print("\n=== RESUMO ===")
    i, r, h, w, j = dados["inspecoes"], dados["rounds"], dados["huddle"], dados["watcher"], dados["jci"]
    print(f"Inspeções: {i['total']} ações | situacao: {i['situacao_prazo']}")
    print(f"Rounds: {r['total_registros']} registros, {len(r['setores'])} setores | interações: {r['total_interacoes']}")
    print(f"Huddle: {h['planos_total']} planos + {h['follow_total']} follow-ups")
    print(f"Watcher: {w['total']} pacientes (anonimizado) | desfechos: {w['desfechos']}")
    print(f"JCI: {j['total_elementos']} elementos, {len(j['capitulos'])} capítulos | comitês: {j['comites_total']} planos")


if __name__ == "__main__":
    main()

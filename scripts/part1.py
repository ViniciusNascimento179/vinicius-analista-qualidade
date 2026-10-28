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
  - Inspeções: aceita planilha AVULSA em data/ (nome com 'inspec'),
    que substitui a aba da planilha principal
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

ABA_INSPECOES = "Inspeção das Instalações"

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


def _ler_tabela(caminho: Path) -> dict[str, pd.DataFrame]:
    """Lê um xlsx/csv e devolve {aba: DataFrame} com o cabeçalho já detectado."""
    if caminho.suffix == ".xlsx":
        todas = pd.read_excel(caminho, sheet_name=None, header=None)
    else:
        todas = {caminho.stem: pd.read_csv(caminho, header=None)}
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


def _achar_planilha_inspecoes() -> Path | None:
    """Procura em data/ uma planilha avulsa de inspeções (nome contém 'inspec').

    Aceita qualquer nome: 'inspecoes.xlsx', 'Inspeções das Instalações.xlsx',
    'planilha_inspecoes.xlsx'... Ignora a planilha principal.
    """
    principal = {f.lower() for f in FONTES}
    candidatos = [
        p for p in sorted(DATA_DIR.glob("*"))
        if p.is_file()
        and p.suffix.lower() in (".xlsx", ".xlsm", ".csv")
        and "inspec" in _sem_acento(p.stem).lower()
        and p.name.lower() not in principal
        and not p.name.startswith("~$")
    ]
    return candidatos[0] if candidatos else None


def ler_abas() -> dict[str, pd.DataFrame]:
    for nome in FONTES:
        caminho = DATA_DIR / nome
        if caminho.exists():
            abas = _ler_tabela(caminho)
            # planilha avulsa de inspeções tem prioridade, se existir
            avulsa = _achar_planilha_inspecoes()
            if avulsa:
                lidas = _ler_tabela(avulsa)
                if lidas:
                    # prefere a aba cujo nome fala de inspeção; senão, a primeira
                    escolhida = next(
                        (t for t in lidas if "inspec" in _sem_acento(t).lower()),
                        list(lidas)[0])
                    abas[ABA_INSPECOES] = lidas[escolhida]
                    print(f"[inspecoes] planilha avulsa {avulsa.name} (aba '{escolhida}', "
                          f"{len(lidas[escolhida])} linhas) substitui a aba da planilha principal")
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
        "situacao_prazo": {k: int(v) for k, v in situacao_cnt.items()},
        "prioridade": {k.title(): int(v) for k, v in prior_cnt.items()},
        "setor_responsavel": setor_resp,
        "setor_origem": setor_origem,
        "categoria": categoria,
        "evolucao": evolucao,
        "prioridade_alta": tabela_alta,
    }

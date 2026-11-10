"""Importa somente contagens da ouvidoria. O arquivo original permanece local."""
from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import Counter
from datetime import date, datetime
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
SEM = "Não informado"


def texto(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def chave(value):
    return "".join(c for c in unicodedata.normalize("NFD", texto(value).casefold())
                   if unicodedata.category(c) != "Mn")


def data(value):
    if isinstance(value, (date, datetime)):
        return value
    for formato in ("%d/%m/%Y", "%Y-%m-%d", "%d/%m/%Y %H:%M:%S"):
        try:
            return datetime.strptime(texto(value), formato)
        except ValueError:
            pass
    return None


def agregar(rows, setores, motivos, tipos, status):
    """Cada linha preenchida é um registro; números de BO repetidos não são eliminados."""
    catalogos = [{chave(v): texto(v) for v in vs if texto(v)}
                 for vs in (setores, motivos, tipos, status)]
    cat_setor, cat_motivo, cat_tipo, cat_status = catalogos
    grupos = Counter()
    qualidade = Counter()
    periodos = []
    protocolos = Counter()
    setores_observados = set()
    for row in rows:
        # Não usar BO, paciente, fórmulas ou campos de responsáveis como prova de ocorrência.
        if not any(texto(row.get(k)) for k in ("Data Abertura", "Status", "Tipo", "Setor", "Motivo Padronizado", "Descrição Livre (vai ao gestor)")):
            if texto(row.get("Nº BO")):
                qualidade["linhas_modelo_ignoradas"] += 1
            continue
        abertura = data(row.get("Data Abertura"))
        ano = str(abertura.year) if abertura else "Sem data"
        mes = abertura.strftime("%Y-%m") if abertura else "Sem data"
        if abertura:
            periodos.append(abertura.isoformat()[:10])
        else:
            qualidade["sem_data_valida"] += 1
        setor_bruto = texto(row.get("Setor"))
        setor = cat_setor.get(chave(setor_bruto), setor_bruto or SEM)
        # Grafias iguais, com diferenças somente de caixa/espaço/acento, compartilham rótulo.
        if setor_bruto:
            cat_setor.setdefault(chave(setor_bruto), setor)
        setores_observados.add(setor)
        motivo_bruto = texto(row.get("Motivo Padronizado"))
        motivo = cat_motivo.get(chave(motivo_bruto), "Motivo não padronizado" if motivo_bruto else SEM)
        tipo_bruto = texto(row.get("Tipo"))
        tipo = cat_tipo.get(chave(tipo_bruto), "Tipo não padronizado" if tipo_bruto else SEM)
        status_bruto = texto(row.get("Status"))
        situacao = cat_status.get(chave(status_bruto), "Status não padronizado" if status_bruto else SEM)
        for campo, valor in (("setor", setor), ("motivo", motivo), ("tipo", tipo), ("status", situacao)):
            if valor == SEM:
                qualidade[f"sem_{campo}"] += 1
            elif "não padronizado" in valor:
                qualidade[f"{campo}_nao_padronizado"] += 1
        protocolo = texto(row.get("Nº BO"))
        if protocolo:
            protocolos[protocolo] += 1
        grupos[(ano, mes, setor, tipo, situacao, motivo)] += 1
    qualidade["numeros_bo_repetidos"] = sum(n > 1 for n in protocolos.values())
    return {
        "versao": 1,
        "total": sum(grupos.values()),
        "inicio": min(periodos) if periodos else None,
        "fim": max(periodos) if periodos else None,
        "anos": sorted({g[0] for g in grupos}),
        "setores": sorted(set(cat_setor.values()) | setores_observados, key=chave),
        "tipos": list(dict.fromkeys(cat_tipo.values())),
        "status": list(dict.fromkeys(cat_status.values())),
        "qualidade": dict(sorted(qualidade.items())),
        "grupos": [dict(zip(("ano", "mes", "setor", "tipo", "status", "motivo", "n"), (*k, n)))
                   for k, n in sorted(grupos.items())],
    }


def importar(caminho):
    book = openpyxl.load_workbook(caminho, read_only=True, data_only=True)
    try:
        listas = list(book["Listas"].values)
        headers = [texto(v) for v in listas[0]]
        def coluna(nome):
            i = headers.index(nome)
            return [r[i] for r in listas[1:] if r[i] is not None]
        setores = coluna("Setor Padronizado")
        motivos = coluna("Motivo Padronizado")
        tipos = coluna("TIPO")
        status = coluna("STATUS")
        registros, abas = [], []
        for sheet in book:
            if not chave(sheet.title).startswith("registro"):
                continue
            it = sheet.iter_rows(values_only=True)
            header = None
            for _ in range(10):
                row = next(it, ())
                names = [texto(v) for v in row]
                if "Data Abertura" in names and "Motivo Padronizado" in names:
                    header = names
                    break
            if header is None:
                raise ValueError(f"Cabeçalho da aba {sheet.title} não encontrado.")
            for nome in ("Nº BO", "Status", "Tipo", "Setor", "Data Abertura", "Motivo Padronizado"):
                if nome not in header:
                    raise ValueError(f"Coluna obrigatória ausente: {nome}")
            registros.extend(dict(zip(header, row)) for row in it)
            abas.append(sheet.title)
        if not abas:
            raise ValueError("Nenhuma aba de registros encontrada.")
        result = agregar(registros, setores, motivos, tipos, status)
        if not result["total"]:
            raise ValueError("A fonte não contém registros. A base anterior foi preservada.")
        result["fonte"] = Path(caminho).name
        result["abas"] = abas
        return result
    finally:
        book.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fonte", type=Path, required=True)
    parser.add_argument("--saida", type=Path, default=ROOT / "dashboard" / "ouvidoria-dados.js")
    args = parser.parse_args()
    result = importar(args.fonte)
    payload = "window.OuvidoriaDados = " + json.dumps(result, ensure_ascii=False, separators=(",", ":")) + ";\n"
    args.saida.parent.mkdir(parents=True, exist_ok=True)
    args.saida.write_text(payload, encoding="utf-8")
    print(json.dumps({k: result[k] for k in ("total", "anos", "inicio", "fim", "qualidade")}, ensure_ascii=False))


if __name__ == "__main__":
    main()

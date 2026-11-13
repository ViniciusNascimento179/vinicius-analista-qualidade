"""Importação conferida do relatório CBA de outubro/2026 do Hospital Vera Cruz.

O PDF original permanece fora do repositório. Este importador é específico para
esta edição do relatório: rejeita outra fonte para não reaplicar correções por
número de página em documentos diferentes. Dependência local: pdfplumber.
"""
import argparse
from collections import Counter
from hashlib import sha256
import json
from pathlib import Path
import re

SHA256_FONTE = "5586188d702ca256767930b9d64e126d3941233936a943aa9376abb3e488e2dc"
RESUMO = {
    "APR": [14,1,0], "ACC": [68,12,1], "AOP": [115,13,5], "ASC": [52,2,0],
    "COP": [82,4,31], "IPSG": [25,4,0], "MMU": [81,9,6], "PCC": [41,12,0],
    "FMS": [63,22,4], "GLD": [64,20,5], "HCT": [20,5,7], "MOI": [37,8,0],
    "PCI": [72,13,6], "QPS": [26,16,0], "SQE": [94,23,4], "GHI": [5,17,0],
}


def extrair_paginas(fonte):
    import pdfplumber
    pages=[]
    with pdfplumber.open(fonte) as pdf:
        for n,p in enumerate(pdf.pages[2:166],3):
            events=[]
            pos=35
            for table in p.find_tables():
                if table.bbox[1]>pos:
                    text=p.crop((30,pos,565,table.bbox[1])).extract_text() or ''
                    if text.strip(): events.append({'kind':'text','text':text})
                events.append({'kind':'table','rows':table.extract(),'bbox':table.bbox})
                pos=table.bbox[3]
            if pos<800:
                text=p.crop((30,pos,565,800)).extract_text() or ''
                if text.strip(): events.append({'kind':'text','text':text})
            pages.append({'page':n,'events':events})
            if n%25==0: print('Página',n,flush=True)
    return pages


def interpretar(pages):
    chapters=[]; standards=[]; elements=[]; odd=[]
    chapter=None; standard=None; mode=None
    chapter_ids=iter('APR ACC AOP ASC COP IPSG MMU PCC FMS GLD HCT MOI PCI QPS SQE GHI'.split())
    clean=lambda s:re.sub(r'\s+',' ',s or '').strip()
    for p in pages:
        for ev in p['events']:
            if ev['kind']=='text':
                t=re.sub(r'^HOSPITAL VERA CRUZ[^\n]*\n?', '', ev['text'].strip())
                # Divisórias dos capítulos, na ordem conferida no relatório.
                if len(p['events'])==1 and 'Capítulo:' in t and 'Padrão' not in t:
                    chapter={'id':next(chapter_ids),'nome':clean(re.sub(r'^.*?Capítulo\s*:\s*','',t,flags=re.S)),'pagina':p['page']}
                    chapters.append(chapter);mode=None;standard=None;continue
                t=re.sub(r'^Capítulo\s*:[^\n]*\n?','',t)
                parts=re.split(r'(Padrão\s*:\s*\d{2}\.\d{2}\s*-|Recomendação)',t)
                for part in parts:
                    part=part.strip()
                    if not part:continue
                    m=re.match(r'Padrão\s*:\s*(\d{2}\.\d{2})\s*-',part)
                    if m:
                        standard={'id':chapter['id']+'.'+m[1],'capitulo':chapter['id'],'texto':'','recomendacao':'','paginas':[p['page']]}
                        standards.append(standard);mode='texto'
                    elif part=='Recomendação': mode='recomendacao'
                    elif standard and mode:
                        standard[mode]=clean(standard[mode]+' '+part)
                        if p['page'] not in standard['paginas']:standard['paginas'].append(p['page'])
                    elif p['page']==58 and part=='Nenhum comentário.' and elements[-1]['id']=='COP.10.03.EM1':
                        elements[-1]['achado']=part
                    else:odd.append({'page':p['page'],'text':part})
            else:
                rows=ev['rows']
                first=rows[0] if rows else []
                if len(first)>=2 and re.match(r'^\d+\s*-',first[0] or '') and clean(first[1]) in ('C','NC','NA','PC'):
                    num,txt=re.split(r'\s*-\s*',first[0],maxsplit=1)
                    achado=clean(' '.join(row[0] or '' for row in rows[1:]))
                    if p['page']==58:
                        # These three tables have spurious horizontal rules in the PDF.
                        # Verified visually against the complete original page.
                        rest=[r[0] or '' for r in rows[1:]]
                        txt=clean(txt+' '+' '.join(s for s in rest if s!='Nenhum comentário.'))
                        achado='Nenhum comentário.' if 'Nenhum comentário.' in rest else ''
                    elements.append({'id':standard['id']+'.EM'+num,'capitulo':chapter['id'],'padrao':standard['id'],'numero':int(num),'texto':clean(txt),'classificacao':clean(first[1]),'achado':achado,'paginas':[p['page']]})
                    mode=None
                elif p['page']==58 and first[0]=='Nenhuma recomendação.':
                    standard['recomendacao']='Nenhuma recomendação.'
                else:odd.append({'page':p['page'],'rows':rows})
    

    if odd:
        raise ValueError(f"Trechos não associados: {odd}")
    return {"capitulos": chapters, "padroes": standards, "elementos": elements}


def validar(dados):
    elementos=dados["elementos"]
    if len(elementos)!=1110 or len({e["id"] for e in elementos})!=1110:
        raise ValueError("Quantidade de elementos ou unicidade divergente.")
    if len(dados["padroes"])!=248 or len(dados["capitulos"])!=16:
        raise ValueError("Quantidade de padrões/capítulos divergente.")
    for cap,esperado in RESUMO.items():
        contagem=Counter(e["classificacao"] for e in elementos if e["capitulo"]==cap)
        if [contagem[k] for k in ("C","NC","NA")]!=esperado:
            raise ValueError(f"Divergência com a tabela da página 167 em {cap}: {contagem}")
    pcs=[e for e in elementos if e["classificacao"]=="PC"]
    if len(pcs)!=1 or pcs[0]["id"]!="GLD.02.00.EM2":
        raise ValueError("Classificação PC diferente da conferida na página 100.")
    for p in dados["padroes"]:
        numeros=[e["numero"] for e in elementos if e["padrao"]==p["id"]]
        if numeros!=list(range(1,len(numeros)+1)) or not p["texto"]:
            raise ValueError(f"Sequência ou texto incompleto: {p['id']}")
    # Apenas estes campos estão vazios na fonte. Não inferir conteúdo.
    if {e["id"] for e in elementos if not e["achado"]}!={"FMS.05.00.EM1","FMS.08.00.EM1","FMS.09.00.EM1","PCI.04.00.EM1"}:
        raise ValueError("Comentários vazios diferentes dos campos conferidos.")
    if {p["id"] for p in dados["padroes"] if not p["recomendacao"]}!={"QPS.03.02"}:
        raise ValueError("Recomendações vazias diferentes da fonte conferida.")


def preparar(dados,fonte):
    validar(dados)
    for e in dados["elementos"]:
        e["classificacaoOriginal"]=e["classificacao"]
        if e["classificacao"]=="PC":
            e["classificacao"]="NC"
            e["ajusteClassificacao"]="Correção informada pelo solicitante em 13/11/2026: o registro PC está incorreto no relatório e deve ser considerado Não conforme."
    return {"versao":1,"avaliacoes":[{
        "id":"cba-2026-10","ano":2026,"nome":"CBA · Outubro/2026",
        "inicio":"2026-10-27","fim":"2026-10-30",
        "fonte":fonte.name,"sha256":SHA256_FONTE,
        "resumoOriginalPagina167":RESUMO,
        "totaisOriginais":{"C":859,"NC":181,"NA":69,"PC":1},
        "totaisCorrigidos":{"C":859,"NC":182,"NA":69},
        **dados
    }]}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fonte",type=Path,required=True)
    parser.add_argument("--cache",type=Path,help="Cache local de extração; não publicar.")
    parser.add_argument("--saida",type=Path,default=Path(__file__).resolve().parents[1]/"dashboard"/"jci-dados.js")
    args=parser.parse_args()
    digest=sha256(args.fonte.read_bytes()).hexdigest()
    if digest!=SHA256_FONTE:
        raise ValueError("Fonte diferente do relatório conferido. Revisar o importador antes de importar outra avaliação.")
    if args.cache and args.cache.exists():
        cache=json.loads(args.cache.read_text(encoding="utf-8"))
        if cache.get("sha256")!=digest:
            raise ValueError("Cache não corresponde à fonte.")
        paginas=cache["paginas"]
    else:
        paginas=extrair_paginas(args.fonte)
        if args.cache:
            args.cache.parent.mkdir(parents=True,exist_ok=True)
            args.cache.write_text(json.dumps({"sha256":digest,"paginas":paginas},ensure_ascii=False),encoding="utf-8")
    base=preparar(interpretar(paginas),args.fonte)
    args.saida.parent.mkdir(parents=True,exist_ok=True)
    texto=json.dumps(base,ensure_ascii=False,indent=2).replace("<","\\u003c")
    args.saida.write_text("window.JciDados = "+texto+";\n",encoding="utf-8")
    print("CBA: 1.110 elementos, 248 padrões, 16 capítulos. 859 C, 182 NC e 69 NA; ajuste PC para NC documentado.")


if __name__=="__main__":
    main()

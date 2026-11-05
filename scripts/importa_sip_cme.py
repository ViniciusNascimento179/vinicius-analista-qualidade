"""Importa a auditoria CME sem publicar nomes, emails ou o arquivo original."""
import json
import re
import sys
from pathlib import Path

import openpyxl


def importar(origem):
    sheet = openpyxl.load_workbook(origem, data_only=True).active
    headers = [str(c.value or '').strip() for c in sheet[1]]
    required = ['ID', 'Data da Auditoria', 'Pass-Trough está fechado corretamente ?',
                'Articulados Abertos?', 'Portas Abertas?', 'Pressões Funcionantes',
                'Oque foi feito.', 'Observação']
    for name in required:
        if name not in headers:
            raise ValueError(f'Coluna ausente: {name}')
    records = []
    for row in sheet.iter_rows(min_row=2, values_only=True):
        if not any(v is not None for v in row):
            continue
        values = dict(zip(headers, row))
        date = values['Data da Auditoria']
        if not hasattr(date, 'strftime'):
            raise ValueError(f'Data inválida na auditoria {values["ID"]}')
        record = {'id': values['ID'], 'data': date.strftime('%Y-%m-%d')}
        for key, header in [('passThrough', required[2]), ('articulados', required[3]),
                            ('portasAbertas', required[4]), ('pressoes', required[5])]:
            value = values[header]
            if value not in (None, 'Sim', 'Não', 'Não Auditado'):
                raise ValueError(f'Resposta desconhecida em {header}: {value}')
            record[key] = value
        record['acao'] = values['Oque foi feito.'] or None
        note = str(values['Observação'] or '').strip()
        record['observacao'] = re.sub(r'\s*\b\d{3}-\d{2}-\d{4}\b', '', note) or None
        records.append(record)
    if len({r['id'] for r in records}) != len(records):
        raise ValueError('IDs de auditoria duplicados')
    records.sort(key=lambda r: (r['data'], r['id']))
    return {'fonte': Path(origem).name, 'registros': records}


if __name__ == '__main__':
    dados = importar(sys.argv[1])
    destino = Path(__file__).resolve().parents[1] / 'dashboard' / 'sip-cme-dados.js'
    conteudo = '/* Dados por data da auditoria. Não contém identificação de auditores. */\n'
    conteudo += '(function(root) {\n  const dados = ' + json.dumps(dados, ensure_ascii=False, indent=2) + ';\n'
    conteudo += "  if (typeof module === 'object' && module.exports) module.exports = dados;\n  else root.SipCmeDados = dados;\n})(typeof globalThis !== 'undefined' ? globalThis : this);\n"
    destino.write_text(conteudo, encoding='utf-8')
    print(f'{len(dados["registros"])} auditorias importadas por data da auditoria.')

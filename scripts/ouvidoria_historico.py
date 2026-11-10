"""Leitura do formato histórico e correspondências explícitas, sem publicar textos livres."""
import re
from collections import defaultdict
from datetime import date, datetime
import unicodedata


def texto(v):
    return re.sub(r'\s+', ' ', str(v if v is not None else '')).strip()


def chave(v):
    s = unicodedata.normalize('NFD', texto(v).casefold())
    return re.sub(r'[^a-z0-9]', '', ''.join(c for c in s if unicodedata.category(c) != 'Mn'))


# Apenas equivalências explícitas. Não usar aproximação por palavra ou inferir especialidade.
SETORES = {
    'Radiologia — Exames / Imagem': ['Imagem'],
    'Central de Agendamento': ['Central de atendimento', 'Call Center', 'Central de Atendimento ( Call center )'],
    'Gerenciamento de Fluxo de Pacientes': ['Gerenciamento de Fluxo de Paciente (GL)', 'Gerenciamento de Fluxos de Paciente'],
    'Gerenciamento de Leito': ['Gerenciamento de Leitos', 'Gerencialmento de Leito'],
    'Estacionamento (Estapar)': ['Serviços Estacionamento', 'Serviços de Estacionamento', 'Estapar'],
    'Oftalmologia': ['Novos Ativos Oftalmologia', 'Novos ativos oftalmo'],
    'Neurologia': ['Novos Ativos Neurologia', 'Novos ativos neuro'],
    'CMSC — Geral': ['Novos Ativos São Camilo'],
    'Enfermagem Alas de Internação': ['Enf Alas de Internação', 'Enf Alas', 'Enfermagem Alas Internação', 'Enf. Alas internação'],
    'Enfermagem PS HVC': ['Enf PS', 'Enf PSA HVC', 'Enf PSA', 'Enf Pronto Socorro', 'Enfermagem P.S'],
    'Enfermagem PS Casa de Saúde': ['Casa de Saude P.S. Enf', 'Casa de Saúde PS Enfermagem'],
    'Médico PS — Adulto': ['Médico PSA', 'Médico PS HVC', 'Médico PSA HVC', 'MED PSA HVC', 'méd PSA HVC', 'Pronto Socorro Adulto - Médico'],
    'Médico PS — Pediatria': ['Médico PS Infantil', 'Medico PS Pediatria', 'Medico PSI'],
    'Médico PS — Ortopedia': ['Médico Ortopedia Pronto Socorro', 'Médico Pronto Socorro Ortopedia'],
    'Médico PS — GO': ['Médico Pronto Socorro Ginecologia'],
    'Médico PS CSC — Adulto': ['Casa de Saúde PSA - Médicos'],
    'Médico UTI Adulto': ['Médico UTI Geral/6º andar'],
    'Recepção PS HVC': ['Recepção PSA'],
    'Desospitalização': ['Desosp'],
    'App / Sistemas Digitais': ['APP "Meu Vera Cruz"', 'APP Meu Vera'],
    # Setores históricos distintos são mantidos separados, sem atribuir unidade atual.
    'Central de Convênios / Agendamento Cirúrgico': ['Central de Convênios / Ag. Cirúrgico', 'Central de Convênios/ Agendamento cirurgico'],
    'Central de Autorizações': ['Central de aut.', 'Central de autorizações', 'Central de autorização'],
    'Casa de Saúde — PS — Médicos': ['Casa de Saúde PS Médicos', 'Casa de Saúde - PS - Médicos'],
    'Casa de Saúde — Recepção / Hotelaria': ['Casa de Saúde Recepção/ Hotelaria'],
    'Casa de Saúde — Internação — Enfermagem': ['Casa de Saúde Internação Alas Enf', 'Casa de Saude Enfermagem Alas'],
    'Casa de Saúde — Internação — Médicos': ['Casa de Saúde Alas - médicos'],
    'Casa de Saúde — PS Infantil — Médicos': ['Casa de Saúde PSI MED'],
    'Casa de Saúde — UTI — Enfermagem': ['Casa de Saúde UTI ENF'],
    'Casa de Saúde — Ambulatório': ['Casa de Saúde - AMBULATÓRIO'],
    'Hotelaria — Serviços': ['Hotelaria - Serviços'],
    'Hotelaria — Equipamentos': ['Hotelaria - Equipamentos'],
    'Nutrição de Produção': ['Nutrição de Produção'],
    'Gerenciamento de Leitos / Imagem': ['Gerenciamento de Leitos e Imagem'],
    'Enfermagem UTI Geral': ['Enf. UTI Geral', 'Enf UTI Geral'],
    'Enfermagem Maternidade / Neonatologia': ['Enf. Maternidade/Neonatologia'],
    'Pronto Socorro Adulto HVC': ['PSA HVC'],
    'Pronto Socorro Infantil HVC': ['PSI HVC'],
    'Oncologia Vera Cruz': ['Oncologia Vera Cruz'],
    'Jurídico': ['Juridico'],
    'Arquivo Central': ['Arquivo central', 'Prontuário Central'],
    'Hemodinâmica — Enfermagem': ['Hemodinâmica - Enfermagem'],
}

MOTIVOS = {
    'Dificuldade de contato com a central de agendamento': [
        'Dificuldade de contato para agendamento', 'Dificuldade de contato para agendamento de exames',
        'Dificuldade de contato para agendamento de consulta',
        'Dificuldade de contato com a Central de atendimento para agendamento de consulta'],
    'Conduta médica (histórico)': ['Conduta Médica', 'Contuda médica', 'Queixa conduta Médica'],
    'Conduta de enfermagem (histórico)': ['Conduta Enfermagem', 'Conduta Enf'],
    'Comportamento médico (histórico)': ['Comportamento médico'],
    'Comportamento de enfermagem (histórico)': ['Comportamento enfermagem'],
    'Atendimento médico (histórico)': ['Atendimento médico', 'Qualidade de atendimento médico', 'Qualidade atendimento médico', 'Qualidade atendimento médica'],
    'Demora no atendimento (histórico)': ['Demora atendimento', 'Demora no atendimento', 'Tempo de espera'],
    'Demora no atendimento da recepção (histórico)': ['Demora atendimento recepção', 'Demora para atendimento Recepção', 'Demora no atendimento da recepção'],
    'Conduta da recepção (histórico)': ['Conduta Recepção'],
    'Qualidade comportamental (histórico)': ['Qualidade comportamental'],
    'Dificuldade de contato (histórico)': ['Dificuldade de contato'],
    'Insatisfação com atendimento médico (histórico)': ['Insatisfação com atendimento médico'],
    'Insatisfação com conduta médica (histórico)': ['Insatisfação com conduta médica'],
    'Disponibilização/Troca de leito': ['disponibilidade de leito'],
    'Cancelamento de consulta (histórico)': ['Cancelamento de consulta'],
}


def mapa_seguro(pares):
    valores = defaultdict(set)
    for origem, destino in pares:
        if chave(origem) and texto(destino):
            valores[chave(origem)].add(texto(destino))
    return {k: next(iter(v)) for k, v in valores.items() if len(v) == 1}


def mapas(setores, motivos, depara):
    pares = list(depara) + [(v, v) for v in setores]
    pares += [(alias, destino) for destino, aliases in SETORES.items() for alias in aliases]
    sm = mapa_seguro(pares)
    mm = mapa_seguro([(v, v) for v in motivos] + [(alias, destino) for destino, aliases in MOTIVOS.items() for alias in aliases])
    return sm, mm


def ler(book, setor_map, motivo_map):
    registros, abas = [], []
    for sheet in book:
        if not sheet.title.upper().startswith('BOLETINS'):
            continue
        it = sheet.iter_rows(values_only=True)
        header = None
        for _ in range(10):
            h = [chave(v) for v in next(it, ())]
            if 'dataabertura' in h and 'motivodoboletim' in h:
                header = h
                break
        if not header or not {'nbo', 'paciente', 'tipo', 'setor', 'status'}.issubset(header):
            raise ValueError(f'Formato histórico não reconhecido: {sheet.title}')
        for values in it:
            r = dict(zip(header, values))
            if not any(texto(r.get(k)) for k in ('dataabertura', 'paciente', 'tipo', 'setor', 'motivodoboletim')):
                continue
            raw_setor, raw_motivo = texto(r.get('setor')), texto(r.get('motivodoboletim'))
            tipo = {'solciitacao':'Solicitação', 'soliciitacao':'Solicitação', 'sugestoes':'Sugestão',
                    'inadequacaoclinete':'Inadequação de Cliente'}.get(chave(r.get('tipo')), texto(r.get('tipo')))
            registros.append({
                'Nº BO': r.get('nbo'), 'Paciente': r.get('paciente'), 'Data Abertura': r.get('dataabertura'),
                'Status': r.get('status'), 'Tipo': tipo,
                'Setor': setor_map.get(chave(raw_setor), 'Setor não padronizado') if raw_setor else None,
                'Motivo Padronizado': motivo_map.get(chave(raw_motivo), 'Motivo não padronizado') if raw_motivo else None,
                '_aba_historica': sheet.title,
            })
        abas.append(sheet.title)
    if not abas:
        raise ValueError('Nenhuma aba BOLETINS encontrada no histórico.')
    return registros, abas


def mesclar(atuais, historicos):
    """Correspondência entre fontes por BO + paciente, consumida uma vez por linha.

    Identificadores só existem na memória. A fonte atual prevalece em todos os campos.
    Prioriza data/tipo/setor em BOs com várias manifestações. Não deduplica dentro da fonte.
    """
    indice = defaultdict(list)
    for i, r in enumerate(atuais):
        if texto(r.get('Nº BO')) and texto(r.get('Paciente')):
            indice[(chave(r['Nº BO']), chave(r['Paciente']))].append(i)
    usados, adicionais, repetidos = set(), [], 0
    for h in historicos:
        candidates = [i for i in indice.get((chave(h.get('Nº BO')), chave(h.get('Paciente'))), []) if i not in usados]
        if candidates:
            def pontuar(i):
                a = atuais[i]
                return (a.get('Data Abertura') == h.get('Data Abertura'),
                        chave(a.get('Tipo')) == chave(h.get('Tipo')), chave(a.get('Setor')) == chave(h.get('Setor')))
            melhor = max(candidates, key=pontuar)
            usados.add(melhor)
            repetidos += 1
        else:
            adicionais.append(h)
    return atuais + adicionais, repetidos, adicionais

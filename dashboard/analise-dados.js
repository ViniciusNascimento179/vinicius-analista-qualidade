/* Análises descritivas calculadas a partir da mesma base dos gráficos. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AnaliseDados = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const TITULOS = {visao:'Visão Geral', inspecoes:'Inspeções', rounds:'Rounds', huddle:'Huddle', watcher:'Watcher', jci:'JCI + Comitês'};
  const n = v => typeof v === 'number' && Number.isFinite(v) ? v : 0;
  const fmt = v => Number.isFinite(v) ? v.toLocaleString('pt-BR', {maximumFractionDigits:1}) : 'não disponível';
  const taxa = (a,b) => b > 0 ? `${fmt(a / b * 100)}%` : 'não calculável (denominador zero)';
  const soma = (xs,key) => (xs || []).reduce((s,x) => s + n(x[key]), 0);
  const maior = (xs,key='total') => [...(xs || [])].sort((a,b)=>n(b[key])-n(a[key]))[0];
  const periodo = xs => xs?.length ? [...new Set(xs)].sort((a,b)=>a-b).join(', ') : 'não informado';
  const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const status = (obj, nome) => Object.entries(obj || {}).reduce((s,[k,v]) => norm(k) === norm(nome) ? s+n(v) : s,0);
  function gerar(d, aba, filtro='total') {
    if (!TITULOS[aba]) throw new Error('Aba desconhecida');
    const a = {aba, titulo:TITULOS[aba], filtro:String(filtro), base:d.gerado_em || 'não informada', periodo:'Base consolidada', resumo:'', achados:[], interpretacao:[], acoes:[], limites:[], acompanhamento:[]};
    const I=d.inspecoes?.total, R=d.rounds, H=d.huddle, W=d.watcher, J=d.jci;
    if (aba === 'inspecoes') {
      const b = filtro === 'total' ? I : d.inspecoes?.por_ano?.[String(filtro)];
      if (!b) return semDados(a);
      a.periodo = filtro === 'total' ? `Anos de registro: ${periodo(d.inspecoes.anos)}` : `Ano de registro: ${filtro}`;
      const atrasadas=n(b.situacao_prazo?.atrasada), alta=n(b.prioridade_aberto?.Alta)+n(b.prioridade_aberto?.Imediata);
      const resp=maior(b.atrasos_responsavel), cat=maior(b.categoria_fms), semAndar=(b.abertos_andar || []).find(x=>x.andar==='Não identificado');
      a.resumo = `${fmt(b.total)} ações registradas: ${fmt(b.concluidos)} concluídas (${taxa(b.concluidos,b.total)}) e ${fmt(b.abertos)} em aberto. ${b.abertos ? `${fmt(atrasadas)} das abertas estão atrasadas (${taxa(atrasadas,b.abertos)}).` : 'Não há ações abertas ou atrasadas neste recorte.'}`;
      a.achados.push(`${fmt(b.inspecoes)} combinações de data e setor usadas como aproximação do número de inspeções; ${fmt(alta)} ações abertas têm prioridade alta ou imediata.`);
      if(resp) a.achados.push(`${resp.setor} concentra ${fmt(resp.total)} de ${fmt(atrasadas)} ações atrasadas (${taxa(resp.total,atrasadas)}).`);
      if(cat) a.achados.push(`${cat.categoria} reúne ${fmt(cat.total)} de ${fmt(b.total)} apontamentos (${taxa(cat.total,b.total)}), a maior concentração por categoria FMS, considerando todos os status.`);
      a.interpretacao.push(b.abertos ? 'O estoque em aberto indica necessidade de acompanhamento do encerramento. A prioridade deve combinar prazo, gravidade e impacto; volume isolado não mede o risco.' : 'Não há ações em aberto neste recorte. Confirmar por amostragem as evidências de encerramento e a ausência de recorrência antes de concluir que as melhorias foram sustentadas.');
      a.interpretacao.push('Os anos agrupam a data de registro e mostram o status atual das ações. Anos antigos tiveram mais tempo para conclusão; a diferença entre taxas anuais não prova piora recente.');
      a.acoes.push('Validar os prazos e as evidências das ações; pactuar responsáveis e datas para o estoque em aberto, começando pelas prioridades altas e imediatas.', 'Investigar com as áreas as barreiras de execução e as recorrências; registrar as causas comprovadas e as ações decorrentes.');
      a.limites.push('Sem meta institucional e sem histórico de snapshots, não é possível medir redução do estoque ou eficácia das ações ao longo do tempo. A quantidade de inspeções é estimada por data e setor, não por identificador único de visita.');
      if(semAndar?.total) a.limites.push(`${fmt(semAndar.total)} ações abertas (${taxa(semAndar.total,b.abertos)}) não têm andar identificado. Completar o cadastro antes de comparar pavimentos.`);
      a.acompanhamento.push('Na próxima avaliação, comparar ações abertas e atrasadas com este registro, verificar evidências de conclusão e observar recorrência por setor e categoria.');
    } else if (aba === 'rounds') {
      const ano=String(filtro === 'total' ? R?.anos?.[R.anos.length-1] : filtro);
      const b=R?.por_ano?.find(x=>String(x.ano)===ano);
      if(!b) return semDados(a);
      a.filtro=ano;
      const meses=R.evolucao?.[ano] || [], inter=R.interacoes?.por_ano?.[ano];
      a.periodo=`${ano}: ${meses.length ? `${meses[0].mes} a ${meses[meses.length-1].mes}` : 'meses não informados'}`;
      const diferenca=n(b.previstos)-n(b.realizados);
      a.resumo=`Foram realizados ${fmt(b.realizados)} de ${fmt(b.previstos)} rounds previstos (${taxa(b.realizados,b.previstos)}). A diferença entre previstos e realizados é ${fmt(diferenca)}.`;
      const setores=(R.setores?.[ano] || []).filter(x=>x.previstos>0).sort((x,y)=>x.realizados/x.previstos-y.realizados/y.previstos);
      if(setores[0]) { const s=setores[0]; a.achados.push(`Menor realização no recorte: ${s.setor}, com ${fmt(s.realizados)}/${fmt(s.previstos)} (${taxa(s.realizados,s.previstos)}).`); }
      if(inter) { const c=maior(inter.categorias); a.achados.push(`${fmt(inter.total)} interações registradas${c ? `; ${c.categoria} representa ${fmt(c.total)} (${taxa(c.total,inter.total)})` : ''}.`); }
      const anterior=String(Number(ano)-1), prev=R.evolucao?.[anterior] || [];
      const comuns=meses.filter(m=>m.previstos>0 && prev.some(p=>p.mes===m.mes && p.previstos>0));
      if(comuns.length) {
        const p=prev.filter(m=>comuns.some(c=>c.mes===m.mes));
        const atual=soma(comuns,'realizados')/soma(comuns,'previstos')*100, antes=soma(p,'realizados')/soma(p,'previstos')*100;
        a.achados.push(`${comuns.length===1?'No mesmo mês disponível':'Nos mesmos '+comuns.length+' meses disponíveis'} em ${anterior} e ${ano}, a realização passou de ${fmt(antes)}% para ${fmt(atual)}% (${atual-antes>=0?'+':''}${fmt(atual-antes)} pontos percentuais). A composição dos setores pode ter mudado.`);
      }
      a.interpretacao.push('A proporção realizados/previstos descreve execução do planejamento. Mais interações podem refletir maior cobertura ou melhor registro; não demonstram, isoladamente, mais eventos adversos ou melhor qualidade assistencial.');
      a.acoes.push('Revisar com os setores de menor realização as barreiras de agenda, cobertura e registro; pactuar plano e meta institucional.', 'Analisar os temas recorrentes das interações e verificar se geraram ações e acompanhamento de eficácia.');
      if(n(b.pendentes)!==diferenca) a.limites.push(`Inconsistência a validar: a coluna Pendentes informa ${fmt(b.pendentes)}, enquanto previstos menos realizados resulta em ${fmt(diferenca)}. Confirmar a definição da coluna antes de usá-la para cobrança.`);
      if(meses.length<12) a.limites.push(`O ano contém ${meses.length} meses com registros. Não comparar seu volume bruto com um ano completo.`);
      a.limites.push('A comparação temporal não ajusta mudanças de setores, complexidade ou regras de registro. Não há meta institucional cadastrada na base.');
      a.acompanhamento.push('Reavaliar mensalmente realizados/previstos, motivos de não realização e encaminhamento das interações, usando os mesmos setores e meses comparáveis.');
    } else if (aba === 'huddle') {
      if(!H) return semDados(a);
      const pc=status(H.planos_status,'Concluído'), fc=status(H.follow_status,'Concluído');
      const pa=n(H.planos_total)-pc, fa=n(H.follow_total)-fc;
      a.periodo=`Anos dos planos: ${periodo(H.planos_evolucao?.map(x=>x.ano))}; follow-ups: ${periodo(H.follow_evolucao?.map(x=>x.ano))}`;
      a.resumo=`Planos: ${fmt(pc)}/${fmt(H.planos_total)} concluídos (${taxa(pc,H.planos_total)}). Follow-ups: ${fmt(fc)}/${fmt(H.follow_total)} concluídos (${taxa(fc,H.follow_total)}).`;
      a.achados.push(`${fmt(pa)} planos e ${fmt(fa)} follow-ups não estão classificados como concluídos. São populações distintas e não devem ser somadas como problemas únicos.`);
      const ultimo=H.planos_evolucao?.slice().sort((a,b)=>b.ano-a.ano)[0];
      if(ultimo) a.achados.push(`Nos planos registrados em ${ultimo.ano}, ${fmt(ultimo.concluido)} de ${fmt(ultimo.total)} estão concluídos (${taxa(ultimo.concluido,ultimo.total)}).`);
      a.interpretacao.push('O encerramento elevado dos planos precisa ser acompanhado da verificação de eficácia. O estoque de follow-ups justifica revisar sua relação com os planos e a atualização dos registros; não prova que ações concluídas falharam.');
      a.acoes.push('Revisar os follow-ups em aberto, confirmar se ainda são ativos e vincular cada um ao respectivo problema ou plano.', 'Auditar uma amostra de planos concluídos, verificando evidência, resultado obtido e eventual recorrência.');
      a.limites.push('Sem vínculo individual entre plano e follow-up, prazo por registro ou histórico de mudanças de status neste painel, não é possível medir atraso, tempo de resolução ou eficácia.', 'Anos recentes podem estar incompletos. Diferenças de volume e de tempo disponível para encerramento impedem classificar tendência apenas pelos totais.');
      a.acompanhamento.push('Acompanhar estoque ativo, percentual concluído com evidência e reincidência; registrar uma linha de base e a meta acordada para o próximo ciclo.');
    } else if (aba === 'watcher') {
      if(!W) return semDados(a);
      const altas=status(W.desfechos,'Alta'), obitos=status(W.desfechos,'Óbito'), sem=status(W.desfechos,'Não informado');
      a.periodo=`Anos de entrada: ${periodo(W.evolucao?.map(x=>x.ano))}`;
      a.resumo=`Entre ${fmt(W.total)} registros de pacientes acompanhados, há ${fmt(altas)} altas (${taxa(altas,W.total)}), ${fmt(obitos)} óbitos (${taxa(obitos,W.total)}) e ${fmt(sem)} desfechos não informados (${taxa(sem,W.total)}).`;
      const p=soma(Object.entries(W.permanencia_faixas || {}).map(([faixa,total])=>({faixa,total})),'total');
      a.achados.push(`A média de tempo de vigilância é ${W.permanencia_media == null ? 'não informada' : `${fmt(W.permanencia_media)} dias`}; ${fmt(p)} de ${fmt(W.total)} registros têm duração classificada nas faixas apresentadas.`);
      const criticos=status(W.evolucao_clinica,'Crítico');
      a.achados.push(`${fmt(criticos)} registros têm última evolução classificada como crítica (${taxa(criticos,W.total)}). É um consolidado histórico, não uma lista de pacientes críticos atuais.`);
      a.interpretacao.push('A ausência de desfecho limita a interpretação do acompanhamento. As proporções são descritivas deste grupo selecionado e não representam mortalidade hospitalar ou risco ajustado.');
      a.acoes.push('Conciliar desfechos e datas de acompanhamento com a fonte institucional, preservando os identificadores fora deste painel.', 'Submeter os achados à equipe assistencial e de qualidade para revisão contextual dos processos e identificação de oportunidades de melhoria.');
      a.limites.push('Sem gravidade, perfil clínico, critérios estáveis de inclusão, identificação de readmissões ou denominador hospitalar, não é possível atribuir causalidade, comparar desempenho assistencial ou estimar risco individual.', 'A média de vigilância não equivale necessariamente a permanência hospitalar. Os dados agregados não sustentam decisões clínicas individuais.');
      a.acompanhamento.push('Monitorar completude de desfechos e datas, padronizar critérios de inclusão e acompanhar os resultados das melhorias de processo definidas pela equipe.');
    } else if (aba === 'jci') {
      if(!J) return semDados(a);
      const c=n(J.classes?.Conforme), nc=n(J.classes?.['Não Conforme']), ne=n(J.classes?.['Não avaliado']), na=n(J.classes?.['Não se aplica']);
      a.periodo='Checklist consolidado; data da avaliação não disponível nos agregados';
      a.resumo=`${fmt(c)} de ${fmt(c+nc)} elementos classificados como conformes ou não conformes estão conformes (${taxa(c,c+nc)}). Há ${fmt(nc)} não conformes, ${fmt(ne)} não avaliados e ${fmt(na)} não aplicáveis.`;
      a.achados.push(`Cobertura de classificação dos itens aplicáveis: ${fmt(c+nc)}/${fmt(n(J.total_elementos)-na)} (${taxa(c+nc,n(J.total_elementos)-na)}). Os não avaliados não entram no percentual de conformidade.`);
      const cap=maior(J.capitulos,'nao_conforme');
      const pior=(J.capitulos || []).filter(x=>x.conforme+x.nao_conforme>0).sort((x,y)=>x.conforme/(x.conforme+x.nao_conforme)-y.conforme/(y.conforme+y.nao_conforme))[0];
      if(cap) a.achados.push(`${cap.capitulo} concentra ${fmt(cap.nao_conforme)} não conformidades (${taxa(cap.nao_conforme,nc)} do total).`);
      if(pior) a.achados.push(`Menor proporção de conformidade: ${pior.capitulo}, ${fmt(pior.conforme)}/${fmt(pior.conforme+pior.nao_conforme)} (${taxa(pior.conforme,pior.conforme+pior.nao_conforme)}).`);
      a.achados.push(`Comitês: ${fmt(status(J.comites_status,'Concluído'))} de ${fmt(J.comites_total)} planos classificados como concluídos. Não há vínculo suficiente para atribuir uma não conformidade a cada plano.`);
      a.interpretacao.push('Priorizar os elementos pelo risco e pela relevância assistencial, além do volume por capítulo. Percentual alto em um capítulo não exclui uma não conformidade crítica.');
      a.acoes.push('Concluir a avaliação dos itens pendentes e conferir a aplicabilidade e a evidência de cada classificação.', 'Vincular cada não conformidade a ação, responsável, prazo e evidência; realizar nova verificação para avaliar eficácia e sustentação.');
      a.limites.push('Este percentual descreve o checklist local; não é nota oficial de acreditação nem prova de atendimento integral à JCI. Sem avaliações datadas em série, não há base para afirmar melhora temporal.');
      a.acompanhamento.push('Reavaliar itens corrigidos com evidência, monitorar não conformidades reincidentes e registrar cobertura, resultado, responsável pela validação e próxima avaliação.');
    } else {
      if(!I || !R || !H || !W || !J) return semDados(a);
      const fa=n(H.follow_total)-status(H.follow_status,'Concluído');
      a.periodo='Consolidado de fontes e períodos diferentes; consultar cada aba';
      a.resumo=`Prioridades para revisão: ${fmt(I.situacao_prazo?.atrasada || 0)} ações de inspeção atrasadas, ${fmt(fa)} follow-ups não concluídos e ${fmt(J.classes?.['Não Conforme'] || 0)} elementos não conformes no checklist JCI.`;
      a.achados.push(`Inspeções: ${fmt(I.concluidos)}/${fmt(I.total)} concluídas (${taxa(I.concluidos,I.total)}); Rounds: ${fmt(soma(R.por_ano,'realizados'))}/${fmt(soma(R.por_ano,'previstos'))} realizados (${taxa(soma(R.por_ano,'realizados'),soma(R.por_ano,'previstos'))}).`, `Watcher: ${fmt(status(W.desfechos,'Não informado'))} desfechos não informados; checklist JCI: ${fmt(J.classes?.['Não avaliado'] || 0)} itens ainda não avaliados.`);
      a.interpretacao.push('O painel reúne sinais para priorização gerencial. Conclusão de atividades não demonstra por si só redução de risco ou melhora assistencial; é necessário verificar os resultados e as evidências.', 'As fontes podem representar o mesmo problema em etapas diferentes. Não somar esses estoques como quantidade única de falhas do hospital.');
      a.acoes.push('Na reunião da qualidade, validar as prioridades por risco, confirmar os responsáveis e pactuar metas e prazos.', 'Conferir a qualidade dos registros e vincular problemas, ações e evidências de resultado antes de emitir a conclusão institucional.');
      a.limites.push('Os painéis usam populações, períodos e regras de agregação distintos; não há indicador global de desempenho ou de acreditação calculável pela simples soma dos dados.', 'A data de processamento informa a geração do site, não comprova a atualização de todos os registros de origem.');
      a.acompanhamento.push('Registrar a decisão da reunião e comparar no próximo ciclo os mesmos indicadores, denominadores e períodos, documentando efeitos e continuidade das melhorias.');
    }
    a.limites.push('Metas, causas confirmadas e avaliação de eficácia dependem de registro e validação da equipe. Esta análise é descritiva e não aplica testes de significância ou controle estatístico.');
    return a;
  }
  function semDados(a) { a.resumo='Não há dados disponíveis para este recorte.'; a.limites=['Verificar a fonte e o período antes de emitir conclusão.']; return a; }
  function assinatura(a) {
    const text=JSON.stringify(a); let hash=2166136261;
    for(let i=0;i<text.length;i++) hash=Math.imul(hash^text.charCodeAt(i),16777619);
    return (hash>>>0).toString(16);
  }
  return {gerar, assinatura, TITULOS, taxa};
});

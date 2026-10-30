(function(root){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>v!=='' && v!==null && v!==undefined && Number.isFinite(Number(v)) ? Number(v) : null;
  const fmt=v=>v===null?'—':Number(v).toLocaleString('pt-BR',{maximumFractionDigits:2});
  const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'') && !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v;
  function value(m,r){
    if(m.type==='percent') {const n=num(r.n),d=num(r.d);return n!==null&&d!==null&&n>=0&&d>0&&n<=d?n/d*100:null;}
    return num(r.value);
  }
  function validate(m,r){
    if(!date(r.date)) return 'Informe uma data válida.';
    if(!['base','test'].includes(r.phase)) return 'Selecione linha de base ou teste.';
    if(value(m,r)===null) return m.type==='percent'?'Informe numerador ≥ 0 e denominador > 0; o numerador não pode superar o denominador.':'Informe um valor numérico válido.';
    return '';
  }
  function calculate(m){
    const rows=(m.rows||[]).filter(r=>!validate(m,r)).slice().sort((a,b)=>a.date.localeCompare(b.date));
    const base=rows.filter(r=>r.phase==='base'), tests=rows.filter(r=>r.phase==='test');
    const baseline=base.length ? m.type==='percent' ? base.reduce((s,r)=>s+Number(r.n),0)/base.reduce((s,r)=>s+Number(r.d),0)*100 : base.reduce((s,r)=>s+value(m,r),0)/base.length : null;
    const latest=tests.length?value(m,tests[tests.length-1]):null, target=num(m.target);
    const delta=latest!==null&&baseline!==null?latest-baseline:null;
    const met=latest!==null&&target!==null?(m.direction==='down'?latest<=target:latest>=target):null;
    const favorable=delta===null?null:(m.direction==='down'?delta<0:delta>0);
    const unit=m.type==='percent'?'%':m.unit||'unidades';
    const notes=[];
    if(!rows.length) notes.push('Ainda não há medições válidas. Registre a linha de base e os resultados do teste para iniciar a análise.');
    else notes.push(`${rows.length} medições válidas: ${base.length} de linha de base e ${tests.length} de teste.`);
    if(baseline!==null) notes.push(`Linha de base: ${fmt(baseline)} ${unit} (${m.type==='percent'?'soma dos numeradores / soma dos denominadores × 100':'média dos valores registrados'}).`);
    if(latest!==null) notes.push(`Último resultado do teste, em ${tests[tests.length-1].date.split('-').reverse().join('/')}: ${fmt(latest)} ${unit}.`);
    if(delta!==null) notes.push(`Variação em relação à linha de base: ${delta>0?'+':''}${fmt(delta)} ${m.type==='percent'?'pontos percentuais':unit}. ${delta===0?'Sem mudança no valor.':favorable?'Mudança na direção desejada.':'Mudança contrária à direção desejada.'}`);
    if(met!==null) notes.push(`A meta de ${fmt(target)} ${unit} ${met?'foi atingida':'não foi atingida'} na última medição; isso não demonstra sustentação ao longo do tempo.`);
    if(!base.length) notes.push('Sem linha de base: não é possível comparar o teste com o desempenho anterior.');
    if(!tests.length) notes.push('Sem medições de teste: ainda não é possível avaliar o resultado da mudança.');
    if(target===null) notes.push('Meta não definida: estabeleça o resultado esperado e o prazo.');
    if(base.length&&tests.length&&base[base.length-1].date>=tests[0].date) notes.push('Há linha de base na mesma data ou após o início das medições de teste. Revise a classificação e a comparabilidade.');
    if(tests.length<3) notes.push('Poucas medições de teste: amplie o acompanhamento antes de concluir sobre a estabilidade do resultado.');
    if((m.rows||[]).length!==rows.length) notes.push('Há medições inválidas, excluídas dos cálculos. Corrija os dados.');
    notes.push('Comparação descritiva: não prova causalidade nem significância estatística. Verifique amostra, fonte, método de coleta, contexto e efeitos indesejados com a equipe.');
    return {rows,base,tests,baseline,latest,target,delta,met,unit,notes};
  }
  function svg(m,comparison=false){
    const a=calculate(m);if(!a.rows.length)return '<p>Sem medições para gerar gráfico.</p>';
    const W=800,H=310,L=70,R=25,T=35,B=75;
    const vals=comparison?[a.baseline,a.latest]:a.rows.map(r=>value(m,r));
    const labels=comparison?['Linha de base','Último teste']:a.rows.map(r=>r.date.split('-').reverse().join('/'));
    const valid=vals.filter(v=>v!==null);if(!valid.length)return '<p>Registre medições de linha de base ou teste.</p>';
    const all=[...valid,...(a.target!==null?[a.target]:[])];const lo=Math.min(0,...all),hi=Math.max(1,...all);const span=hi-lo||1;
    const y=v=>T+(hi-v)/span*(H-T-B),x=i=>L+(i+.5)*(W-L-R)/vals.length;
    let body='';
    for(let i=0;i<=4;i++){const v=lo+span*i/4;body+=`<line x1="${L}" y1="${y(v)}" x2="${W-R}" y2="${y(v)}" stroke="#e2e8f0"/><text x="${L-8}" y="${y(v)+4}" text-anchor="end">${esc(fmt(v))}</text>`;}
    if(a.target!==null)body+=`<line x1="${L}" y1="${y(a.target)}" x2="${W-R}" y2="${y(a.target)}" stroke="#b45309" stroke-dasharray="6 4"/><text x="${W-R}" y="${Math.max(14,y(a.target)-7)}" text-anchor="end">Meta: ${esc(fmt(a.target))}</text>`;
    if(!comparison)body+=`<polyline fill="none" stroke="#2563eb" stroke-width="2" points="${vals.map((v,i)=>`${x(i)},${y(v)}`).join(' ')}"/>`;
    vals.forEach((v,i)=>{if(v===null)return;const color=comparison?(i?'#2563eb':'#64748b'):(a.rows[i].phase==='base'?'#64748b':'#2563eb');const title=`${labels[i]} · ${fmt(v)} ${a.unit}${comparison?'':` · ${a.rows[i].phase==='base'?'Linha de base':'Teste'} · ${a.rows[i].note||''}`}`;
      body+=comparison?`<rect x="${x(i)-60}" y="${Math.min(y(v),y(0))}" width="120" height="${Math.max(1,Math.abs(y(0)-y(v)))}" fill="${color}"><title>${esc(title)}</title></rect><text x="${x(i)}" y="${Math.max(15,y(v)-8)}" text-anchor="middle">${esc(fmt(v))}</text>`:`<circle cx="${x(i)}" cy="${y(v)}" r="5" fill="${color}"><title>${esc(title)}</title></circle>`;
      if(comparison||i===0||i===vals.length-1||i%Math.ceil(vals.length/7)===0)body+=`<text transform="translate(${x(i)},${H-B+20}) rotate(-25)" text-anchor="end">${esc(labels[i])}</text>`;
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(m.name||'Indicador')} — ${comparison?'linha de base e último teste':'evolução das medições'}" style="width:100%;min-width:500px;font:12px Arial;fill:#334155"><title>${esc(m.name)} (${esc(a.unit)})</title>${body}</svg>`;
  }
  const fields=[['name','Projeto'],['owner','Responsável / equipe'],['area','Setor / processo'],['aim','Objetivo de melhoria'],['deadline','Prazo do objetivo']];
  const cycleFields=[['name','Nome do ciclo'],['start','Início'],['end','Fim previsto'],['problem','Problema e evidência inicial'],['plan','P — Mudança a testar: o quê, quem, onde e quando'],['prediction','P — Hipótese / resultado esperado'],['collection','P — Plano de coleta e critérios da amostra'],['do','D — Execução real, desvios e observações'],['study','S — Análise crítica da equipe: comparação, causas verificadas e limitações'],['effects','S — Efeitos indesejados / medidas de equilíbrio'],['decision','A — Decisão'],['act','A — Próximos passos, responsáveis e prazos'],['evidence','Referências de evidências / atas'],['reviewer','Responsável pela revisão'],['reviewDate','Data da revisão']];
  function signature(p,c){return JSON.stringify({fields:fields.map(([k])=>p[k]),cycle:cycleFields.map(([k])=>c[k]),metrics:c.metrics});}
  function report(p,c){
    const dl=(fs,o)=>`<dl>${fs.map(([k,l])=>`<dt>${esc(l)}</dt><dd>${esc(o[k]||'Não preenchido')}</dd>`).join('')}</dl>`;
    return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PDSA — ${esc(p.name)}</title><style>body{max-width:1000px;margin:32px auto;padding:24px;font:15px/1.6 Arial;color:#16324f}h2{border-bottom:1px solid #cbd5e1;margin-top:32px}dt,th{font-weight:bold}dd{margin:0 0 14px;white-space:pre-wrap;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%}td,th{padding:8px;border:1px solid #ddd;text-align:left}svg{min-width:0!important}li{margin:8px 0}@media print{body{padding:0;margin:0}h2,h3,dt{break-after:avoid}svg{break-inside:avoid}}</style><body><h1>PDSA — ${esc(p.name||'Projeto sem título')}</h1><p>Exportado em ${esc(new Date().toLocaleString('pt-BR'))}. Use Imprimir → Salvar como PDF para apresentação.</p><p>Revisão: ${c.reviewSignature===signature(p,c)?'Revisado pela equipe (declaração local).':'Pendente: rascunho ou dados alterados desde a revisão.'} Registro local, sem assinatura eletrônica nem trilha de auditoria institucional. Apoia a documentação; não atesta conformidade JCI.</p>${dl(fields,p)}<h2>Ciclo PDSA</h2>${dl(cycleFields,c)}${c.metrics.map(m=>{const a=calculate(m);return `<h2>${esc(m.name||'Indicador sem título')}</h2><p>Tipo de medida: ${esc(m.kind)}. Definição / fonte: ${esc(m.definition||'não informada')}. Direção desejada: ${m.direction==='down'?'reduzir':'aumentar'}. Unidade: ${esc(a.unit)}.</p><h3>Evolução no tempo</h3>${svg(m)}<p>Cinza: linha de base. Azul: teste. As medições são exibidas em ordem cronológica, com espaçamento igual.</p><h3>Linha de base e último teste</h3>${svg(m,true)}<h3>Análise automática para validação</h3><ul>${a.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul><h3>Medições e evidências</h3><table><thead><tr><th>Data</th><th>Fase</th><th>Valor</th><th>Numerador / denominador</th><th>Observação / evidência</th></tr></thead><tbody>${a.rows.map(r=>`<tr><td>${esc(r.date)}</td><td>${r.phase==='base'?'Linha de base':'Teste'}</td><td>${esc(fmt(value(m,r)))} ${esc(a.unit)}</td><td>${m.type==='percent'?`${esc(r.n)} / ${esc(r.d)}`:'—'}</td><td>${esc(r.note)}</td></tr>`).join('')}</tbody></table>`;}).join('')}<h2>Método</h2><p>Cálculos descritivos locais. Valores vazios não equivalem a zero. A meta é definida pela equipe. O atingimento da meta em uma medição não comprova eficácia sustentada.</p><p>Referência: <a href="https://www.ihi.org/library/tools/plan-do-study-act-pdsa-worksheet">IHI — PDSA Worksheet</a> e <a href="https://www.ihi.org/library/tools/quality-improvement-project-measures-worksheet">medidas de melhoria</a>.</p></body></html>`;
  }
  const api={esc,num,fmt,date,value,validate,calculate,svg,fields,cycleFields,signature,report};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.PDSA=api;
})(typeof window==='undefined'?globalThis:window);

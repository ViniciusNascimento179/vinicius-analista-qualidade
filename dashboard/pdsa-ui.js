(function(){
  'use strict';
  const C=PDSA, E=C.esc, KEY='qualidade:pdsa:v1', id=()=>crypto.randomUUID();
  const metric=()=>({id:id(),name:'Novo indicador',kind:'Resultado',type:'number',unit:'',direction:'down',target:'',definition:'',rows:[]});
  const cycle=()=>({id:id(),name:'Ciclo 1',decision:'Em estudo',metrics:[metric()]});
  let db={version:1,projects:[]},loadError=false,current='',cycleId='',metricId='',editing='',unsaved=false;
  try {const raw=localStorage.getItem(KEY);if(raw){const parsed=JSON.parse(raw);if(parsed.version!==1||!Array.isArray(parsed.projects))throw Error();db=parsed;}}catch(e){loadError=true;}
  let sec;
  function status(text){sec?.querySelectorAll('#pd-status, #pd-board-save').forEach(el=>el.textContent=text);}
  function save(){
    unsaved=true;
    if(loadError){status('Não foi possível ler os registros existentes. Exporte uma cópia; o conteúdo anterior não será sobrescrito.');return;}
    try{db.savedAt=new Date().toISOString();localStorage.setItem(KEY,JSON.stringify(db));unsaved=false;status('Salvo somente neste navegador às '+new Date().toLocaleTimeString('pt-BR')+'.');}
    catch(e){status('Não foi possível salvar. Exporte uma cópia JSON antes de sair para preservar os registros.');}
  }
  window.addEventListener('beforeunload',e=>{if(unsaved){e.preventDefault();e.returnValue='';}});
  function selected(){const p=db.projects.find(p=>p.id===current),c=p?.cycles.find(c=>c.id===cycleId),m=c?.metrics.find(m=>m.id===metricId);return {p,c,m};}
  function download(content,type,name){const u=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);}
  function options(items,selectedId){return items.map(x=>`<option value="${E(x.id)}" ${x.id===selectedId?'selected':''}>${E(x.name||'Sem título')}</option>`).join('');}
  function input(key,label,obj,scope,type='textarea'){
    const value=obj[key]||'',name=`pd-${scope}-${key}`;
    return `<label class="${type==='textarea'?'pd-wide':''}" for="${name}">${E(label)}${type==='textarea'?`<textarea id="${name}" data-scope="${scope}" data-key="${key}" rows="3" maxlength="8000">${E(value)}</textarea>`:`<input id="${name}" data-scope="${scope}" data-key="${key}" type="${type}" ${type==='number'?'step="any"':''} maxlength="500" value="${E(value)}">`}</label>`;
  }
  function select(key,label,values,obj,scope){return `<label for="pd-${scope}-${key}">${E(label)}<select id="pd-${scope}-${key}" data-scope="${scope}" data-key="${key}">${values.map(([v,l])=>`<option value="${E(v)}" ${obj[key]===v?'selected':''}>${E(l)}</option>`).join('')}</select></label>`;}
  function review(){const {p,c}=selected();const summary=sec.querySelector('#pd-board-metrics');if(summary)summary.textContent=c.metrics.map(m=>{const a=C.calculate(m);return `${m.name||'Indicador'}: base ${C.fmt(a.baseline)} ${a.unit}; último teste ${C.fmt(a.latest)} ${a.unit}; meta ${C.fmt(a.target)} ${a.unit}.`;}).join('\n');const el=sec.querySelector('#pd-review');if(el)el.textContent=c.reviewSignature===C.signature(p,c)?'Revisado pela equipe (declaração local).':'Revisão pendente: rascunho ou dados alterados desde a revisão.';}

  function visualEditor(p,c){
    const field=k=>{const label=C.cycleFields.find(([key])=>key===k)[1];return k==='decision'?select(k,label,[['Em estudo','Em estudo'],['Adotar','Adotar'],['Adaptar','Adaptar'],['Abandonar','Abandonar']],c,'cycle'):input(k,label,c,'cycle',['start','end','reviewDate'].includes(k)?'date':['name','reviewer'].includes(k)?'text':'textarea');};
    const fields=keys=>keys.map(field).join('');
    const extra=(title,keys)=>`<details class="pd-editor-extra"><summary>${E(title)}</summary><div class="pd-editor-fields">${fields(keys)}</div></details>`;
    return `<section class="painel"><h2>Preencha diretamente no quadro PDSA</h2><p>Escreva nos campos de cada etapa. O preenchimento é salvo automaticamente neste navegador e compõe o relatório.</p><p id="pd-board-save" role="status">${unsaved?'Há alterações ainda não salvas.':'Pronto para preencher.'}</p>
      <div class="pd-fields">${fields(['name','start','end'])}</div>
      <div id="pd-board" class="pd-board pd-editor">
      <article class="pd-p"><h3>P — Planejar</h3><p>Qual é o problema, o que vamos testar e o que esperamos aprender?</p><div class="pd-editor-fields">${fields(['problem'])}${input('aim','Objetivo de melhoria',p,'project')}${input('deadline','Prazo do objetivo',p,'project','date')}${fields(['plan','prediction','collection'])}</div>${extra('Observação, histórico e causas',['history','observation','causes'])}${extra('Investigar com os 5 Porquês',['why1','why2','why3','why4','why5'])}${extra('Detalhar o plano de ação 5W2H',['actionWhat','actionWhy','actionWhere','actionWhen','actionWho','actionHow','actionCost'])}</article>
      <article class="pd-d"><h3>D — Executar</h3><p>Registre como o teste aconteceu e os desvios do planejamento.</p><div class="pd-editor-fields">${fields(['do','evidence'])}</div></article>
      <article class="pd-s"><h3>S — Estudar</h3><p>Compare o resultado com a previsão e registre o aprendizado.</p><div id="pd-board-metrics" class="pd-editor-metrics"></div><details id="pd-visual-measures" class="pd-editor-extra"><summary>Preencher indicadores, medições e ver gráficos</summary><div id="pd-metrics-slot"></div></details><div class="pd-editor-fields">${fields(['study','predictionReview','studyLearning','effects'])}</div></article>
      <article class="pd-a"><h3>A — Agir</h3><p>Decida o próximo passo com base no que foi aprendido.</p><div class="pd-editor-fields">${fields(['decision','act'])}</div>${extra('Padronização, conclusão e próximo ciclo',['standard','lessons','remaining'])}${extra('Revisão da equipe',['reviewer','reviewDate'])}<p id="pd-review"></p><button type="button" data-action="review">Registrar revisão da equipe</button></article>
      <div class="pd-wheel" aria-label="Ciclo PDSA"><span>A</span><span>P</span><span>S</span><span>D</span></div>
      </div></section>`;
  }
  function render(){
    sec=document.getElementById('aba-pdsa');
    if(!db.projects.some(p=>p.id===current))current=db.projects[0]?.id||'';
    let p=db.projects.find(p=>p.id===current);
    if(p&&!p.cycles.some(c=>c.id===cycleId))cycleId=p.cycles[0]?.id||'';
    let c=p?.cycles.find(c=>c.id===cycleId);
    if(c&&!c.metrics.some(m=>m.id===metricId))metricId=c.metrics[0]?.id||'';
    const m=c?.metrics.find(m=>m.id===metricId);
    sec.innerHTML=`<div class="pd-intro"><div><span class="pd-tag">MELHORIA CONTÍNUA</span><h2>Projetos e ciclos PDSA</h2><p>Defina o problema, teste uma mudança e acompanhe o resultado com dados.</p></div><button type="button" data-action="new-project">Novo projeto</button></div>
      <p class="aviso">Os preenchimentos ficam somente neste navegador. Não são enviados ao GitHub nem compartilhados com outras pessoas. Exporte uma cópia JSON para guardar ou transferir os projetos; limpar os dados do navegador apaga os registros locais. Use dados agregados, sem identificação de pacientes.</p>
      <div class="pd-toolbar"><button type="button" data-action="backup">Exportar cópia JSON</button><label class="pd-import">Importar cópia JSON<input id="pd-import" type="file" accept=".json,application/json"></label>${p?'<button type="button" data-action="report">Exportar relatório do ciclo</button>':''}</div>
      <p id="pd-status" role="status">${loadError?'Falha ao ler o armazenamento local. Os dados anteriores serão preservados.':db.savedAt?'Último salvamento local: '+E(new Date(db.savedAt).toLocaleString('pt-BR')):'Crie um projeto para começar. Nenhum dado de exemplo é incluído.'}</p>
      ${p?`<div class="pd-selectors"><label>Projeto<select id="pd-project">${options(db.projects,current)}</select></label><label>Ciclo<select id="pd-cycle">${options(p.cycles,cycleId)}</select></label><button type="button" data-action="new-cycle">Novo ciclo</button></div>
      <details class="painel" open><summary>1. Projeto e objetivo</summary><div class="pd-fields">${C.fields.filter(([k])=>!['aim','deadline'].includes(k)).map(([k,l])=>input(k,l,p,'project',k==='deadline'?'date':k==='aim'?'textarea':'text')).join('')}</div></details>
      <div class="pd-phases">${[['P','Planejar'],['D','Executar'],['S','Estudar'],['A','Agir']].map(([letter,label])=>`<span><b>${letter}</b>${label}</span>`).join('')}</div>
      ${visualEditor(p,c)}
      <section class="painel" id="pd-indicators" tabindex="-1"><h3>Indicadores e medições</h3><p>Use indicadores de resultado, processo e equilíbrio conforme o problema. Cada indicador possui sua própria unidade, meta e série de medições.</p><div class="pd-selectors"><label>Indicador<select id="pd-metric">${options(c.metrics,metricId)}</select></label><button type="button" data-action="new-metric">Novo indicador</button></div>
      <div class="pd-fields">${input('name','Nome do indicador',m,'metric','text')}${select('kind','Tipo de medida',[['Resultado','Resultado'],['Processo','Processo'],['Equilíbrio','Equilíbrio']],m,'metric')}${select('type','Como calcular',[['number','Valor numérico (contagem, tempo ou outra unidade)'],['percent','Percentual (numerador / denominador × 100)']],m,'metric')}${input('unit','Unidade (ex.: dias, ocorrências)',m,'metric','text')}${select('direction','Direção desejada',[['down','Reduzir'],['up','Aumentar']],m,'metric')}${input('target','Meta numérica',m,'metric','number')}${input('definition','Definição, fonte dos dados, frequência e critérios de inclusão',m,'metric')}</div>
      <div id="pd-measure-form"></div><div id="pd-results"></div></section>
      <details class="painel"><summary>Método e uso do relatório</summary><p>A análise automática usa regras descritivas e não interpreta causas a partir de textos. Registre a interpretação e as evidências da equipe em “S — Estudo dos resultados e análise crítica”. O relatório reúne todos os indicadores e todos os campos do ciclo selecionado, com gráficos incorporados, e pode ser impresso em PDF.</p><p>O registro local não possui assinatura eletrônica ou trilha de auditoria institucional. Organize os relatórios e evidências conforme o processo da instituição. A ferramenta apoia a apresentação e não atesta conformidade JCI.</p><a href="https://www.ihi.org/library/tools/plan-do-study-act-pdsa-worksheet" target="_blank" rel="noopener">Referência: IHI — PDSA Worksheet</a></details>`:'<div class="painel"><h3>Comece pelo problema que deseja resolver</h3><p>Crie um projeto, descreva o objetivo e registre o primeiro teste de mudança. Depois, adicione as medições para gerar os gráficos e a análise.</p></div>'}`;
    if(p){sec.querySelector("#pd-metrics-slot").appendChild(sec.querySelector("#pd-indicators"));review();measureForm();results();}
    sec.oninput=e=>{
      const scope=e.target.dataset.scope,key=e.target.dataset.key;if(!scope)return;
      const {p,c,m}=selected();const obj={project:p,cycle:c,metric:m}[scope];
      if(scope==='metric'&&key==='type'&&m.rows.length){e.target.value=m.type;status('Para preservar as medições, crie outro indicador se precisar mudar o método de cálculo.');return;}
      if(scope==='metric'&&key==='target'&&e.target.value!==''&&(C.num(e.target.value)===null||(m.type==='percent'&&(Number(e.target.value)<0||Number(e.target.value)>100)))){e.target.setCustomValidity('Use uma meta válida; percentuais devem ficar entre 0 e 100.');e.target.reportValidity();return;}
      e.target.setCustomValidity('');obj[key]=e.target.value;save();review();
      if(key==='name'){const selector=scope==='project'?'#pd-project':scope==='cycle'?'#pd-cycle':'#pd-metric';sec.querySelector(selector).selectedOptions[0].textContent=obj.name||'Sem título';}
      if(scope==='metric'){results();if(key==='type')measureForm();}
    };
    sec.onchange=async e=>{
      if(e.target.id==='pd-project'){current=e.target.value;editing='';render();}
      if(e.target.id==='pd-cycle'){cycleId=e.target.value;editing='';render();}
      if(e.target.id==='pd-metric'){metricId=e.target.value;editing='';render();}
      if(e.target.id==='pd-import')await importFile(e.target.files[0]);
    };
    sec.onclick=e=>{
      const action=e.target.closest('[data-action]')?.dataset.action;if(!action)return;
      const {p,c,m}=selected();
      if(action==='go-metrics'){const target=sec.querySelector('#pd-indicators');target.scrollIntoView({behavior:'smooth',block:'start'});target.focus({preventScroll:true});}
      if(action==='new-project'){const next={id:id(),name:'Novo projeto',cycles:[cycle()]};db.projects.push(next);current=next.id;editing='';render();save();}
      if(action==='new-cycle'){const next=cycle();next.name=`Ciclo ${p.cycles.length+1}`;next.metrics=c.metrics.map(m=>({...m,id:id(),rows:[]}));p.cycles.push(next);cycleId=next.id;editing='';render();save();}
      if(action==='new-metric'){const next=metric();c.metrics.push(next);metricId=next.id;editing='';render();save();}
      if(action==='backup')download(JSON.stringify(db,null,2),'application/json','pdsa-projetos.json');
      if(action==='report')download(C.report(p,c),'text/html;charset=utf-8','pdsa-relatorio.html');
      if(action==='review'){
        if(!c.reviewer?.trim()||!C.date(c.reviewDate)||!c.study?.trim()||!c.act?.trim()||c.decision==='Em estudo'){status('Para registrar a revisão, preencha análise crítica, decisão, próximos passos, responsável e data da revisão.');return;}
        c.reviewSignature=C.signature(p,c);save();review();
      }
      if(action==='edit-row'){editing=e.target.dataset.id;measureForm();sec.querySelector('#pd-row-date').focus();}
      if(action==='cancel-row'){editing='';measureForm();}
    };
  }
  function measureForm(){
    const {m}=selected(),r=m.rows.find(r=>r.id===editing)||{};
    sec.querySelector('#pd-measure-form').innerHTML=`<form id="pd-row-form"><h4>${editing?'Editar medição':'Adicionar medição'}</h4><div class="pd-fields"><label>Data<input id="pd-row-date" name="date" type="date" required value="${E(r.date)}"></label><label>Fase<select name="phase"><option value="base" ${r.phase==='base'?'selected':''}>Linha de base (antes da mudança)</option><option value="test" ${r.phase==='test'?'selected':''}>Teste (após a mudança)</option></select></label>${m.type==='percent'?`<label>Numerador<input name="n" type="number" step="any" min="0" required value="${E(r.n)}"></label><label>Denominador<input name="d" type="number" step="any" min="0" required value="${E(r.d)}"></label>`:`<label>Valor (${E(m.unit||'unidades')})<input name="value" type="number" step="any" required value="${E(r.value)}"></label>`}<label class="pd-wide">Observação, mudança testada e referência da evidência<textarea name="note" rows="2" maxlength="4000">${E(r.note)}</textarea></label></div><button type="submit">${editing?'Salvar medição':'Adicionar medição e atualizar gráficos'}</button>${editing?'<button type="button" data-action="cancel-row">Cancelar edição</button>':''}<p id="pd-row-error" role="alert"></p></form>`;
    sec.querySelector('#pd-row-form').onsubmit=e=>{e.preventDefault();const r=Object.fromEntries(new FormData(e.target));const error=C.validate(m,r);if(error){sec.querySelector('#pd-row-error').textContent=error;return;}
      if(m.rows.some(x=>x.date===r.date&&x.id!==editing)){sec.querySelector('#pd-row-error').textContent='Já há uma medição nesta data. Edite a existente ou consolide os dados do período.';return;}
      if(editing){const index=m.rows.findIndex(x=>x.id===editing);m.rows[index]={...r,id:editing};}else m.rows.push({...r,id:id()});editing='';save();review();measureForm();results();};
  }
  function results(){
    const {m}=selected(),a=C.calculate(m);
    sec.querySelector('#pd-results').innerHTML=`<div class="pd-kpis"><div><span>Linha de base</span><strong>${C.fmt(a.baseline)} ${E(a.unit)}</strong></div><div><span>Último teste</span><strong>${C.fmt(a.latest)} ${E(a.unit)}</strong></div><div><span>Meta</span><strong>${C.fmt(a.target)} ${E(a.unit)}</strong></div></div>
      <h3>Evolução das medições</h3><div class="pd-chart">${C.svg(m)}</div><p class="pd-note">Cinza: linha de base · Azul: teste · Linha tracejada: meta. Datas em ordem cronológica, com espaçamento igual. Passe o mouse nos pontos para ver observações.</p>
      <h3>Linha de base × último teste</h3><div class="pd-chart">${C.svg(m,true)}</div>
      <div class="pd-analysis"><h3>Análise automática — validar com a equipe</h3><ul>${a.notes.map(n=>`<li>${E(n)}</li>`).join('')}</ul><p>Complete a interpretação, as causas verificadas e a decisão nos campos S e A do ciclo.</p></div>
      <h3>Medições registradas</h3><div class="pd-table"><table><thead><tr><th>Data</th><th>Fase</th><th>Valor</th><th>Observação / evidência</th><th>Ação</th></tr></thead><tbody>${a.rows.map(r=>`<tr><td>${E(r.date)}</td><td>${r.phase==='base'?'Linha de base':'Teste'}</td><td>${C.fmt(C.value(m,r))} ${E(a.unit)}${m.type==='percent'?` (${E(r.n)}/${E(r.d)})`:''}</td><td>${E(r.note)}</td><td><button type="button" data-action="edit-row" data-id="${E(r.id)}">Editar</button></td></tr>`).join('')||'<tr><td colspan="5">Nenhuma medição registrada.</td></tr>'}</tbody></table></div>`;
  }
  async function importFile(file){
    if(!file)return;
    try{
      if(file.size>5000000)throw Error('Use um arquivo de até 5 MB.');
      const src=JSON.parse(await file.text());if(src.version!==1||!Array.isArray(src.projects)||src.projects.length>100)throw Error('Formato de cópia inválido.');
      const text=(o,k)=>{if(o[k]!==undefined&&typeof o[k]!=='string')throw Error('Campo de texto inválido.');return (o[k]||'').slice(0,8000);};
      const projects=src.projects.map(p=>{if(!Array.isArray(p.cycles)||!p.cycles.length||p.cycles.length>100)throw Error('Ciclos inválidos.');return {...Object.fromEntries(C.fields.map(([k])=>[k,text(p,k)])),id:id(),cycles:p.cycles.map(c=>{
        if(!Array.isArray(c.metrics)||!c.metrics.length||c.metrics.length>100)throw Error('Indicadores inválidos.');
        return {...Object.fromEntries(C.cycleFields.map(([k])=>[k,text(c,k)])),id:id(),metrics:c.metrics.map(m=>{
          if(!['number','percent'].includes(m.type)||!['up','down'].includes(m.direction)||!Array.isArray(m.rows)||m.rows.length>10000)throw Error('Medições inválidas.');
          const n={...Object.fromEntries(['name','kind','type','unit','direction','target','definition'].map(k=>[k,text(m,k)])),id:id(),rows:[]};
          if(n.target!==''&&(C.num(n.target)===null||(n.type==='percent'&&(Number(n.target)<0||Number(n.target)>100))))throw Error('Meta inválida.');
          const dates=new Set();n.rows=m.rows.map(r=>{const row={...Object.fromEntries(['date','phase','value','n','d','note'].map(k=>[k,text(r,k)])),id:id()};if(C.validate(n,row)||dates.has(row.date))throw Error('Medição inválida ou data duplicada.');dates.add(row.date);return row;});return n;
        })};
      })};});
      db.projects.push(...projects);current=projects[0]?.id||current;editing='';render();save();status('Cópia importada como novos projetos, sem substituir os existentes. A revisão da equipe deve ser renovada.');
    }catch(e){status('Importação não realizada: '+e.message);}
  }
  const style=document.createElement('style');style.textContent=C.boardCSS;document.head.appendChild(style);
  RENDER.pdsa=render;
})();

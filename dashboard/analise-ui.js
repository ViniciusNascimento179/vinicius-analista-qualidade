(function() {
  'use strict';
  const fonte='https://digitalassets.jointcommission.org/api/public/content/79e9f5d2cd444a1a9178ab3f9487889a?v=4d4ea7b7';
  const campos=[
    ['conclusao','Conclusão da equipe','textarea','Síntese após validar os dados e discutir os achados.'],
    ['causas','Causas e evidências verificadas','textarea','Diferencie hipóteses de causas confirmadas e indique a evidência.'],
    ['acoes','Ações e decisões pactuadas','textarea','O que será feito e como se relaciona com os achados.'],
    ['meta','Meta institucional e referência','text','Indicador, valor esperado, prazo e referência da meta.'],
    ['responsavel','Responsável pelas ações','text','Nome ou função responsável pelo acompanhamento.'],
    ['prazo','Prazo das ações','date',''],
    ['eficacia','Avaliação de eficácia','textarea','Indicador, linha de base, resultado esperado e método de verificação.'],
    ['reavaliacao','Data da próxima avaliação','date',''],
    ['analista','Responsável pela análise','text','Nome ou função de quem realizou a avaliação.'],
    ['dataAnalise','Data da análise da equipe','date',''],
    ['evidencias','Referência das evidências / ata','textarea','Identifique a ata ou documento institucional de suporte.']
  ];
  const estados={'rascunho':'Rascunho','em-revisao':'Em revisão','revisado':'Revisado pela equipe (declarado)'};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const lista=xs=>`<ul>${xs.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`;
  function corpo(a) {
    return `<p class="ac-resumo">${esc(a.resumo)}</p><div class="ac-colunas">
      <div><h3>Achados nos dados</h3>${lista(a.achados)}</div>
      <div><h3>Interpretação crítica</h3>${lista(a.interpretacao)}</div>
      <div><h3>Ações sugeridas para discussão</h3>${lista(a.acoes)}</div>
      <div><h3>Como acompanhar</h3>${lista(a.acompanhamento)}</div>
      </div><details class="ac-limites"><summary>Limitações e qualidade dos dados</summary>${lista(a.limites)}</details>`;
  }
  function relatorio(a,r,desatualizado=false) {
    const fields=r?.fields || {};
    const revisaoIncompleta=fields.estado==='revisado' && (!fields.analista?.trim() || !fields.dataAnalise || !fields.conclusao?.trim());
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Análise crítica — ${esc(a.titulo)}</title><style>
      body{font:15px/1.6 Arial,sans-serif;color:#172b44;max-width:960px;margin:32px auto;padding:24px}h1{font-size:26px}h2{margin-top:28px;border-bottom:1px solid #ccd6e2}h3{font-size:16px}li{margin:8px 0}dt{font-weight:bold;margin-top:16px}dd{margin:4px 0;white-space:pre-wrap;overflow-wrap:anywhere}.nota{background:#f0f5fa;padding:14px}summary{font-weight:bold}details{display:block}details>ul{display:block}a{overflow-wrap:anywhere}@media print{body{margin:0;max-width:none}h2,h3,dt{break-after:avoid}li,dd{break-inside:avoid}}
      </style></head><body><h1>Análise crítica — ${esc(a.titulo)}</h1>
      <p><strong>Período:</strong> ${esc(a.periodo)}<br><strong>Base processada em:</strong> ${esc(a.base)}<br><strong>Relatório exportado em:</strong> ${esc(new Date().toLocaleString('pt-BR'))}</p>
      <p class="nota">Análise automática descritiva, sujeita à validação da equipe. O registro local não possui assinatura eletrônica ou histórico de auditoria institucional.</p>
      <h2>Análise automática</h2>${corpo(a).replace('<details class="ac-limites">','<details class="ac-limites" open>')}
      <h2>Registro da equipe</h2>
      <p><strong>Situação:</strong> ${desatualizado?'Revisão pendente — a base mudou desde o registro':revisaoIncompleta?'Rascunho — identificação da revisão incompleta':esc(estados[fields.estado] || estados.rascunho)}</p>
      ${desatualizado?`<p class="nota">O registro da equipe se refere à base de ${esc(r?.base || 'data não informada')}. A análise automática acima usa a base atual; revisar a conclusão antes de utilizá-la.</p>`:''}
      <dl>${campos.map(([key,label])=>`<dt>${esc(label)}</dt><dd>${esc(fields[key] || 'Não preenchido')}</dd>`).join('')}</dl>
      <p>Último salvamento local: ${esc(r?.savedAt ? new Date(r.savedAt).toLocaleString('pt-BR') : 'não salvo; inclui os campos atuais do formulário')}. ${r?.dirty?'Este relatório inclui alterações atuais ainda não salvas no navegador.':''}</p>
      <h2>Referência e método</h2><p>Fonte dos números: dados agregados do dashboard. Percentuais, concentrações e comparações são calculados por regras descritivas; metas e causas não são inferidas automaticamente.</p>
      <p>Referência de apoio: <a href="${fonte}">JCI — padrões hospitalares, 8ª edição, QPS.03.00–QPS.03.04 e QPS.04.00</a>. A seção apoia a discussão e documentação da análise; não atesta conformidade ou acreditação.</p>
      <p>Para gerar PDF, use a opção Imprimir do navegador e escolha Salvar como PDF.</p></body></html>`;
  }
  if(typeof module==='object' && module.exports) { module.exports={relatorio,esc}; return; }
  const memoria=new Map();
  const chave=(aba,filtro)=>`qualidade:analise:v1:${aba}:${filtro}`;
  function obter(key) {
    if(memoria.has(key)) return memoria.get(key);
    let r={fields:{estado:'rascunho'}};
    try { const saved=JSON.parse(localStorage.getItem(key)); if(saved?.fields && typeof saved.fields==='object') r=saved; } catch(e) { /* Rascunho exportável permanece disponível. */ }
    memoria.set(key,r); return r;
  }
  function filtroAtual(aba) {
    const id=aba==='inspecoes'?'ins-anos':aba==='rounds'?'rd-anos':null;
    return id ? (document.querySelector(`#${id} button.ativo`)?.dataset.ano || 'total') : 'total';
  }
  function montar(aba) {
    const sec=document.getElementById(`aba-${aba}`);
    if(!sec) return;
    const a=AnaliseDados.gerar(DADOS,aba,filtroAtual(aba));
    const key=chave(aba,a.filtro), assinatura=AnaliseDados.assinatura(a), r=obter(key);
    const antigo=Boolean(r.assinatura && r.assinatura!==assinatura);
    let box=sec.querySelector('.analise-critica');
    if(!box) {box=document.createElement('section');box.className='analise-critica';(sec.querySelector('.kpis') || sec.lastElementChild).insertAdjacentElement('afterend',box);}
    box.setAttribute('aria-label',`Análise crítica — ${a.titulo}`);
    box.innerHTML=`<div class="ac-cabecalho"><div><span class="ac-selo">Análise crítica</span><h2>${esc(a.titulo)} · ${esc(a.periodo)}</h2></div><button type="button" class="ac-exportar">Exportar relatório (.html)</button></div>
      <p class="ac-subtitulo">Base processada em ${esc(a.base)} · Texto automático para validação pela equipe.</p>
      ${corpo(a)}
      <details class="ac-registro"><summary>Registro da equipe — causas, ações e avaliação de eficácia</summary>
        <p class="ac-privacidade">Rascunho salvo somente neste navegador, separado por aba e período. Não é publicado no site nem compartilhado com outros usuários. Exporte uma cópia para arquivar; limpar os dados do navegador remove os rascunhos. Não inclua identificadores de pacientes.</p>
        <p class="ac-base-antiga" ${antigo?'':'hidden'}>A base mudou desde o registro de ${esc(r.base || '')}. Revise a análise e salve novamente para registrar a avaliação da base atual.</p>
        <form class="ac-formulario"><div class="ac-campos">${campos.map(([field,label,type,placeholder])=>{
          const id=`ac-${aba}-${field}`;
          return `<div class="${type==='textarea'?'ac-largo':''}"><label for="${id}">${esc(label)}</label>${type==='textarea'?`<textarea id="${id}" name="${field}" rows="3" maxlength="8000" placeholder="${esc(placeholder)}">${esc(r.fields[field])}</textarea>`:`<input id="${id}" name="${field}" type="${type}" maxlength="500" value="${esc(r.fields[field])}" placeholder="${esc(placeholder)}">`}</div>`;
        }).join('')}
        <div><label for="ac-${aba}-estado">Situação do registro</label><select id="ac-${aba}-estado" name="estado">${Object.entries(estados).map(([value,label])=>`<option value="${value}" ${r.fields.estado===value?'selected':''}>${label}</option>`).join('')}</select></div></div>
        <div class="ac-rodape-form"><button type="submit">Salvar rascunho neste navegador</button><p class="ac-salvamento" role="status">${r.dirty?'Alterações ainda não salvas.':r.savedAt?`Salvo localmente em ${esc(new Date(r.savedAt).toLocaleString('pt-BR'))}.`:'Nenhum registro salvo neste recorte.'}</p></div></form>
      </details><details class="ac-metodo"><summary>Método e referência JCI</summary><p>Cálculos descritivos sobre os dados dos gráficos. Metas e causas devem ser confirmadas pela equipe; não há decisão automática de conformidade.</p><p><a href="${fonte}" target="_blank" rel="noopener noreferrer">Padrões hospitalares JCI, 8ª edição — QPS.03.00–QPS.03.04 e QPS.04.00</a>. Apoio à análise e documentação; não substitui a avaliação institucional nem atesta acreditação.</p></details>`;
    const form=box.querySelector('form'), message=box.querySelector('.ac-salvamento');
    form.addEventListener('input',()=>{r.fields=Object.fromEntries(new FormData(form));r.dirty=true;message.textContent='Alterações ainda não salvas. Salve ou exporte antes de fechar o navegador.';});
    form.addEventListener('submit',e=>{
      e.preventDefault();r.fields=Object.fromEntries(new FormData(form));
      if(r.fields.estado==='revisado' && (!r.fields.analista?.trim() || !r.fields.dataAnalise || !r.fields.conclusao?.trim())) {message.textContent='Para marcar como revisado, preencha conclusão, responsável pela análise e data da análise.';return;}
      const saved={fields:r.fields,assinatura,base:a.base,periodo:a.periodo,savedAt:new Date().toISOString(),dirty:false};
      try {localStorage.setItem(key,JSON.stringify(saved));Object.assign(r,saved);box.querySelector('.ac-base-antiga').hidden=true;message.textContent=`Salvo somente neste navegador em ${new Date(r.savedAt).toLocaleString('pt-BR')}.`;}
      catch(e) {message.textContent='Não foi possível salvar neste navegador. Exporte o relatório para preservar o registro.';}
    });
    box.querySelector('.ac-exportar').addEventListener('click',()=>{
      r.fields=Object.fromEntries(new FormData(form));
      const html=relatorio(a,r,Boolean(r.assinatura && r.assinatura!==assinatura));
      const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
      const link=document.createElement('a');link.href=url;link.download=`analise-critica-${aba}-${a.filtro}.html`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      message.textContent='Relatório exportado com os campos atuais. Abra o arquivo e use Imprimir para salvar em PDF.';
    });
  }
  for(const aba of Object.keys(AnaliseDados.TITULOS)) {
    const original=RENDER[aba];
    RENDER[aba]=function(...args) {const resultado=original.apply(this,args);montar(aba);return resultado;};
  }
  document.addEventListener('click',e=>{
    if(e.target.closest('#ins-anos button[data-ano]')) montar('inspecoes');
    if(e.target.closest('#rd-anos button[data-ano]')) montar('rounds');
  });
})();

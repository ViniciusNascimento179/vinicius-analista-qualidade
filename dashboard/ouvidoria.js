(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.Ouvidoria = api;
    RENDER.ouvidoria = () => api.montar(document.getElementById('aba-ouvidoria'), root.OuvidoriaDados);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = n => Number(n).toLocaleString('pt-BR');
  const percentual = (n,d) => d ? `${(100*n/d).toLocaleString('pt-BR',{maximumFractionDigits:1})}%` : '—';
  const cores = {'Elogio':'#16a34a','Queixa':'#dc2626','Solicitação':'#2563eb','Inadequação de Cliente':'#7c3aed','Não informado':'#94a3b8','Tipo não padronizado':'#64748b'};
  const ordenar = rows => rows.sort((a,b)=>b.total-a.total || a.nome.localeCompare(b.nome,'pt-BR'));
  function resumir(base, filtros={}) {
    const grupos = base.grupos.filter(g=>['ano','setor','tipo','status'].every(k=>!filtros[k] || filtros[k]==='todos' || g[k]===filtros[k]));
    const setores = new Map((filtros.setor && filtros.setor!=='todos' ? [filtros.setor] : base.setores).map(nome=>[nome,{nome,total:0,concluidos:0,tipos:{}}]));
    const tipos = new Map(), status = new Map(), motivos = new Map(), meses = new Map();
    let total=0, concluidos=0;
    for (const g of grupos) {
      total+=g.n;
      const fechado=g.status==='Concluído';
      if (fechado) concluidos+=g.n;
      if(!setores.has(g.setor)) setores.set(g.setor,{nome:g.setor,total:0,concluidos:0,tipos:{}});
      const s=setores.get(g.setor);s.total+=g.n;s.concluidos+=fechado?g.n:0;s.tipos[g.tipo]=(s.tipos[g.tipo]||0)+g.n;
      for(const [mapa,nome] of [[tipos,g.tipo],[status,g.status],[motivos,g.motivo],[meses,g.mes]]) mapa.set(nome,(mapa.get(nome)||0)+g.n);
    }
    const lista=m=>ordenar([...m].map(([nome,total])=>({nome,total})));
    return {total,concluidos,naoConcluidos:total-concluidos,setores:ordenar([...setores.values()]),tipos:lista(tipos),status:lista(status),motivos:lista(motivos),meses:lista(meses).sort((a,b)=>a.nome.localeCompare(b.nome)),grupos};
  }
  function analise(s) {
    if(!s.total) return ['Não há registros para a combinação de filtros selecionada.'];
    const resultados=[`O recorte reúne ${num(s.total)} registros, dos quais ${num(s.concluidos)} estão concluídos (${percentual(s.concluidos,s.total)}). Os demais ${num(s.naoConcluidos)} não estão marcados como concluídos na planilha.`];
    const queixas=s.tipos.find(t=>t.nome==='Queixa')?.total||0;
    const elogios=s.tipos.find(t=>t.nome==='Elogio')?.total||0;
    const solicitacoes=s.tipos.find(t=>t.nome==='Solicitação')?.total||0;
    resultados.push(`São ${num(queixas)} queixas, ${num(elogios)} elogios e ${num(solicitacoes)} solicitações. Os percentuais expressam a distribuição dos registros de ouvidoria, não uma taxa de satisfação dos pacientes.`);
    const setor=s.setores.find(t=>t.total&&!['Não informado','Setor não padronizado'].includes(t.nome));
    if(setor) resultados.push(`${setor.nome} concentra ${num(setor.total)} registros (${percentual(setor.total,s.total)} do recorte). O volume deve ser interpretado em conjunto com a quantidade de atendimentos de cada setor, não disponível nesta base.`);
    const motivos=s.motivos.filter(m=>!['Não informado','Motivo não padronizado','Elogio'].includes(m.nome)).slice(0,3);
    if(motivos.length) resultados.push(`Os principais motivos classificados, excluindo o motivo “Elogio”, são: ${motivos.map(m=>`${m.nome} (${num(m.total)})`).join('; ')}. O filtro de tipo permite analisar separadamente queixas e solicitações.`);
    resultados.push('O status “Concluído” indica encerramento registrado. A base não permite afirmar, por esse status, que a causa foi eliminada ou que o solicitante ficou satisfeito.');
    return resultados;
  }
  function barras(rows, total, segmentado=false) {
    const max=Math.max(1,...rows.map(r=>r.total));
    return `<div class="ouv-escala" aria-hidden="true"><span>0</span><span>${num(max)} registros</span></div><ol class="ouv-barras">${rows.map(r=>`<li class="ouv-barra"><span class="ouv-barra-label">${esc(r.nome)}</span><span class="ouv-trilho" aria-hidden="true"><span class="ouv-segmento" style="width:${100*(segmentado?r.concluidos:r.total)/max}%;background:${segmentado?'#16a34a':'#2563eb'}"></span>${segmentado?`<span class="ouv-segmento" style="width:${100*(r.total-r.concluidos)/max}%;background:#d97706"></span>`:''}</span><strong title="${percentual(r.total,total)} do recorte${segmentado?`; ${r.concluidos} concluídos`:''}">${num(r.total)}</strong></li>`).join('')}</ol>`;
  }
  const mesesNomes=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  function mensal(base,ano,filtros={}) {
    const observado=new Set(base.grupos.map(g=>g.mes));
    const fim=base.fim||'';
    const ultimoDia=fim?new Date(Date.UTC(Number(fim.slice(0,4)),Number(fim.slice(5,7)),0)).getUTCDate():0;
    const parcial=fim&&Number(fim.slice(8,10))<ultimoDia?fim.slice(0,7):'';
    const grupos=base.grupos.filter(g=>g.tipo==='Queixa'&&['setor','status'].every(k=>!filtros[k]||filtros[k]==='todos'||g[k]===filtros[k]));
    const periodo=(a,m)=>{
      const chave=`${a}-${String(m).padStart(2,'0')}`,mapa=new Map();
      let total=0,semSetor=0;
      for(const g of grupos) if(g.mes===chave) {
        total+=g.n;
        if(['Não informado','Setor não padronizado'].includes(g.setor)) semSetor+=g.n;
        else mapa.set(g.setor,(mapa.get(g.setor)||0)+g.n);
      }
      return {chave,total,semSetor,disponivel:observado.has(chave),parcial:chave===parcial,top:ordenar([...mapa].map(([nome,total])=>({nome,total}))).slice(0,5)};
    };
    const atual=mesesNomes.map((_,i)=>periodo(ano,i+1));
    const anterior=mesesNomes.map((_,i)=>periodo(Number(ano)-1,i+1));
    return {ano:String(ano),atual,anterior,dezembroAnterior:periodo(Number(ano)-1,12)};
  }
  function farol(atual,referencia) {
    if(!atual.disponivel) return {classe:'sem',texto:'SEM DADOS'};
    if(!referencia.disponivel) return {classe:'sem',texto:'SEM BASE'};
    const marca=atual.parcial||referencia.parcial?'*':'';
    if(atual.total===referencia.total) return {classe:'estavel',texto:'ESTÁVEL'+marca};
    return atual.total<referencia.total?{classe:'favoravel',texto:'FAVORÁVEL'+marca}:{classe:'desfavoravel',texto:'DESFAVORÁVEL'+marca};
  }
  function quadrosMensais(base,filtros) {
    if(filtros.ano==='Sem data') return '<p class="ouv-recorte">Os quadros mensais exigem data de abertura. Selecione um ano para consultá-los.</p>';
    if(filtros.tipo&& !['todos','Queixa'].includes(filtros.tipo)) return '<p class="ouv-recorte">Para visualizar os dois quadros mensais de queixas, selecione “Todos os tipos” ou “Queixa”.</p>';
    const anos=filtros.ano==='todos'?base.anos.filter(a=>/^\d{4}$/.test(a)).sort().reverse():[filtros.ano];
    const celula=p=>`<td class="ouv-mes-num ${p.disponivel?'':'ouv-sem'}">${p.disponivel?num(p.total)+(p.parcial?'*':''):'—'}</td>`;
    const sinal=(a,b)=>{const f=farol(a,b);return `<td class="ouv-farol ouv-${f.classe}">${f.texto}</td>`;};
    const total=ps=>num(ps.reduce((s,p)=>s+p.total,0));
    const cor=nome=>{
      if(nome==='Central de Agendamento') return '#e7e6e6';
      if(/Radiologia/.test(nome)) return '#ddebf7';
      if(/Laboratório/.test(nome)) return '#c6e0b4';
      if(/Médico PS/.test(nome)) return '#f8cbad';
      if(/Enfermagem PS/.test(nome)) return '#ffe699';
      if(/Secretaria/.test(nome)) return '#bdd7ee';
      if(/Convênios|Autoriza/.test(nome)) return '#e4b7e5';
      const paleta=['#e2f0d9','#fff2cc','#d9e1f2','#fce4d6','#d0e0e3'];
      return paleta[[...nome].reduce((n,c)=>n+c.charCodeAt(0),0)%paleta.length];
    };
    return `<div class="ouv-quadros"><p class="ouv-nota">Queixas por data de abertura · filtros de setor e status aplicados. Arraste as tabelas para os lados para ver todos os meses.</p>${anos.map(ano=>{
      const m=mensal(base,ano,filtros);
      return `<section class="ouv-planilha" aria-label="Painéis mensais ${esc(ano)}">
        <h2 class="ouv-faixa">Painel Resumo ${esc(ano)}</h2>
        <div class="ouv-matriz-scroll" tabindex="0" role="region" aria-label="Resumo mensal de queixas de ${esc(ano)}"><table class="ouv-matriz ouv-resumo"><caption class="ouv-sr">Queixas mensais de ${esc(ano)} e ${Number(ano)-1}</caption>
        <thead><tr><th scope="col">Indicador</th><th scope="col">Unidade</th><th scope="col">Referência</th>${mesesNomes.map(n=>`<th scope="col">${n}</th>`).join('')}<th scope="col">Total</th></tr></thead>
        <tbody><tr><th rowspan="3" scope="rowgroup">Queixas Ouvidoria</th><th rowspan="3" scope="rowgroup">Hub Campinas</th><th scope="row">${Number(ano)-1}</th>${m.anterior.map(celula).join('')}<td>${m.anterior.some(p=>p.disponivel)?total(m.anterior):'—'}</td></tr>
        <tr><th scope="row">Farol · ano anterior</th>${m.atual.map((p,i)=>sinal(p,m.anterior[i])).join('')}<td class="ouv-sem">—</td></tr>
        <tr><th scope="row">${esc(ano)}</th>${m.atual.map(celula).join('')}<td class="ouv-total">${total(m.atual)}</td></tr>
        <tr><th colspan="3" scope="row">Comparativo mês anterior</th>${m.atual.map((p,i)=>sinal(p,i?m.atual[i-1]:m.dezembroAnterior)).join('')}<td class="ouv-sem">—</td></tr></tbody></table></div>
        <p class="ouv-nota ouv-regras">Farol: ${esc(ano)} versus o mesmo mês de ${Number(ano)-1}. Comparativo: mês imediatamente anterior, inclusive dezembro para janeiro. Menor volume = favorável; maior = desfavorável; igual = estável. “Sem dados” indica mês sem registros na base; “Sem base”, ausência de referência. * Mês parcial até ${esc(base.fim?.split('-').reverse().join('/')||'a data da base')}: comparações provisórias, pois o mês ainda não está completo.</p>
        <h3 class="ouv-top-titulo">Top Queixas Mensal HUB Campinas - Via Ouvidoria · ${esc(ano)}</h3>
        <div class="ouv-matriz-scroll" tabindex="0" role="region" aria-label="Cinco principais setores por mês de ${esc(ano)}"><table class="ouv-matriz ouv-top"><caption class="ouv-sr">Cinco setores com mais queixas por mês, volume e participação</caption><colgroup>${mesesNomes.map(()=>'<col class="ouv-col-setor"><col class="ouv-col-vol"><col class="ouv-col-pct">').join('')}</colgroup>
        <thead><tr>${mesesNomes.map((n,i)=>`<th scope="col">${n}${m.atual[i].parcial?'*':''}</th><th scope="col">Vol.</th><th scope="col">%</th>`).join('')}</tr></thead>
        <tbody>${Array.from({length:5},(_,i)=>`<tr>${m.atual.map(p=>{const r=p.top[i];return r?`<td class="ouv-top-setor" style="background:${cor(r.nome)}" title="${esc(r.nome)}">${esc(r.nome)}</td><td>${num(r.total)}</td><td>${percentual(r.total,p.total)}</td>`:`<td class="ouv-sem">${i===0?(!p.disponivel?'Sem dados':p.total?'Sem setor identificado':'Sem queixas'):'—'}</td><td class="ouv-sem">—</td><td class="ouv-sem">—</td>`;}).join('')}</tr>`).join('')}</tbody>
        <tfoot><tr>${m.atual.map(p=>`<th scope="row">Total de queixas</th><td>${p.disponivel?num(p.total):'—'}</td><td>${p.disponivel&&p.total?'100%':'—'}</td>`).join('')}</tr><tr>${m.atual.map(p=>`<th scope="row">Sem setor identificado</th><td>${p.disponivel?num(p.semSetor):'—'}</td><td>${p.disponivel?percentual(p.semSetor,p.total):'—'}</td>`).join('')}</tr></tfoot></table></div>
        <p class="ouv-nota ouv-regras">Ranking por setor, com nomes padronizados da base. Percentuais sobre todas as queixas do mês no recorte; os cinco primeiros não precisam somar 100%. Registros sem setor identificado ficam no rodapé. Cores identificam setores e se repetem entre meses. Dados calculados da base atual, podendo diferir da imagem de referência.</p>
      </section>`;
    }).join('')}</div>`;
  }
  function montar(sec,base) {
    if(!sec) return;
    if(!base?.grupos) {sec.innerHTML='<p class="ouv-vazio">A base da ouvidoria não está disponível.</p>';return;}
    const options=(values,label)=>`<option value="todos">${label}</option>${values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}`;
    const todosTipos=[...new Set([...base.tipos,...base.grupos.map(g=>g.tipo)])];
    const todosStatus=[...new Set([...base.status,...base.grupos.map(g=>g.status)])];
    const anoPadrao=base.anos.filter(a=>/^\d{4}$/.test(a)).sort().at(-1)||'todos';
    sec.innerHTML=`<div class="ouv-titulo"><div><h2>Ouvidoria</h2><p>Manifestações, conclusão e motivos por setor</p></div><span>Dados até ${base.fim?base.fim.split('-').reverse().join('/'):'data não informada'}</span></div>
      <div class="ouv-filtros"><label>Ano de abertura<select id="ouv-ano">${options(base.anos,'Todos os anos')}</select></label><label class="ouv-setor">Setor<select id="ouv-setor">${options(base.setores,'Todos os setores')}</select></label><label>Tipo<select id="ouv-tipo">${options(todosTipos,'Todos os tipos')}</select></label><label>Status<select id="ouv-status">${options(todosStatus,'Todos os status')}</select></label><button id="ouv-limpar" type="button">Limpar filtros</button></div>
      <p id="ouv-recorte" class="ouv-recorte" aria-live="polite"></p><label class="ouv-check"><input type="checkbox" id="ouv-ajustar">Encaixar os 12 meses na tela (visualização compacta)</label><div id="ouv-mensais"></div><div id="ouv-conteudo"></div>`;
    const selects=Object.fromEntries(['ano','setor','tipo','status'].map(k=>[k,sec.querySelector(`#ouv-${k}`)]));
    selects.ano.value=anoPadrao;
    sec.querySelector('#ouv-ajustar').addEventListener('change',e=>sec.querySelector('#ouv-mensais').classList.toggle('ouv-compacto',e.target.checked));
    let incluirZeros=false;
    function atualizar() {
      const filtros=Object.fromEntries(Object.entries(selects).map(([k,s])=>[k,s.value]));
      const s=resumir(base,filtros),valor=tipo=>s.tipos.find(t=>t.nome===tipo)?.total||0;
      sec.querySelector('#ouv-mensais').innerHTML=quadrosMensais(base,filtros);
      const periodo=filtros.ano==='todos'?'Todos os anos':filtros.ano;
      const setoresComRegistro=s.setores.filter(t=>t.total>0);
      const quantidadeSetores=setoresComRegistro.filter(t=>!['Não informado','Setor não padronizado'].includes(t.nome)).length;
      const setoresVisiveis=incluirZeros?s.setores:setoresComRegistro;
      const motivoTop=s.motivos.slice(0,10);
      const outrosTipos=s.tipos.filter(t=>!['Queixa','Elogio','Solicitação'].includes(t.nome)).reduce((a,t)=>a+t.total,0);
      const semMotivo=s.motivos.find(m=>m.nome==='Não informado')?.total||0;
      const setorPendente=s.setores.find(m=>m.nome==='Setor não padronizado')?.total||0;
      const semSetor=s.setores.find(m=>m.nome==='Não informado')?.total||0;
      sec.querySelector('#ouv-recorte').textContent=`${periodo} · ${filtros.setor==='todos'?'Todos os setores':filtros.setor} · ${filtros.tipo==='todos'?'Todos os tipos':filtros.tipo} · ${filtros.status==='todos'?'Todos os status':filtros.status} · ${num(s.total)} registros`;
      const card=(label,value,detail,cor='')=>`<div class="kpi ${cor}"><div class="rotulo">${label}</div><div class="valor">${value}</div><div class="detalhe">${detail}</div></div>`;
      const distrib=(rows,cor)=>rows.map(r=>`<div class="ouv-tipo"><div><span>${esc(r.nome)}</span><span><strong>${num(r.total)}</strong><small>${percentual(r.total,s.total)}</small></span></div><div class="ouv-trilho" aria-hidden="true"><span class="ouv-segmento" style="width:${s.total?100*r.total/s.total:0}%;background:${cor(r.nome)}"></span></div></div>`).join('');
      sec.querySelector('#ouv-conteudo').innerHTML=`${!s.total?'<p class="ouv-vazio" role="status">Nenhum registro corresponde aos filtros. Altere o ano, setor, tipo ou status para consultar outros resultados.</p>':''}<div class="kpis">
        ${card('Registros',num(s.total),`${num(quantidadeSetores)} ${quantidadeSetores===1?'setor identificado':'setores identificados'}`,'info')}
        ${card('Concluídos',num(s.concluidos),`${percentual(s.concluidos,s.total)} do recorte`,'ok')}
        ${card('Não concluídos',num(s.naoConcluidos),'Demais status da planilha','warn')}
        ${card('Elogios',num(valor('Elogio')),`${percentual(valor('Elogio'),s.total)} do recorte`,'ok')}
        ${card('Queixas',num(valor('Queixa')),`${percentual(valor('Queixa'),s.total)} do recorte`,'bad')}
        ${card('Solicitações',num(valor('Solicitação')),`${percentual(valor('Solicitação'),s.total)} do recorte`,'info')}
      </div>${semMotivo||setorPendente||semSetor?`<p class="ouv-recorte">Campos a completar neste recorte: ${num(semMotivo)} registros sem motivo, ${num(semSetor)} sem setor e ${num(setorPendente)} com setor não padronizado.</p>`:''}<div class="grade ouv-grade">
      <section class="painel"><h2>Registros por setor</h2><p class="ouv-nota">Todos os setores com registros no recorte, em ordem de volume. Role para consultar a lista completa.</p><div class="ouv-legenda"><span style="--cor:#16a34a">Concluídos</span><span style="--cor:#d97706">Não concluídos</span></div><label class="ouv-check"><input type="checkbox" id="ouv-zeros" ${incluirZeros?'checked':''}>Incluir setores cadastrados sem registros no recorte</label><div class="ouv-scroll" tabindex="0" aria-label="Gráfico de barras horizontais de todos os setores">${barras(setoresVisiveis,s.total,true)}</div><p class="ouv-nota">${setoresVisiveis.length} setores exibidos · ${num(s.total)} registros no total</p></section>
      <section class="painel"><h2>Tipos de manifestação</h2>${distrib(s.tipos,n=>cores[n]||'#64748b')}<p class="ouv-nota">${outrosTipos?`${num(outrosTipos)} registros em outros tipos ou sem tipo informado.`:'Distribuição dos registros no recorte selecionado.'}</p><div class="ouv-status"><h3>Situação das manifestações</h3>${distrib(s.status,n=>n==='Concluído'?'#16a34a':n==='Em andamento'?'#d97706':'#64748b')}<p class="ouv-nota">Conclusão conforme o campo Status, independentemente da data de conclusão.</p></div></section>
      <section class="painel full"><h2>Principais motivos</h2><p class="ouv-nota">${motivoTop.length} motivos mais frequentes entre ${s.motivos.length} no recorte. Use o filtro Tipo para ver somente queixas, elogios ou solicitações.</p>${barras(motivoTop,s.total)}<details class="ouv-detalhes"><summary>Consultar todos os motivos (${s.motivos.length})</summary><div class="ouv-tabela"><table><caption>Contagens e participação no recorte</caption><thead><tr><th scope="col">Motivo</th><th scope="col">Registros</th><th scope="col">Participação</th></tr></thead><tbody>${s.motivos.map(m=>`<tr><td>${esc(m.nome)}</td><td>${num(m.total)}</td><td>${percentual(m.total,s.total)}</td></tr>`).join('')}</tbody></table></div></details></section>
      <section class="painel full"><details class="ouv-detalhes"><summary>Resumo por setor: conclusão e tipos</summary><div class="ouv-tabela"><table><caption>Todos os setores com registros no recorte</caption><thead><tr>${['Setor','Total','Concluídos','Conclusão','Elogios','Queixas','Solicitações','Outros / sem tipo'].map(t=>`<th scope="col">${t}</th>`).join('')}</tr></thead><tbody>${setoresComRegistro.map(r=>`<tr><td>${esc(r.nome)}</td><td>${num(r.total)}</td><td>${num(r.concluidos)}</td><td>${percentual(r.concluidos,r.total)}</td><td>${num(r.tipos.Elogio||0)}</td><td>${num(r.tipos.Queixa||0)}</td><td>${num(r.tipos['Solicitação']||0)}</td><td>${num(r.total-(r.tipos.Elogio||0)-(r.tipos.Queixa||0)-(r.tipos['Solicitação']||0))}</td></tr>`).join('')}</tbody></table></div></details></section>
      <section class="painel full"><details class="ouv-detalhes"><summary>Critérios de contagem e qualidade da base</summary><ul><li>O ano vem da data de abertura. A base contém ${esc(base.anos.join(', '))}; datas foram preservadas como preenchidas. ${num(base.qualidade.sem_data_valida||0)} registros sem data válida ficam na opção “Sem data”, sem atribuir o ano pelo nome da aba.</li><li>Cada linha preenchida conta como um registro. ${num(base.qualidade.linhas_modelo_ignoradas||0)} linhas de modelo com apenas número de BO foram excluídas. ${num(base.qualidade.numeros_bo_repetidos||0)} números de BO aparecem em mais de uma linha e foram mantidos, pois os registros podem representar manifestações distintas.</li>${base.historico?`<li>Foram acrescentados ${num(base.qualidade.registros_historicos_adicionados||0)} registros do histórico. Outros ${num(base.qualidade.registros_historicos_ja_presentes||0)} já estavam na base atual e não foram contados novamente. A conferência entre arquivos usa BO e paciente somente durante o processamento local, uma correspondência por linha, preservando os campos da fonte atual.</li>`:''}<li>Motivos seguem o catálogo e correspondências exatas revisadas. Rótulos genéricos antigos conservam a indicação “histórico”. Relatos sem correspondência são “Motivo não padronizado”, sem interpretar seu conteúdo. Campos vazios são “Não informado”. No recorte: ${num(s.motivos.find(m=>m.nome==='Motivo não padronizado')?.total||0)} motivos não padronizados e ${num(semMotivo)} motivos não informados.</li><li>Setores antigos usam o de-para da fonte e equivalências explícitas de grafia. Sem correspondência segura, o registro fica em “Setor não padronizado”. No recorte: ${num(setorPendente)} registros nessa situação e ${num(semSetor)} sem setor informado. Esses grupos não representam setores institucionais.</li><li>São utilizados somente dados agregados. Nomes de pacientes e responsáveis, números de BO, descrições e observações não integram a base do painel.</li></ul></details></section>
      </div><p class="ouv-fonte">Fonte: ${esc(base.fonte)} · ${esc(base.abas.join(', '))}. Atualização independente dos demais painéis.</p>
      <section class="analise-critica ouv-analise" aria-label="Análise crítica — Ouvidoria"><div class="ac-cabecalho"><div><span class="ac-selo">Análise crítica</span><h2>Ouvidoria · ${esc(periodo)}</h2></div></div><p class="ac-subtitulo">Leitura descritiva do recorte selecionado</p><div data-ac-edit="paragrafos" data-ac-tipo="lista" data-ac-classe="ouv-paragrafo" aria-label="Texto da análise crítica da Ouvidoria">${analise(s).map(p=>`<p class="ouv-paragrafo">${esc(p)}</p>`).join('')}</div></section>`;
      sec.querySelector('#ouv-zeros').addEventListener('change',e=>{incluirZeros=e.target.checked;atualizar();});
      if(typeof AnaliseEditor!=='undefined') AnaliseEditor.montar({box:sec.querySelector('.analise-critica'),aba:'ouvidoria',filtro:JSON.stringify(filtros),base:{fonte:base.fonte,grupos:s.grupos}});
    }
    Object.values(selects).forEach(el=>el.addEventListener('change',atualizar));
    sec.querySelector('#ouv-limpar').addEventListener('click',()=>{Object.values(selects).forEach(el=>{el.value='todos';});atualizar();});
    atualizar();
  }
  return {resumir,analise,montar,percentual,mensal,farol,quadrosMensais};
});

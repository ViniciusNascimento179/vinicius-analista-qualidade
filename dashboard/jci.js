(function(){
  'use strict';
  const C=window.JciCore,base=window.JciDados;
  if(!C||!base)return;
  const rows=C.registros(base),esc=C.esc;
  const formato=n=>Number(n).toLocaleString('pt-BR');
  const classes={C:'ok',NC:'bad',NA:'mut'};
  const cores={C:'#1b9069',NC:'#c94f55',NA:'#99a9ba'};
  const estado={ano:'2026',avaliacao:'cba-2026-10',capitulo:'todos',classificacao:'todas',busca:'',pagina:1,tamanho:25};
  const options=(xs,valor)=>xs.map(([v,t])=>`<option value="${esc(v)}" ${String(v)===String(valor)?'selected':''}>${esc(t)}</option>`).join('');
  const notaConferencia='A tabela-resumo da página 167 soma 1.109 elementos: 859 C, 181 NC e 69 NA. O corpo do relatório inclui também GLD.02.00 — EM 2, marcado “PC” na página 100. Por isso, esta biblioteca contém 1.110 elementos. Conforme correção informada pela equipe, esse elemento é contabilizado como Não conforme: o total corrigido é 859 conformes, 182 não conformes e 69 não se aplica. O registro original PC permanece visível no elemento; o PDF não foi alterado.';
  function avaliacoes(){return base.avaliacoes.filter(a=>estado.ano==='todos'||String(a.ano)===estado.ano);}
  function atualizarAvaliacoes(sec){
    const lista=avaliacoes();
    if(estado.avaliacao!=='todas'&&!lista.some(a=>a.id===estado.avaliacao))estado.avaliacao=lista[0]?.id||'todas';
    sec.querySelector('[name=avaliacao]').innerHTML=options([['todas','Todas as avaliações'],...lista.map(a=>[a.id,a.nome])],estado.avaliacao);
  }
  function resumo(sec,selecionados){
    const s=C.resumir(selecionados);
    sec.querySelector('#jci-indicadores').innerHTML=[['total','Elementos no recorte','info'],['C','Conformes','ok'],['NC','Não conformes','bad'],['NA','Não se aplica','mut']].map(([k,label,cls])=>`<div class="kpi ${cls}"><div class="rotulo">${label}</div><div class="valor">${formato(s[k])}</div><div class="detalhe">${k==='total'?'Todos os filtros selecionados':C.nomes[k]}</div></div>`).join('');
    const capitulos=C.capitulos(selecionados);
    sec.querySelector('#jci-resumo-capitulos').innerHTML=capitulos.length?`<div class="jci-tabela"><table><caption class="jci-nota">Distribuição dos elementos encontrados. Clique no capítulo para filtrar a biblioteca.</caption><thead><tr><th>Capítulo</th><th>Total</th><th>C</th><th>NC</th><th>NA</th><th>Distribuição</th></tr></thead><tbody>${capitulos.map(c=>`<tr><td><button type="button" class="jci-capitulo" data-capitulo="${c.id}">${c.id} — ${esc(c.nome)}</button></td><td><strong>${c.total}</strong></td>${['C','NC','NA'].map(k=>`<td>${c[k]}</td>`).join('')}<td><div class="jci-barra" aria-hidden="true">${['C','NC','NA'].map(k=>`<span style="width:${100*c[k]/c.total}%;background:${cores[k]}"></span>`).join('')}</div></td></tr>`).join('')}</tbody></table></div>`:'<p class="vazio">Nenhum elemento corresponde aos filtros.</p>';
    const aplicaveis=s.C+s.NC;
    sec.querySelector('#jci-leitura').textContent=s.total?`${formato(s.total)} elementos encontrados em ${capitulos.length} capítulo(s). ${formato(s.C)} conformes, ${formato(s.NC)} não conformes, ${formato(s.NA)} não se aplica. Os números representam a avaliação, com a correção PC → Não conforme informada pela equipe. ${aplicaveis?'A conclusão de um plano de ação deve ser acompanhada de reavaliação e não altera esse histórico.':''}`:'Não há elementos para esta combinação. Altere os filtros ou limpe a busca.';
  }
  function listar(sec,selecionados){
    const tamanho=estado.tamanho==='todos'?Math.max(1,selecionados.length):Number(estado.tamanho);
    const paginas=Math.max(1,Math.ceil(selecionados.length/tamanho));
    estado.pagina=Math.max(1,Math.min(estado.pagina,paginas));
    const inicio=(estado.pagina-1)*tamanho,lista=selecionados.slice(inicio,inicio+tamanho);
    sec.querySelector('#jci-resultados').textContent=selecionados.length?`${formato(selecionados.length)} elementos encontrados · mostrando ${formato(inicio+1)}–${formato(inicio+lista.length)}.`:'Nenhum elemento encontrado.';
    sec.querySelector('#jci-lista').innerHTML=lista.map(e=>`<details class="jci-elemento" data-elemento="${esc(e.id)}"><summary><div><div class="jci-elemento-head"><span class="jci-elemento-id">${esc(e.padrao)} · EM ${e.numero}</span><span class="badge ${classes[e.classificacao]}">${C.nomes[e.classificacao]}</span><span class="jci-nota">${esc(e.capituloNome)}</span></div><p class="jci-elemento-preview">${esc(e.texto.length>180?e.texto.slice(0,180)+'…':e.texto)}</p></div></summary>${C.conteudo(e)}</details>`).join('')||'<p class="vazio">Experimente outro capítulo, classificação ou termo de busca.</p>';
    sec.querySelector('#jci-pagina-atual').textContent=`Página ${estado.pagina} de ${paginas}`;
    sec.querySelector('[data-jci=anterior]').disabled=estado.pagina===1;
    sec.querySelector('[data-jci=proxima]').disabled=estado.pagina>=paginas;
    for(const tipo of ['exportar','abrir','fechar'])sec.querySelector(`[data-jci=${tipo}]`).disabled=!lista.length;
  }
  function atualizar(sec){const selecionados=C.filtrar(rows,estado);resumo(sec,selecionados);listar(sec,selecionados);}
  function comites(){
    const j=DADOS.jci;
    return `<details class="painel jci-comites"><summary>Planos dos comitês e checklist interno anterior</summary>
      <p class="jci-nota">Base independente: ${formato(j.comites_total)} planos dos comitês. Os filtros do relatório CBA acima não se aplicam a esta lista. Ainda não há vínculo validado entre cada plano e os elementos desta avaliação.</p>
      <div class="jci-tabela"><table><thead><tr><th>Comitê</th><th>Data</th><th>Plano de ação</th><th>Responsáveis</th><th>Prazo</th><th>Situação</th></tr></thead><tbody>${j.comites_lista.map(p=>`<tr><td>${esc(p.comite)}</td><td>${esc(p.data)}</td><td>${esc(p.plano)}</td><td>${esc(p.responsaveis)}</td><td>${esc(p.prazo)}</td><td>${esc(p.status)}</td></tr>`).join('')}</tbody></table></div>
      <p class="jci-nota">Checklist interno anterior, sem data de avaliação nos agregados: ${formato(j.total_elementos)} elementos cadastrados. ${Object.entries(j.classes).map(([k,v])=>`${esc(k)}: ${formato(v)}`).join(' · ')}. Essa base não foi somada ao relatório CBA.</p></details>`;
  }
  RENDER.jci=function(){
    const sec=document.getElementById('aba-jci');
    const anos=[...new Set(base.avaliacoes.map(a=>String(a.ano)))].sort().reverse();
    const caps=[...new Map(base.avaliacoes.flatMap(a=>a.capitulos).map(c=>[c.id,c])).values()];
    sec.innerHTML=`<div class="jci-cabecalho"><div><h2>JCI · Biblioteca de elementos de mensuração</h2><p>Consulte o requisito completo, a classificação, os achados e as recomendações da avaliação.</p></div><span class="jci-selo">CBA · visita de 27 a 30/10/2026</span></div>
      <form class="jci-filtros" aria-label="Filtros dos elementos de mensuração">
        <label>Ano<select name="ano">${options([['todos','Todos'],...anos.map(a=>[a,a])],estado.ano)}</select></label>
        <label>Avaliação<select name="avaliacao"></select></label>
        <label>Capítulo<select name="capitulo">${options([['todos','Todos os capítulos'],...caps.map(c=>[c.id,`${c.id} — ${c.nome}`])],estado.capitulo)}</select></label>
        <label>Classificação<select name="classificacao">${options([['todas','Todas'],...Object.entries(C.nomes)],estado.classificacao)}</select></label>
        <label class="jci-busca">Buscar código, requisito, achado ou recomendação<input type="search" name="busca" value="${esc(estado.busca)}" placeholder="Ex.: QPS.04.00, higienização, treinamento…" autocomplete="off"></label>
        <button type="button" class="jci-btn jci-limpar" data-jci="limpar">Limpar filtros</button>
      </form>
      <div class="kpis jci-kpis" id="jci-indicadores"></div>
      <details class="jci-conferencia"><summary>Fonte, critérios de contagem e diferença no resumo</summary><p>${notaConferencia}</p><p>Fonte: Relatório da Avaliação de Manutenção — Hospital Vera Cruz, Campinas, outubro de 2026. Manual indicado no documento: 8ª edição, 2024. Os totais originais de C, NC e NA foram conferidos por capítulo com a página 167; o painel acrescenta à contagem de não conformes o elemento originalmente registrado como PC. Os percentuais dos gráficos do PDF não foram usados para recalcular os elementos.</p><p>O texto integral foi extraído do PDF, com normalização de espaços e quebras de linha. A letra D, quando presente, foi mantida como no documento. As recomendações pertencem ao padrão e podem abranger vários elementos. Campos vazios da fonte são identificados como sem registro.</p><p>Há uma avaliação datada disponível. O checklist interno anterior não possui data nos agregados e permanece separado; não foi atribuído a um ano por suposição.</p></details>
      <section class="painel"><h2>Elementos por capítulo</h2><div class="jci-legenda">${Object.entries(C.nomes).map(([k,n])=>`<span><i style="background:${cores[k]}"></i>${k} · ${n}</span>`).join('')}</div><div id="jci-resumo-capitulos"></div></section>
      <section class="painel jci-biblioteca"><div class="jci-biblioteca-topo"><div><h2>Leitura completa dos elementos</h2><p id="jci-resultados" role="status" aria-live="polite" class="jci-nota"></p></div><div class="jci-acoes"><button class="jci-btn" data-jci="abrir">Abrir elementos desta página</button><button class="jci-btn" data-jci="fechar">Recolher</button><button class="jci-btn" data-jci="exportar">Exportar seleção completa</button></div></div>
        <p class="jci-nota">Abra um elemento para ler todo o conteúdo. Para uma leitura contínua, escolha “Todos” em elementos por página e abra os elementos.</p>
        <div class="jci-paginacao"><label>Elementos por página<select name="tamanho">${options([[25,'25'],[50,'50'],[100,'100'],['todos','Todos']],estado.tamanho)}</select></label><nav aria-label="Páginas da biblioteca JCI"><button data-jci="anterior">Anterior</button><span id="jci-pagina-atual"></span><button data-jci="proxima">Próxima</button></nav></div><div id="jci-lista"></div>
      </section><section class="painel jci-biblioteca"><h2>Leitura do recorte</h2><p class="jci-nota" id="jci-leitura"></p></section>${comites()}`;
    atualizarAvaliacoes(sec);atualizar(sec);
    sec.querySelector('form').addEventListener('submit',e=>e.preventDefault());
    let timer;
    sec.addEventListener('input',e=>{
      if(e.target.name!=='busca')return;
      estado.busca=e.target.value;estado.pagina=1;clearTimeout(timer);timer=setTimeout(()=>atualizar(sec),160);
    });
    sec.addEventListener('change',e=>{
      if(!['ano','avaliacao','capitulo','classificacao','tamanho'].includes(e.target.name))return;
      estado[e.target.name]=e.target.value;estado.pagina=1;
      if(e.target.name==='ano')atualizarAvaliacoes(sec);
      atualizar(sec);
    });
    sec.addEventListener('click',e=>{
      const cap=e.target.closest('[data-capitulo]');
      if(cap){estado.capitulo=cap.dataset.capitulo;estado.pagina=1;sec.querySelector('[name=capitulo]').value=estado.capitulo;atualizar(sec);return;}
      const btn=e.target.closest('[data-jci]');if(!btn)return;
      const acao=btn.dataset.jci;
      if(acao==='abrir'||acao==='fechar')sec.querySelectorAll('.jci-elemento').forEach(d=>d.open=acao==='abrir');
      if(acao==='anterior'||acao==='proxima'){estado.pagina+=acao==='anterior'?-1:1;listar(sec,C.filtrar(rows,estado));sec.querySelector('.jci-biblioteca').scrollIntoView({block:'start'});}
      if(acao==='limpar'||acao==='ver-pc'){
        Object.assign(estado,{ano:'todos',avaliacao:'todas',capitulo:acao==='ver-pc'?'GLD':'todos',classificacao:acao==='ver-pc'?'NC':'todas',busca:acao==='ver-pc'?'GLD.02.00.EM2':'',pagina:1});
        for(const name of ['ano','capitulo','classificacao','busca'])sec.querySelector(`[name=${name}]`).value=estado[name];
        atualizarAvaliacoes(sec);atualizar(sec);
        if(acao==='ver-pc'){sec.querySelector('.jci-elemento').open=true;sec.querySelector('.jci-biblioteca').scrollIntoView({block:'start'});}
      }
      if(acao==='exportar'){
        const url=URL.createObjectURL(new Blob([C.exportar(C.filtrar(rows,estado),estado)],{type:'text/html;charset=utf-8'}));
        const a=document.createElement('a');a.href=url;a.download=`jci-elementos-${estado.ano}-${estado.capitulo}.html`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
      }
    });
  };
})();

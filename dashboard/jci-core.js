(function(root){
  'use strict';
  const nomes={C:'Conforme',NC:'Não conforme',NA:'Não se aplica'};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalizar=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  function registros(base){
    return base.avaliacoes.flatMap(a=>{
      const padroes=new Map(a.padroes.map(p=>[p.id,p]));
      const capitulos=new Map(a.capitulos.map(c=>[c.id,c]));
      return a.elementos.map(e=>({...e,avaliacao:a.id,ano:a.ano,avaliacaoNome:a.nome,
        capituloNome:capitulos.get(e.capitulo).nome,padraoTexto:padroes.get(e.padrao).texto,
        recomendacao:padroes.get(e.padrao).recomendacao,paginasRecomendacao:padroes.get(e.padrao).paginas,
        chave:a.id+':'+e.id}));
    });
  }
  function filtrar(rows,f={}){
    const termo=normalizar(f.busca).trim();
    return rows.filter(e=>(!f.ano||f.ano==='todos'||String(e.ano)===String(f.ano))&&
      (!f.avaliacao||f.avaliacao==='todas'||e.avaliacao===f.avaliacao)&&
      (!f.capitulo||f.capitulo==='todos'||e.capitulo===f.capitulo)&&
      (!f.classificacao||f.classificacao==='todas'||e.classificacao===f.classificacao)&&
      (!termo||normalizar([e.id,e.capituloNome,e.texto,e.padraoTexto,e.achado,e.recomendacao].join(' ')).includes(termo)));
  }
  function resumir(rows){
    const s={total:rows.length,C:0,NC:0,NA:0};
    rows.forEach(e=>s[e.classificacao]++);
    return s;
  }
  function capitulos(rows){
    const grupos=new Map();
    rows.forEach(e=>{
      if(!grupos.has(e.capitulo))grupos.set(e.capitulo,{id:e.capitulo,nome:e.capituloNome,total:0,C:0,NC:0,NA:0});
      const g=grupos.get(e.capitulo);g.total++;g[e.classificacao]++;
    });
    return [...grupos.values()];
  }
  function conteudo(e){
    return `<div class="jci-conteudo">${e.classificacaoOriginal!==e.classificacao?`<p class="aviso">Classificação nesta aba: <strong>${nomes[e.classificacao]}</strong>. No PDF: <strong>${esc(e.classificacaoOriginal)}</strong>. ${esc(e.ajusteClassificacao)}</p>`:''}<h4>Padrão ${esc(e.padrao)}</h4><p>${esc(e.padraoTexto)}</p>
      <h4>Elemento de mensuração ${e.numero}</h4><p class="jci-texto-integral">${esc(e.texto)}</p>
      <h4>Achado / comentário do relatório</h4><p>${esc(e.achado||'Sem comentário registrado no relatório.')}</p>
      <h4>Recomendação do padrão</h4><p>${esc(e.recomendacao||'Sem recomendação registrada no relatório.')}</p>
      <p class="jci-fonte">${esc(e.avaliacaoNome)} · ${esc(e.capitulo)} — ${esc(e.capituloNome)} · Elemento: página(s) ${e.paginas.join(', ')}. Padrão / recomendação: página(s) ${e.paginasRecomendacao.join(', ')}.</p></div>`;
  }
  function exportar(rows,f){
    const s=resumir(rows);
    return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Consulta JCI — elementos de mensuração</title><style>body{font:15px/1.65 Arial;color:#18314b;max-width:960px;margin:36px auto;padding:24px}article{border-top:2px solid #cbd5e1;margin-top:32px}h4{margin-bottom:4px}p{margin-top:4px;overflow-wrap:anywhere}.jci-fonte{font-size:12px;color:#536578}@media print{h2,h4{break-after:avoid}}</style><h1>JCI — elementos de mensuração</h1>
      <p>Filtros: ano ${esc(f.ano)}, avaliação ${esc(f.avaliacao)}, capítulo ${esc(f.capitulo)}, classificação ${esc(nomes[f.classificacao]||'Todas')}, busca ${esc(f.busca||'sem termo')}.</p>
      <p>${s.total} elementos · ${s.C} conformes · ${s.NC} não conformes · ${s.NA} não se aplica.</p>
      <p>Classificações da avaliação com a correção informada pela equipe: PC é contabilizado como Não conforme. O valor original permanece identificado no elemento. Recomendações pertencem ao padrão e podem abranger vários elementos. Quebras de linha foram normalizadas para leitura. A execução de uma ação não modifica o resultado da visita.</p>
      <p>Conferência da fonte: a tabela da página 167 soma 1.109 elementos (859 C, 181 NC e 69 NA). O corpo do relatório contém também GLD.02.00 — EM 2, marcado PC na página 100. Com a correção informada pela equipe, a biblioteca soma 1.110 elementos: 859 conformes, 182 não conformes e 69 não se aplica. O PDF original não foi alterado.</p>
      ${rows.map(e=>`<article><h2>${esc(e.id)} — ${nomes[e.classificacao]}</h2>${conteudo(e)}</article>`).join('')}</html>`;
  }
  const api={nomes,esc,normalizar,registros,filtrar,resumir,capitulos,conteudo,exportar};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.JciCore=api;
})(typeof window==='object'?window:globalThis);

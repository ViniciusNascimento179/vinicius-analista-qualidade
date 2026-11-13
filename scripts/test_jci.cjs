const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const C=require('../dashboard/jci-core.js');
const ctx={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dashboard/jci-dados.js'),'utf8'),ctx);
const base=ctx.window.JciDados,rows=C.registros(base),a=base.avaliacoes[0];
assert.deepEqual(C.resumir(rows),{total:1110,C:859,NC:182,NA:69});
assert.equal(new Set(rows.map(e=>e.chave)).size,1110);
assert.equal(a.padroes.length,248);
assert.equal(a.capitulos.length,16);
for(const e of rows){
  assert.ok(e.texto&&e.padraoTexto&&e.capituloNome&&e.paginas.length);
  assert.ok(['C','NC','NA'].includes(e.classificacao));
  assert.ok(['C','NC','NA','PC'].includes(e.classificacaoOriginal));
}
// Reconcile source classifications with the PDF summary before the user correction.
for(const [cap,contagens] of Object.entries(a.resumoOriginalPagina167)){
  const originais=rows.filter(e=>e.capitulo===cap);
  ['C','NC','NA'].forEach((k,i)=>assert.equal(originais.filter(e=>e.classificacaoOriginal===k).length,contagens[i]));
  for(const classificacao of ['todas','C','NC','NA']){
    const filtro={ano:'2026',avaliacao:'cba-2026-10',capitulo:cap,classificacao};
    const list=C.filtrar(rows,filtro),s=C.resumir(list);
    assert.equal(s.C+s.NC+s.NA,s.total);
    assert.equal(C.capitulos(list).reduce((n,c)=>n+c.total,0),s.total);
    if(classificacao!=='todas')assert.equal(s[classificacao],s.total);
  }
}
const corrigido=rows.find(e=>e.id==='GLD.02.00.EM2');
assert.equal(corrigido.classificacaoOriginal,'PC');
assert.equal(corrigido.classificacao,'NC');
assert.match(corrigido.ajusteClassificacao,/13\/11\/2026/);
assert.equal(C.filtrar(rows,{capitulo:'GLD',classificacao:'NC'}).length,21);
assert.equal(C.filtrar(rows,{capitulo:'QPS',classificacao:'NC'}).length,16);
assert.equal(C.filtrar(rows,{capitulo:'COP',classificacao:'NA'}).length,31);
assert.equal(C.filtrar(rows,{ano:'2025'}).length,0);
assert.equal(C.filtrar(rows,{busca:'GLD.02.00.EM2'}).length,1);
assert.ok(C.filtrar(rows,{busca:'higienizacao'}).length>0);
assert.equal(C.filtrar(rows,{busca:'TERMO_INEXISTENTE_98237'}).length,0);
// The source's irregular table on page 58 must not truncate requirement text.
assert.match(rows.find(e=>e.id==='COP.10.03.EM1').texto,/documentadas para cuidados com doadores vivos nas fases de avaliação, doação e alta\.$/);
assert.match(rows.find(e=>e.id==='COP.10.03.EM2').texto,/avaliação, doação e alta\.$/);
assert.equal(rows.find(e=>e.id==='COP.10.03.EM1').achado,'Nenhum comentário.');
// Recommendations cross page boundaries, and belong to standards rather than individual findings.
assert.match(rows.find(e=>e.id==='ACC.01.01.EM1').recomendacao,/processo de triagem validado/);
assert.equal(rows.find(e=>e.id==='QPS.03.02.EM1').recomendacao,'');
const html=C.exportar(rows,{ano:'2026',avaliacao:a.id,capitulo:'todos',classificacao:'todas',busca:''});
assert.equal((html.match(/<article>/g)||[]).length,1110);
assert.ok(html.includes(C.esc(rows.at(-1).texto)));
assert.match(C.conteudo(corrigido),/No PDF: <strong>PC/);
assert.ok(!C.conteudo({...corrigido,texto:'<script>alert(1)</script>'}).includes('<script>'));
console.log('JCI: 1.110 elementos completos; reconciliação dos 16 capítulos, filtros, correção PC → NC e exportação aprovados.');

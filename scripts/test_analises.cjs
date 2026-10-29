const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {gerar,assinatura,TITULOS,taxa}=require('../dashboard/analise-dados.js');
const {relatorio}=require('../dashboard/analise-ui.js');
const dados=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dashboard/data.js'),'utf8')+';DADOS');

test('todas as abas possuem análise, ações, limites e acompanhamento',()=>{
  for(const aba of Object.keys(TITULOS)) {
    const a=gerar(dados,aba);
    assert.ok(a.resumo.length>30);
    for(const campo of ['achados','interpretacao','acoes','limites','acompanhamento']) assert.ok(a[campo].length,`${aba}: ${campo}`);
    assert.ok(!/NaN|undefined|Infinity/.test(JSON.stringify(a)));
  }
});
test('inspeções acompanha filtro e FMS inclui todos os status',()=>{
  const d=structuredClone(dados);
  d.inspecoes.por_ano={2024:{...d.inspecoes.total,total:167,abertos:0,concluidos:167},2026:{...d.inspecoes.total,total:419,abertos:338,concluidos:81}};
  const a=gerar(d,'inspecoes','2024'), b=gerar(d,'inspecoes','2026');
  assert.match(a.resumo,/167 ações/); assert.match(a.resumo,/0 em aberto/);
  assert.match(b.resumo,/419 ações/); assert.match(b.resumo,/338 em aberto/);
  assert.ok(a.achados.some(x=>x.includes('todos os status')));
  for(const bloco of [dados.inspecoes.total,...Object.values(dados.inspecoes.por_ano)]) {
    assert.equal(bloco.categoria_fms.reduce((s,x)=>s+x.total,0),bloco.total);
  }
});
test('rounds compara meses em comum e destaca divergência de pendentes',()=>{
  const d=structuredClone(dados);
  d.rounds.por_ano=[{ano:2026,realizados:80,previstos:100,pendentes:0}];
  d.rounds.evolucao={2026:[{mes:'Janeiro',realizados:80,previstos:100}],2025:[{mes:'Janeiro',realizados:60,previstos:100},{mes:'Dezembro',realizados:1,previstos:100}]};
  const a=gerar(d,'rounds','2026');
  assert.match(a.resumo,/80 de 100/);
  assert.match(a.resumo,/diferença.*20/);
  assert.ok(a.achados.some(x=>x.includes('mesmo mês disponível') && x.includes('+20 pontos')));
  assert.ok(a.limites.some(x=>x.includes('Pendentes informa 0')));
  d.rounds.evolucao['2025'].find(x=>x.mes==='Dezembro').realizados=100000;
  assert.deepEqual(gerar(d,'rounds','2026').achados,a.achados,'meses fora da comparação não podem afetar o resultado');
});
test('denominadores JCI e Watcher são explícitos',()=>{
  const d=structuredClone(dados);
  d.jci.classes={Conforme:765,'Não Conforme':277,'Não avaliado':32,'Não se aplica':17};
  d.jci.total_elementos=1091;
  d.watcher.desfechos={Alta:240,'Óbito':35,'Não informado':45};
  const j=gerar(d,'jci'), w=gerar(d,'watcher');
  assert.match(j.resumo,/765 de 1\.042/);
  assert.match(j.resumo,/32 não avaliados/);
  assert.ok(j.limites.some(x=>x.includes('não é nota oficial')));
  assert.match(w.resumo,/45 desfechos não informados/);
  assert.ok(w.interpretacao.some(x=>x.includes('não representam mortalidade hospitalar')));
});
test('zero e recorte inexistente não geram percentuais inválidos',()=>{
  assert.match(taxa(0,0),/não calculável/);
  assert.match(gerar(dados,'inspecoes','1900').resumo,/Não há dados/);
});
test('assinatura muda com a base ou o filtro para sinalizar revisão',()=>{
  const a=gerar(dados,'inspecoes','2024');
  assert.notEqual(assinatura(a),assinatura(gerar(dados,'inspecoes','2026')));
  assert.notEqual(assinatura(a),assinatura({...a,base:'Nova base'}));
});
test('relatório exporta equipe sem executar HTML e sinaliza base antiga',()=>{
  const html=relatorio(gerar(dados,'inspecoes'),{fields:{conclusao:'<script>alert(1)</script>',analista:'Equipe'},base:'base anterior'},true);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('Revisão pendente'));
  assert.ok(html.includes('base anterior'));
});

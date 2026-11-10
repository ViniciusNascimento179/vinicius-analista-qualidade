const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {resumir,analise,percentual}=require('../dashboard/ouvidoria.js');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../dashboard/ouvidoria-dados.js'),'utf8'),context);
const base=context.window.OuvidoriaDados;
const soma=rows=>rows.reduce((a,r)=>a+r.total,0);
const completo=resumir(base);
assert.equal(completo.total,base.total);
for(const ano of ['todos',...base.anos]) {
  for(const setor of ['todos',...base.setores]) {
    const s=resumir(base,{ano,setor});
    for(const lista of [s.setores,s.tipos,s.status,s.motivos,s.meses]) assert.equal(soma(lista),s.total);
    assert.equal(s.concluidos+s.naoConcluidos,s.total);
    const fechados=resumir(base,{ano,setor,status:'Concluído'});
    assert.equal(fechados.total,s.concluidos);
    assert.equal(fechados.naoConcluidos,0);
  }
}
const fixture={setores:['A','B','C'],grupos:[
  {ano:'2025',mes:'2025-01',setor:'A',tipo:'Elogio',status:'Concluído',motivo:'Elogio',n:2},
  {ano:'2026',mes:'2026-01',setor:'A',tipo:'Queixa',status:'Em andamento',motivo:'Demora',n:3},
  {ano:'2026',mes:'2026-01',setor:'B',tipo:'Solicitação',status:'Concluído',motivo:'Não informado',n:1}
]};
assert.equal(resumir(fixture,{ano:'2026'}).total,4);
assert.equal(resumir(fixture,{ano:'2026',setor:'A',tipo:'Queixa',status:'Em andamento'}).total,3);
assert.equal(resumir(fixture,{ano:'2025',setor:'B'}).total,0);
assert.equal(resumir(fixture,{ano:'2026'}).setores.length,3);
assert.equal(percentual(0,0),'—');
assert.ok(analise(resumir(fixture,{ano:'2099'}))[0].includes('Não há registros'));
for(const g of base.grupos) {
  assert.deepEqual(Object.keys(g).sort(),['ano','mes','motivo','n','setor','status','tipo']);
  assert.ok(Number.isInteger(g.n)&&g.n>0);
}
console.log(`Ouvidoria: filtros combinados e reconciliações aprovados para ${base.anos.length} anos e ${base.setores.length} setores; ${base.total} registros.`);

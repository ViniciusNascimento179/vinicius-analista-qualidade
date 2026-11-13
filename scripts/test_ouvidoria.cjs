const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {resumir,analise,percentual,mensal,farol,quadrosMensais}=require('../dashboard/ouvidoria.js');
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
const p=(total,extra={})=>({total,disponivel:true,parcial:false,...extra});
assert.equal(farol(p(2),p(3)).texto,'FAVORÁVEL');
assert.equal(farol(p(3),p(2)).texto,'DESFAVORÁVEL');
assert.equal(farol(p(3),p(3)).texto,'ESTÁVEL');
assert.equal(farol(p(0,{disponivel:false}),p(3)).texto,'SEM DADOS');
assert.equal(farol(p(2),p(0,{disponivel:false})).texto,'SEM BASE');
assert.equal(farol(p(2,{parcial:true}),p(3)).texto,'FAVORÁVEL*');
const g=(mes,setor,n,tipo='Queixa')=>({ano:mes.slice(0,4),mes,setor,n,tipo,status:'Concluído'});
const bm={anos:['2025','2026'],fim:'2026-03-10',grupos:[g('2025-12','A',7),g('2025-01','A',8),g('2026-01','A',5),g('2026-01','B',3),g('2026-01','Não informado',2),g('2026-02','A',9,'Elogio'),g('2026-03','A',2)]};
const mm=mensal(bm,'2026');
assert.equal(mm.atual[0].total,10);
assert.equal(mm.atual[0].semSetor,2);
assert.equal(mm.atual[0].top.length,2);
assert.equal(mm.atual[0].top[0].nome,'A');
assert.equal(mm.dezembroAnterior.total,7);
assert.equal(mm.atual[1].total,0);
assert.equal(mm.atual[1].disponivel,true);
assert.equal(mm.atual[2].parcial,true);
assert.equal(mm.atual[3].disponivel,false);
assert.equal(mensal(bm,'2026',{setor:'B'}).atual[0].total,3);
assert.equal(mensal(bm,'2026',{status:'Em andamento'}).atual[0].total,0);
for(const ano of base.anos.filter(a=>/^\d{4}$/.test(a))) {
  const meses=mensal(base,ano);
  assert.equal(meses.atual.reduce((s,p)=>s+p.total,0),resumir(base,{ano,tipo:'Queixa'}).total);
  for(const m of meses.atual) assert.ok(m.top.reduce((s,r)=>s+r.total,0)+m.semSetor<=m.total);
}
assert.ok(quadrosMensais(bm,{ano:'Sem data'}).includes('exigem data'));
assert.ok(quadrosMensais(bm,{ano:'2026',tipo:'Elogio'}).includes('Todos os tipos'));
assert.equal((quadrosMensais(bm,{ano:'todos'}).match(/class="ouv-faixa"/g)||[]).length,2);
const mal={...bm,grupos:[g('2026-01','<script>alert(1)</script>',1)]};
assert.ok(!quadrosMensais(mal,{ano:'2026'}).includes('<script>'));
console.log('Quadros mensais: totais, ranking, filtros, faróis, dezembro/janeiro, meses parciais e ausentes aprovados.');

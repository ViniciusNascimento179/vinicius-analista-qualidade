const test=require('node:test'), assert=require('node:assert/strict');
const C=require('../dashboard/pdsa-core.js');
const metric=(extra={})=>({name:'Tempo',type:'number',direction:'down',unit:'dias',target:'5',rows:[],...extra});
const row=(date,phase,value)=>({date,phase,value:String(value)});
test('quadro visual mantém PDSA e os registros antigos, com aprendizado e hipótese',()=>{
 const p={name:'Projeto',aim:'Melhorar'},c={name:'Ciclo 1',study:'Análise já registrada',predictionReview:'Hipótese parcialmente confirmada',studyLearning:'Aprendizado do teste',metrics:[metric()]};
 const html=C.board(p,c);assert.ok(html.includes('S — Estudar'));assert.ok(html.includes('Análise já registrada'));assert.ok(html.includes('Hipótese parcialmente confirmada'));assert.ok(html.includes('Aprendizado do teste'));assert.ok(!html.includes('PDCA'));
 assert.ok(C.report(p,c).includes('Quadro visual PDSA'));
});
test('vazios não viram zero e não produzem melhoria fictícia',()=>{
 const a=C.calculate(metric());assert.equal(a.baseline,null);assert.equal(a.latest,null);assert.equal(a.met,null);
 assert.equal(C.value(metric(),{value:''}),null);assert.equal(C.value(metric(),{value:'0'}),0);
});
test('percentuais usam base ponderada, validam denominador e pontos percentuais',()=>{
 const m=metric({type:'percent',direction:'up',target:'70',rows:[{date:'2026-01-01',phase:'base',n:'1',d:'2'},{date:'2026-01-02',phase:'base',n:'9',d:'10'},{date:'2026-01-03',phase:'test',n:'8',d:'10'}]});
 const a=C.calculate(m);assert.ok(Math.abs(a.baseline-100*10/12)<1e-10);assert.equal(a.latest,80);assert.equal(a.met,true);assert.ok(a.delta<0);
 assert.equal(C.value(m,{n:'0',d:'0'}),null);assert.equal(C.value(m,{n:'12',d:'10'}),null);assert.equal(C.value(m,{n:'',d:'10'}),null);
 assert.ok(a.notes.some(x=>x.includes('contrária')));assert.ok(a.notes.some(x=>x.includes('pontos percentuais')));
});
test('cronologia, direção e redução para zero',()=>{
 const a=C.calculate(metric({target:'0',rows:[row('2026-03-01','test',0),row('2026-01-01','base',10),row('2026-02-01','test',8)]}));
 assert.equal(a.latest,0);assert.equal(a.delta,-10);assert.equal(a.met,true);assert.equal(a.rows[0].date,'2026-01-01');
 assert.ok(C.validate(metric(),row('2026-02-30','base',1)));
});
test('base e teste sobrepostos são sinalizados',()=>{
 const a=C.calculate(metric({rows:[row('2026-03-01','base',4),row('2026-01-01','test',2)]}));assert.ok(a.notes.some(x=>x.includes('comparabilidade')));
});
test('relatório escapa entradas e contém gráficos sem dependências externas',()=>{
 const p={name:'<script>alert(1)</script>'},c={name:'Teste',metrics:[metric({name:'<img onerror=alert(1)>',rows:[row('2026-01-01','base',10),row('2026-02-01','test',5)]})]};
 const html=C.report(p,c);assert.ok(!html.includes('<script'));assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('<svg'));assert.ok(html.includes('Análise automática'));assert.ok(html.includes('Medições e evidências'));
 const sig=C.signature(p,c);c.metrics[0].rows[1].value='6';assert.notEqual(C.signature(p,c),sig);
});

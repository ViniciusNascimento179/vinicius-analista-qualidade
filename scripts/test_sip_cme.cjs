const test = require('node:test');
const assert = require('node:assert/strict');
const {registros} = require('../dashboard/sip-cme-dados.js');
const {resumir,analise,percentual} = require('../dashboard/sip-cme.js');

test('reconcilia os 13 registros e distingue cobertura de resultados', () => {
  const s=resumir(registros);
  assert.equal(s.total,13);
  assert.equal(s.inicio,'2026-07-28'); assert.equal(s.fim,'2026-11-03');
  assert.equal(s.itens.passThrough.sim,13);
  assert.equal(s.itens.portasAbertas.sim,5); assert.equal(s.itens.portasAbertas.nao,8);
  assert.deepEqual(s.itens.pressoes,{sim:3,nao:0,naoAuditado:0,semRegistro:10,avaliados:3});
  assert.deepEqual(s.itens.articulados,{sim:6,nao:0,naoAuditado:1,semRegistro:6,avaliados:6});
  assert.equal(s.sequenciaSemPortasAbertas,4);
  assert.equal(s.acoesPreenchidas,0); assert.equal(s.observacoes.length,4);
  assert.equal(percentual(5,13),'38,5%');
});
test('agrega pela data da auditoria e filtra indicadores e texto juntos', () => {
  const s=resumir(registros);
  assert.deepEqual(s.meses.map(m=>[m.periodo,m.total,m.portas.sim]),[
    ['2026-07',2,1],['2026-08',4,3],['2026-09',3,1],['2026-10',3,0],['2026-11',1,0]
  ]);
  const agosto=resumir(registros,'2026-08');
  assert.equal(agosto.itens.portasAbertas.sim,3); assert.equal(agosto.total,4);
  assert.ok(!analise(agosto).join(' ').includes('29/09/2026'));
  const novembro=resumir(registros,'2026-11');
  assert.equal(novembro.itens.articulados.avaliados,0);
  assert.equal(novembro.itens.articulados.naoAuditado,1);
});
test('ausência de dados não vira zero por cento ou sequência favorável', () => {
  const s=resumir(registros,'1900-01');
  assert.equal(s.total,0); assert.equal(percentual(0,0),'Não calculável');
  assert.match(analise(s)[0],/Não há auditorias/);
  const missing=resumir([...registros,{id:14,data:'2026-11-04',portasAbertas:null}]);
  assert.equal(missing.sequenciaSemPortasAbertas,0);
  assert.equal(missing.itens.portasAbertas.avaliados,13);
  assert.equal(missing.itens.portasAbertas.semRegistro,1);
});
test('resultados não dependem da ordem dos registros e não afirmam encerramento', () => {
  assert.deepEqual(resumir([...registros].reverse()),resumir(registros));
  assert.match(analise(resumir(registros)).join(' '),/não é possível concluir seu atendimento integral/);
  assert.ok(!/NaN|Infinity|undefined/.test(analise(resumir(registros)).join(' ')));
});

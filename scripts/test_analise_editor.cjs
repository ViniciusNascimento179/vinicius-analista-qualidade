const test=require('node:test');
const assert=require('node:assert/strict');
const {criarCliente,validarDocumento,validarCampos,codificar,decodificar,assinatura}=require('../dashboard/analise-editor.js');
const {relatorio}=require('../dashboard/analise-ui.js');
const {gerar}=require('../dashboard/analise-dados.js');
const fs=require('node:fs'),vm=require('node:vm');
const dados=vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../dashboard/data.js'),'utf8')+';DADOS');
const record=(text,revision='r1')=>({campos:{paragrafos:[text],limites:[]},base:'base-antiga',updatedAt:'2026-11-05T12:00:00Z',revision});
function backend(doc={version:1,analises:{}}) {
  let state=structuredClone(doc),sha='sha-1',revision=1;
  const calls=[];
  const fetcher=async(url,opts)=>{
    calls.push({url,opts});
    if(opts.method==='PUT') {
      const body=JSON.parse(opts.body);
      if(body.sha!==sha)return {ok:false,status:409};
      state=JSON.parse(decodificar(body.content));sha='sha-'+(++revision);
      return {ok:true,status:200,json:async()=>({commit:{sha}})};
    }
    return {ok:true,status:200,json:async()=>({encoding:'base64',sha,content:codificar(JSON.stringify(state))})};
  };
  return {fetcher,calls,get:()=>structuredClone(state),set:d=>{state=d;sha='sha-'+(++revision);}};
}
test('publica texto UTF-8 e preserva outros painéis e períodos',async()=>{
  const other=record('Outro mês');
  const b=backend({version:1,analises:{'sip-cme:2026-08':other}}),c=criarCliente(b.fetcher);
  await c.publicar({id:'sip-cme:total',campos:{paragrafos:['Análise revisada: pressão e ações.'],limites:[]},base:'base-nova',expected:null,token:'token-de-teste'});
  assert.deepEqual(b.get().analises['sip-cme:2026-08'],other);
  assert.equal(b.get().analises['sip-cme:total'].campos.paragrafos[0],'Análise revisada: pressão e ações.');
  assert.ok(b.calls.every(c=>c.url.startsWith('https://api.github.com/repos/ViniciusNascimento179/vinicius-analista-qualidade/contents/dashboard/analises-publicadas.json')));
  assert.ok(!JSON.stringify(b.get()).includes('token-de-teste'));
  assert.equal(JSON.parse(b.calls.find(c=>c.opts.method==='PUT').opts.body).branch,'main');
});
test('recusa sobrescrever uma análise publicada durante a edição',async()=>{
  const b=backend({version:1,analises:{'sip-cme:total':record('Mais recente','r2')}});
  await assert.rejects(criarCliente(b.fetcher).publicar({id:'sip-cme:total',campos:{paragrafos:['Meu texto']},base:'nova',expected:record('Anterior'),token:'teste'}),e=>e.code==='CONFLICT');
  assert.ok(!b.calls.some(c=>c.opts.method==='PUT'));
});
test('atualização concorrente de outro período é mesclada sem perda',async()=>{
  const b=backend();let raced=false;
  const client=criarCliente(async(url,opts)=>{
    if(opts.method==='PUT'&&!raced){raced=true;b.set({version:1,analises:{'rounds:2026':{...record('Outra edição'),campos:{resumo:'Outro painel'}}}});return {ok:false,status:409};}
    return b.fetcher(url,opts);
  });
  await client.publicar({id:'sip-cme:total',campos:{paragrafos:['Texto CME']},base:'nova',expected:null,token:'teste'});
  assert.equal(b.get().analises['rounds:2026'].campos.resumo,'Outro painel');
  assert.equal(b.get().analises['sip-cme:total'].campos.paragrafos[0],'Texto CME');
});
test('resposta perdida depois de gravar é reconciliada antes de repetir',async()=>{
  const b=backend();const c=criarCliente(async(url,opts)=>{const result=await b.fetcher(url,opts);if(opts.method==='PUT')throw new Error('rede');return result;});
  const r=await c.publicar({id:'sip-cme:total',campos:{paragrafos:['Publicado']},base:'nova',expected:null,token:'teste'});
  assert.equal(r.record.campos.paragrafos[0],'Publicado');assert.equal(b.calls.filter(c=>c.opts.method==='PUT').length,1);
});
test('erro de autorização não é informado como publicação concluída',async()=>{
  const c=criarCliente(async()=>({ok:false,status:401}));
  await assert.rejects(c.publicar({id:'visao:total',campos:{resumo:'Texto'},base:'b',expected:null,token:'invalido'}),e=>e.status===401);
});
test('valida estrutura e não executa marcação no relatório editado',()=>{
  assert.throws(()=>validarCampos({resumo:['errado']}));
  assert.throws(()=>validarCampos({paragrafos:'errado'}));
  assert.throws(()=>validarDocumento({version:1,analises:{'desconhecido:total':record('x')}}));
  const a=gerar(dados,'visao');a.resumo='<img src=x onerror=alert(1)>';
  const html=relatorio(a,{fields:{}},false,{manual:true,baseAlterada:true});
  assert.ok(!html.includes('<img'));assert.match(html,/&lt;img/);assert.match(html,/Texto da análise crítica/);assert.match(html,/texto manual precisa ser revisado/);
  assert.notEqual(assinatura({a:1}),assinatura({a:2}));
});
test('arquivo publicado permanece válido após alterações feitas pelos usuários',()=>{
  const path=require('node:path').join(__dirname,'../dashboard/analises-publicadas.json');
  assert.doesNotThrow(()=>validarDocumento(JSON.parse(fs.readFileSync(path,'utf8'))));
});

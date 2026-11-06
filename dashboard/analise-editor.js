/* Edição no próprio bloco; publicação autenticada no repositório do painel. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AnaliseEditor = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const ENDPOINT = 'https://api.github.com/repos/ViniciusNascimento179/vinicius-analista-qualidade/contents/dashboard/analises-publicadas.json';
  const REPOSITORIO = 'ViniciusNascimento179/vinicius-analista-qualidade';
  const camposPermitidos = ['resumo','achados','interpretacao','acoes','acompanhamento','limites','paragrafos'];
  const clone = v => JSON.parse(JSON.stringify(v));
  const igual = (a,b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  function validarCampos(campos) {
    if (!campos || typeof campos !== 'object' || Array.isArray(campos)) throw new Error('Texto de análise inválido.');
    const limpo = {};
    for (const [k,v] of Object.entries(campos)) {
      if (!camposPermitidos.includes(k)) throw new Error('Campo de análise desconhecido.');
      if (k==='resumo' && typeof v === 'string' && v.length <= 30000) limpo[k]=v;
      else if (k!=='resumo' && Array.isArray(v) && v.length <= 100 && v.every(x=>typeof x==='string' && x.length<=10000)) limpo[k]=v.slice();
      else throw new Error('Texto muito longo ou formato inválido.');
    }
    if (JSON.stringify(limpo).length > 100000) throw new Error('A análise excede o limite de tamanho.');
    return limpo;
  }
  function validarDocumento(doc) {
    if (!doc || doc.version!==1 || !doc.analises || typeof doc.analises!=='object' || Array.isArray(doc.analises)) throw new Error('Arquivo de análises inválido.');
    const result = {version:1, analises:{}};
    for (const [id, r] of Object.entries(doc.analises)) {
      if (!/^(visao|inspecoes|rounds|huddle|watcher|jci|sip-cme):(total|\d{4}|\d{4}-\d{2})$/.test(id)) throw new Error('Painel ou período inválido.');
      if (!r || typeof r.base!=='string' || typeof r.updatedAt!=='string' || typeof r.revision!=='string') throw new Error('Registro publicado inválido.');
      result.analises[id]={campos:validarCampos(r.campos),base:r.base,updatedAt:r.updatedAt,revision:r.revision};
    }
    return result;
  }
  function codificar(texto) {
    const bytes=new TextEncoder().encode(texto);
    let binario=''; for(const b of bytes) binario+=String.fromCharCode(b);
    return btoa(binario);
  }
  function decodificar(texto) {return new TextDecoder().decode(Uint8Array.from(atob(texto.replace(/\s/g,'')),c=>c.charCodeAt(0)));}
  function assinatura(valor) {
    const text=JSON.stringify(valor); let h=2166136261;
    for(let i=0;i<text.length;i++) {h^=text.charCodeAt(i);h=Math.imul(h,16777619);}
    return `${text.length}:${(h>>>0).toString(16)}`;
  }
  function erroHttp(status) {
    const e=new Error(status===401 ? 'Chave inválida ou expirada. Informe uma chave de publicação válida.' : status===403 ? 'O GitHub recusou o acesso. Verifique a permissão Contents: Read and write para este repositório e o limite de acesso da conta.' : status===404 ? 'Não foi possível acessar o arquivo. Verifique se a chave permite acesso ao repositório do painel.' : `O GitHub não concluiu a operação (HTTP ${status}). Seu texto foi preservado.`);
    e.status=status; return e;
  }
  function criarCliente(fetcher) {
    const headers = token => ({Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10',...(token?{Authorization:`Bearer ${token}`}:{})});
    async function ler(token='') {
      const r=await fetcher(ENDPOINT+'?ref=main',{headers:headers(token),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
      if(!r.ok) throw erroHttp(r.status);
      const file=await r.json();
      if(file.encoding!=='base64' || typeof file.content!=='string' || typeof file.sha!=='string') throw new Error('Resposta de publicação inválida.');
      return {sha:file.sha,doc:validarDocumento(JSON.parse(decodificar(file.content)))};
    }
    async function publicar({id,campos,base,expected,token}) {
      if(!token?.trim()) throw new Error('Informe sua chave de publicação do GitHub.');
      const record={campos:validarCampos(campos),base,updatedAt:new Date().toISOString(),revision:crypto.randomUUID()};
      for(let attempt=0;attempt<2;attempt++) {
        const remote=await ler(token);
        if(!igual(remote.doc.analises[id],expected)) {
          const e=new Error('Esta análise recebeu outra publicação. Copie seu rascunho antes de cancelar e carregar a versão atual. Nada foi sobrescrito.');e.code='CONFLICT';e.doc=remote.doc;throw e;
        }
        const next=validarDocumento({...remote.doc,analises:{...remote.doc.analises,[id]:record}});
        let response;
        try {
          response=await fetcher(ENDPOINT,{method:'PUT',headers:{...headers(token),'Content-Type':'application/json'},redirect:'error',signal:AbortSignal.timeout(20000),body:JSON.stringify({branch:'main',sha:remote.sha,message:`docs: atualizar análise crítica ${id}`,content:codificar(JSON.stringify(next,null,2)+'\n')})});
        } catch(error) {
          // A resposta pode ter sido perdida após o GitHub gravar o arquivo.
          try {const check=await ler(token);if(check.doc.analises[id]?.revision===record.revision)return {doc:check.doc,record};} catch(ignore) {}
          throw new Error('Não foi possível confirmar a publicação. Seu rascunho foi preservado; confira a conexão antes de tentar novamente.');
        }
        if(response.status===409 && attempt===0) continue;
        if(!response.ok) throw erroHttp(response.status);
        return {doc:next,record};
      }
      throw new Error('Outra atualização ocorreu durante a publicação. Tente novamente; seu texto foi preservado.');
    }
    return {ler,publicar};
  }
  const drafts=new Map(), subscriptions=new Map();
  if(typeof window!=='undefined') window.addEventListener('beforeunload',e=>{if(drafts.size){e.preventDefault();e.returnValue='';}});
  let shared={version:1,analises:{}}, loading, token='', leituraAviso='';
  let client;
  function carregar() {
    if(loading) return loading;
    client=criarCliente((...args)=>fetch(...args));
    loading=client.ler().then(r=>{shared=r.doc;}).catch(async()=>{
      try {
        const r=await fetch('analises-publicadas.json',{cache:'no-store',signal:AbortSignal.timeout(8000)});
        if(!r.ok) throw new Error();shared=validarDocumento(await r.json());
        leituraAviso='Exibindo a versão publicada no site. A consulta à versão mais recente do GitHub não está disponível.';
      } catch(error) {leituraAviso='Não foi possível consultar as análises publicadas. O texto automático está sendo exibido; tente atualizar a página.';}
    }).finally(()=>{for(const sub of subscriptions.values())sub();});
    return loading;
  }
  function draftKey(id) {return `qualidade:analise-publica:rascunho:v1:${id}`;}
  function obterDraft(id) {
    if(drafts.has(id)) return drafts.get(id);
    try {const d=JSON.parse(sessionStorage.getItem(draftKey(id)));if(d?.campos){d.campos=validarCampos(d.campos);drafts.set(id,d);return d;}} catch(error) {}
    return null;
  }
  function guardarDraft(id,d) {
    drafts.set(id,clone(d));
    try {sessionStorage.setItem(draftKey(id),JSON.stringify(d));return true;} catch(error) {return false;}
  }
  function limparDraft(id) {drafts.delete(id);try {sessionStorage.removeItem(draftKey(id));} catch(error) {}}
  function montar({box,aba,filtro='total',base}) {
    const id=`${aba}:${filtro}`;
    const targets=[...box.querySelectorAll('[data-ac-edit]')];
    if(!targets.length) return null;
    const originais={};
    function textoLista(el) {
      function ler(node) {
        if(node.nodeType===3) return node.nodeValue;
        const text=[...node.childNodes].map(ler).join('');
        return text+(/^(LI|P|DIV|BR)$/.test(node.nodeName)?'\n':'');
      }
      return [...el.childNodes].map(ler).join('').split(/\n+/).map(t=>t.trim()).filter(Boolean);
    }
    function coletar() {
      return Object.fromEntries(targets.map(el=>[el.dataset.acEdit,el.dataset.acTipo==='lista' ? textoLista(el) : el.innerText.replace(/\r\n/g,'\n')]));
    }
    Object.assign(originais,coletar());
    // A assinatura inclui os dados originais, nunca o texto manual.
    const baseId=assinatura({base,campos:originais});
    let editing=false,busy=false,expected=null,current=clone(originais),draftSeguro=true;
    const controls=document.createElement('div');controls.className='ac-editor-controles';
    controls.innerHTML='<button type="button" class="ac-editar" disabled>Editar análise</button><button type="button" class="ac-publicar" hidden>Publicar para todos</button><button type="button" class="ac-cancelar" hidden>Cancelar</button><button type="button" class="ac-restaurar" hidden>Restaurar texto automático</button>';
    box.querySelector('.ac-cabecalho').appendChild(controls);
    const notice=document.createElement('p');notice.className='ac-editor-status';notice.setAttribute('role','status');notice.textContent='Consultando análise publicada…';
    const subtitle=box.querySelector('.ac-subtitulo');subtitle.after(notice);
    const stale=document.createElement('p');stale.className='ac-base-antiga';stale.hidden=true;notice.after(stale);
    const auth=document.createElement('div');auth.className='ac-editor-auth';auth.hidden=true;
    auth.innerHTML=`<label>Chave de publicação do GitHub <input type="password" autocomplete="off" spellcheck="false" aria-label="Chave de publicação do GitHub"></label><p>Use um token de acesso refinado (fine-grained), limitado ao repositório <strong>${REPOSITORIO}</strong>, com a permissão <strong>Contents: Read and write</strong>. A chave é enviada somente ao GitHub e fica na memória desta página até ela ser fechada ou atualizada.</p><p><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">Criar chave no GitHub</a> · <a href="https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens" target="_blank" rel="noopener noreferrer">Como configurar</a></p><button type="button" class="ac-conectar">Autorizar e publicar</button>`;
    stale.after(auth);
    const edit=controls.querySelector('.ac-editar'),save=controls.querySelector('.ac-publicar'),cancel=controls.querySelector('.ac-cancelar'),restore=controls.querySelector('.ac-restaurar');
    function aplicar(fields) {
      current=clone(fields);
      for(const el of targets) {
        const value=fields[el.dataset.acEdit] ?? originais[el.dataset.acEdit];
        if(el.dataset.acTipo==='lista') {
          el.replaceChildren();
          for(const text of Array.isArray(value)?value:[]) {const child=document.createElement(el.tagName==='UL'?'li':'p');if(el.dataset.acClasse)child.className=el.dataset.acClasse;child.textContent=text;el.appendChild(child);}
        } else el.textContent=typeof value==='string'?value:'';
      }
    }
    function modo(active) {
      editing=active;edit.hidden=active;save.hidden=!active;cancel.hidden=!active;restore.hidden=!active;
      for(const el of targets) {
        el.classList.toggle('ac-em-edicao',active);
        if(active){el.setAttribute('contenteditable','plaintext-only');el.setAttribute('role','textbox');el.setAttribute('aria-multiline','true');el.setAttribute('tabindex','0');}
        else {el.removeAttribute('contenteditable');el.removeAttribute('role');el.removeAttribute('aria-multiline');el.removeAttribute('tabindex');}
      }
      if(!active){auth.hidden=true;auth.querySelector('input').value='';}
    }
    function alertaBase(record) {
      stale.hidden=!record || record.base===baseId;
      stale.textContent='Os dados do painel mudaram desde esta publicação. O texto foi preservado. Revise-o e publique novamente, ou restaure o texto automático durante a edição.';
    }
    function atualizar() {
      if(!box.isConnected || editing || busy) return;
      expected=clone(shared.analises[id] || null);
      aplicar(expected?.campos || originais);alertaBase(expected);
      edit.disabled=false;
      const draft=obterDraft(id);
      if(draft) {
        expected=draft.expected ?? null;aplicar(draft.campos);modo(true);alertaBase(draft);
        notice.textContent='Rascunho recuperado nesta página. Ele ainda não foi publicado para todos.';
      } else notice.textContent=leituraAviso || (expected ? `Texto publicado em ${new Date(expected.updatedAt).toLocaleString('pt-BR')}.` : 'Texto automático. Use “Editar análise” para alterar este bloco e publicar para todos.');
      subtitle.textContent=subtitle.textContent.replace('Texto automático para validação pela equipe.',expected?'Texto editado e publicado pela equipe.':'Texto automático para validação pela equipe.');
    }
    function preservar() {
      if(!editing) return;
      current=coletar();draftSeguro=guardarDraft(id,{campos:current,expected,base:baseId});
      notice.textContent=draftSeguro?'Rascunho nesta sessão do navegador. Clique em “Publicar para todos” para atualizar o painel público.':'Não foi possível guardar o rascunho nesta sessão. Mantenha a página aberta até publicar ou copie o texto.';
    }
    for(const el of targets) {el.addEventListener('input',preservar);el.addEventListener('drop',e=>e.preventDefault());}
    edit.addEventListener('click',()=>{modo(true);preservar();targets[0].focus();});
    cancel.addEventListener('click',()=>{limparDraft(id);modo(false);atualizar();edit.focus();});
    restore.addEventListener('click',()=>{aplicar(originais);preservar();notice.textContent='Texto automático restaurado no rascunho. Publique para aplicar a todos, ou cancele para manter a versão anterior.';});
    async function publicar() {
      if(busy) return;
      preservar();
      const input=auth.querySelector('input');
      if(input.value.trim()){token=input.value.trim();input.value='';}
      if(!token){auth.hidden=false;notice.textContent='Autorize a publicação com uma chave de acesso ao repositório. Nenhuma alteração foi publicada.';input.focus();return;}
      try {
        validarCampos(current);busy=true;save.disabled=true;cancel.disabled=true;restore.disabled=true;auth.querySelector('button').disabled=true;
        for(const el of targets) el.setAttribute('contenteditable','false');
        notice.textContent='Publicando a análise no GitHub…';
        const result=await client.publicar({id,campos:current,base:baseId,expected,token});
        shared=result.doc;expected=clone(result.record);limparDraft(id);modo(false);aplicar(expected.campos);alertaBase(expected);
        subtitle.textContent=subtitle.textContent.replace('Texto automático para validação pela equipe.','Texto editado e publicado pela equipe.');
        notice.textContent='Análise publicada para todos. Quem já estiver com o painel aberto deve atualizar a página. A cópia estática do site será atualizada automaticamente em alguns minutos.';
      } catch(error) {
        if(error.status===401||error.status===403||error.status===404){token='';auth.hidden=false;}
        if(error.code==='CONFLICT')shared=error.doc;
        notice.textContent=error.message || 'Não foi possível publicar. Seu texto foi preservado.';
        for(const el of targets)el.setAttribute('contenteditable','plaintext-only');
      } finally {busy=false;save.disabled=false;cancel.disabled=false;restore.disabled=false;auth.querySelector('button').disabled=false;}
    }
    save.addEventListener('click',publicar);auth.querySelector('.ac-conectar').addEventListener('click',publicar);
    auth.querySelector('input').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();publicar();}});
    subscriptions.set(id,atualizar);carregar().then(atualizar);
    return {atual:()=>({campos:editing?coletar():clone(current),manual:editing||Boolean(expected),baseAlterada:Boolean(expected&&expected.base!==baseId)})};
  }
  return {montar,criarCliente,validarCampos,validarDocumento,codificar,decodificar,assinatura};
});

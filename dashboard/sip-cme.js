/* Indicadores descritivos da SIP CME: ausência de registro não é conformidade. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.SipCme = api;
    RENDER['sip-cme'] = () => api.montar(document.getElementById('aba-sip-cme'), root.SipCmeDados);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const itens = [
    ['passThrough', 'Pass-through fechado corretamente'],
    ['portasAbertas', 'Portas abertas'],
    ['articulados', 'Articulados abertos'],
    ['pressoes', 'Pressões funcionando']
  ];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const data = v => v ? v.split('-').reverse().join('/') : 'Não informada';
  const numero = n => n.toLocaleString('pt-BR', {maximumFractionDigits:1});
  const quantidade = (n, singular, plural) => `${n} ${n===1 ? singular : plural}`;
  const percentual = (n, d) => d ? `${numero(100*n/d)}%` : 'Não calculável';
  const mes = v => new Date(`${v}-01T12:00:00`).toLocaleDateString('pt-BR', {month:'short', year:'numeric'});
  function contar(rows, key) {
    const c = {sim:0, nao:0, naoAuditado:0, semRegistro:0};
    for (const r of rows) {
      if (r[key] === 'Sim') c.sim++;
      else if (r[key] === 'Não') c.nao++;
      else if (r[key] === 'Não Auditado') c.naoAuditado++;
      else c.semRegistro++;
    }
    c.avaliados = c.sim + c.nao;
    return c;
  }
  function resumir(registros, filtro='total') {
    const rows = registros.filter(r => filtro === 'total' || r.data.slice(0,7) === filtro)
      .slice().sort((a,b) => a.data.localeCompare(b.data) || a.id-b.id);
    const porMes = new Map();
    for (const r of rows) {
      const key = r.data.slice(0,7);
      if (!porMes.has(key)) porMes.set(key, []);
      porMes.get(key).push(r);
    }
    let sequenciaSemPortasAbertas = 0;
    for (let i=rows.length-1; i>=0 && rows[i].portasAbertas === 'Não'; i--) sequenciaSemPortasAbertas++;
    return {
      rows, total:rows.length, inicio:rows[0]?.data, fim:rows.at(-1)?.data,
      itens:Object.fromEntries(itens.map(([k]) => [k, contar(rows,k)])),
      meses:[...porMes].map(([periodo, rs]) => ({periodo, total:rs.length, portas:contar(rs,'portasAbertas')})),
      sequenciaSemPortasAbertas,
      acoesPreenchidas:rows.filter(r => r.acao?.trim()).length,
      observacoes:rows.filter(r => r.observacao?.trim())
    };
  }
  function analise(s) {
    if (!s.total) return ['Não há auditorias neste período. Não é possível calcular resultados ou avaliar evolução.'];
    const p = s.itens.passThrough, d = s.itens.portasAbertas, a = s.itens.articulados, pr = s.itens.pressoes;
    const texto = [
      `O período de ${data(s.inicio)} a ${data(s.fim)} reúne ${quantidade(s.total,'auditoria','auditorias')}. O pass-through foi registrado como fechado corretamente em ${p.sim} de ${quantidade(p.avaliados,'avaliação','avaliações')} (${percentual(p.sim,p.avaliados)}). Esse resultado descreve os momentos auditados e precisa ser interpretado junto das condições dos demais acessos.`,
      `Houve registro de portas abertas em ${d.sim} de ${quantidade(d.avaliados,'auditoria','auditorias')} com resposta (${percentual(d.sim,d.avaliados)}). Uma visita pode envolver mais de uma porta ou janela; este indicador conta auditorias, não a quantidade de aberturas.`
    ];
    if (s.sequenciaSemPortasAbertas) texto.push(`O recorte termina com ${quantidade(s.sequenciaSemPortasAbertas,'auditoria sem registro','auditorias consecutivas sem registro')} de portas abertas. O resultado é favorável, mas o número de observações e a cobertura de horários e turnos não permitem concluir que o resultado está sustentado em toda a rotina.`);
    const falha = s.rows.find(r => /ar condicionado/i.test(r.observacao || ''));
    if (falha) texto.push(`Em ${data(falha.data)}, a observação associa a abertura de portas ao não funcionamento do ar-condicionado e menciona uma notificação sobre pressão. Trata-se de uma causa relatada, cuja confirmação e solução precisam de evidência técnica. A base não informa o encerramento da notificação.`);
    texto.push(`Pressões funcionando: ${quantidade(pr.sim,'resposta','respostas')} “Sim” em ${quantidade(pr.avaliados,'avaliação','avaliações')}. Sem registro: ${pr.semRegistro}. Não auditado: ${pr.naoAuditado}. Articulados abertos: ${quantidade(a.sim,'resposta','respostas')} “Sim” em ${quantidade(a.avaliados,'avaliação','avaliações')}. Sem registro: ${a.semRegistro}. Não auditado: ${a.naoAuditado}. Campos vazios não demonstram falha nem conformidade; o critério de avaliação dos articulados deve ser confirmado no protocolo.`);
    texto.push(`O campo de ações foi preenchido em ${s.acoesPreenchidas} de ${quantidade(s.total,'registro','registros')}. Medidas mencionadas em observações devem ter responsável, prazo e verificação de eficácia documentados. A planilha não contém o apontamento original da JCI, a meta nem o critério de encerramento da SIP; não é possível concluir seu atendimento integral com esta base.`);
    return texto;
  }
  function montar(sec, base) {
    if (!sec || !base) return;
    const meses = [...new Set(base.registros.map(r => r.data.slice(0,7)))].sort();
    sec.innerHTML = `<div class="sip-titulo"><div><h2>SIP — CME</h2><p>Auditoria de pass-through, acessos, articulados e pressões</p></div><span class="sip-pendente">Meta e critério de encerramento não informados</span></div>
      <div class="sip-filtros"><label for="sip-periodo">Período da auditoria</label><select id="sip-periodo"><option value="total">Todo o período</option>${meses.map(m=>`<option value="${m}">${mes(m)}</option>`).join('')}</select><span id="sip-periodo-descricao" aria-live="polite"></span></div>
      <div id="sip-conteudo"></div>`;
    const select = sec.querySelector('#sip-periodo');
    let grafico;
    function atualizar() {
      if (grafico) {grafico.destroy(); grafico = null;}
      const s = resumir(base.registros, select.value), i = s.itens;
      sec.querySelector('#sip-periodo-descricao').textContent = s.total ? `${data(s.inicio)} a ${data(s.fim)}` : 'Sem auditorias';
      const card = (label, value, detail, type='') => `<div class="kpi ${type}"><div class="rotulo">${label}</div><div class="valor">${value}</div><div class="detalhe">${detail}</div></div>`;
      const resposta = value => esc(value || 'Sem registro');
      sec.querySelector('#sip-conteudo').innerHTML = `<div class="kpis">
        ${card('Auditorias', s.total, 'Visitas registradas no período', 'info')}
        ${card('Pass-through fechado', percentual(i.passThrough.sim,i.passThrough.avaliados), `${i.passThrough.sim}/${i.passThrough.avaliados} avaliações · ${i.passThrough.semRegistro} sem registro`)}
        ${card('Visitas com portas abertas', percentual(i.portasAbertas.sim,i.portasAbertas.avaliados), `${i.portasAbertas.sim}/${i.portasAbertas.avaliados} avaliações`,i.portasAbertas.sim?'warn':'')}
        ${card('Pressões avaliadas', `${i.pressoes.avaliados}/${s.total}`, `${i.pressoes.sim} “Sim” · ${i.pressoes.semRegistro} sem registro`)}
        ${card('Articulados avaliados', `${i.articulados.avaliados}/${s.total}`, `${i.articulados.sim} “Sim” · ${i.articulados.naoAuditado} não auditado(s) · ${i.articulados.semRegistro} sem registro`)}
      </div>
      <div class="grade sip-grade">
        <div class="painel"><h2>Portas abertas por mês</h2><p class="sip-nota">Quantidade de auditorias por resposta. Meses com amostras pequenas não demonstram uma tendência consolidada.</p><div class="canvas-wrap"><canvas id="sip-evolucao" role="img" aria-label="Auditorias por mês com e sem portas abertas. Os valores estão na tabela ao lado."></canvas></div></div>
        <div class="painel"><h2>Resultados mensais</h2><div class="sip-tabela"><table><caption>Auditorias com resposta “Sim” para portas abertas</caption><thead><tr><th scope="col">Mês</th><th scope="col">Visitas</th><th scope="col">Portas abertas</th><th scope="col">% das avaliadas</th></tr></thead><tbody>${s.meses.map(m=>`<tr><th scope="row">${mes(m.periodo)}</th><td>${m.total}</td><td>${m.portas.sim}/${m.portas.avaliados}</td><td>${percentual(m.portas.sim,m.portas.avaliados)}</td></tr>`).join('')}</tbody></table></div></div>
        <div class="painel full"><h2>Resultado e cobertura por item</h2><p class="sip-nota">“Sim” reproduz a resposta do formulário. Em “Portas abertas”, significa ocorrência. Em “Articulados abertos”, o critério depende do protocolo. Não há nota global de conformidade.</p><div class="sip-tabela"><table><caption>Respostas e proporção de auditorias com avaliação registrada</caption><thead><tr><th scope="col">Item</th><th scope="col">Sim</th><th scope="col">Não</th><th scope="col">Não auditado</th><th scope="col">Sem registro</th><th scope="col">Cobertura</th></tr></thead><tbody>${itens.map(([k,label])=>`<tr><th scope="row">${label}</th><td>${i[k].sim}</td><td>${i[k].nao}</td><td>${i[k].naoAuditado}</td><td>${i[k].semRegistro}</td><td>${i[k].avaliados}/${s.total} (${percentual(i[k].avaliados,s.total)})</td></tr>`).join('')}</tbody></table></div></div>
        <div class="painel full"><h2>Ocorrências e ações registradas</h2><p class="sip-nota">Descrições da planilha no período selecionado. Uma ação mencionada não comprova resolução ou eficácia.</p><div class="sip-tabela"><table><caption>Observações de auditoria e campo de ação</caption><thead><tr><th scope="col">Auditoria</th><th scope="col">Observação</th><th scope="col">O que foi feito</th></tr></thead><tbody>${s.rows.filter(r=>r.observacao||r.acao).map(r=>`<tr><td>${data(r.data)}</td><td>${resposta(r.observacao)}</td><td>${resposta(r.acao)}</td></tr>`).join('') || '<tr><td colspan="3">Nenhuma observação ou ação preenchida neste período.</td></tr>'}</tbody></table></div></div>
        <div class="painel full"><h2>Acompanhamento proposto</h2><p class="sip-nota">Pendências de validação da base completa. Recomendações para a equipe, sem responsáveis ou prazos pactuados na planilha.</p><div class="sip-tabela"><table><caption>Próximos passos para acompanhar a SIP</caption><thead><tr><th scope="col">Ponto</th><th scope="col">Próximo passo</th><th scope="col">Evidência necessária</th></tr></thead><tbody>
          <tr><th scope="row">Apontamento da JCI</th><td>Confirmar escopo, meta, frequência de auditoria e critério de encerramento.</td><td>Texto original da SIP e plano acordado.</td></tr>
          <tr><th scope="row">Climatização e pressões</th><td>Verificar o desfecho da notificação mencionada em 29/09 e reavaliar o funcionamento.</td><td>Registro da solução, ambiente, valor medido, unidade, referência e data de reavaliação.</td></tr>
          <tr><th scope="row">Pass-through e demais acessos</th><td>Identificar separadamente cada porta e janela, esclarecendo a janela expurgo–OPME citada em agosto.</td><td>Checklist com localização e critério de avaliação de cada abertura.</td></tr>
          <tr><th scope="row">Rastreabilidade das ações</th><td>Registrar correção, responsável, prazo e resultado da verificação.</td><td>Registro da execução e avaliação de eficácia, inclusive quando a correção for imediata.</td></tr>
        </tbody></table></div></div>
        <div class="painel full"><details><summary>Consultar os registros do período (${s.total})</summary><div class="sip-tabela"><table><caption>Respostas originais por data da auditoria</caption><thead><tr><th scope="col">Data</th><th scope="col">Pass-through fechado</th><th scope="col">Portas abertas</th><th scope="col">Articulados abertos</th><th scope="col">Pressões funcionando</th></tr></thead><tbody>${s.rows.map(r=>`<tr><td>${data(r.data)}</td><td>${resposta(r.passThrough)}</td><td>${resposta(r.portasAbertas)}</td><td>${resposta(r.articulados)}</td><td>${resposta(r.pressoes)}</td></tr>`).join('')}</tbody></table></div></details></div>
      </div>
      <p class="sip-fonte">Fonte: ${esc(base.fonte)}. Agrupamento pela data da auditoria, que pode diferir da data de preenchimento. Esta base é independente da atualização dos demais painéis.</p>
      <section class="analise-critica" aria-label="Análise crítica — SIP CME"><div class="ac-cabecalho"><div><span class="ac-selo">Análise crítica</span><h2>SIP — CME · ${select.value==='total'?'Todo o período':mes(select.value)}</h2></div></div><p class="ac-subtitulo">Análise descritiva para validação pela equipe · ${quantidade(s.total,'auditoria','auditorias')} no recorte</p><div data-ac-edit="paragrafos" data-ac-tipo="lista" data-ac-classe="sip-paragrafo" aria-label="Texto da análise crítica SIP CME">${analise(s).map(p=>`<p class="sip-paragrafo">${esc(p)}</p>`).join('')}</div>
      <details class="ac-limites"><summary>Limitações e critérios de leitura</summary><ul data-ac-edit="limites" data-ac-tipo="lista" aria-label="Limitações e critérios de leitura"><li>Sem informação, não auditado e resposta “Não” são categorias distintas.</li><li>As observações não permitem confirmar se a janela expurgo–OPME e o pass-through são estruturas distintas.</li><li>O formulário não registra valores de pressão, ambiente ou método de medição, nem permite demonstrar cobertura de todos os turnos.</li><li>As taxas descrevem as auditorias com respostas válidas. A cobertura utiliza todas as auditorias do recorte.</li><li>O período de novembro contém dados somente até 03/11/2026 nesta versão da base.</li></ul></details></section>`;
      if (typeof AnaliseEditor !== 'undefined') AnaliseEditor.montar({box:sec.querySelector('.analise-critica'),aba:'sip-cme',filtro:select.value,base:{fonte:base.fonte,registros:s.rows}});
      if (typeof Chart !== 'undefined' && s.total) {
        grafico = new Chart(sec.querySelector('#sip-evolucao'), {
          type:'bar', data:{labels:s.meses.map(m=>mes(m.periodo)),datasets:[
            {label:'Com portas abertas',data:s.meses.map(m=>m.portas.sim),backgroundColor:'#d97706'},
            {label:'Sem portas abertas',data:s.meses.map(m=>m.portas.nao),backgroundColor:'#2563eb'},
            {label:'Sem avaliação registrada',data:s.meses.map(m=>m.portas.semRegistro+m.portas.naoAuditado),backgroundColor:'#94a3b8'}
          ]},options:{responsive:true,maintainAspectRatio:false,scales:{x:{stacked:true},y:{stacked:true,beginAtZero:true,ticks:{precision:0}}},plugins:{legend:{position:'bottom'}}}
        });
      }
    }
    select.addEventListener('change', atualizar);
    atualizar();
  }
  return {resumir, analise, contar, percentual, montar};
});

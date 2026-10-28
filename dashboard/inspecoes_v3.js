/* Painel de Inspecoes v3 - filtro por ano + 8 graficos.
   Carregado DEPOIS do script principal: substitui RENDER.inspecoes.
   Os helpers (fmt, cor, dsRotulo, badgeClasse, novoGrafico) vem do escopo global. */
(function(){

  RENDER.inspecoes_v3 = function(){
    const I = DADOS.inspecoes;
    const anos = I.anos;

    const sec = document.getElementById('aba-inspecoes');
    sec.innerHTML = `
      <div class="seletor-anos" id="ins-anos">
        <span>Período:</span>
        <button data-ano="total" class="ativo">Todos</button>
        ${anos.map(a => `<button data-ano="${a}">${a}</button>`).join('')}
      </div>
      <div class="kpis" id="ins-kpis"></div>
      <div class="grade" id="ins-graficos"></div>`;

    function render(sel){
      document.querySelectorAll('#ins-anos button').forEach(b => b.classList.toggle('ativo', b.dataset.ano === String(sel)));

      const B = (sel === 'total') ? I.total : I.por_ano[String(sel)];
      if (!B) return;
      const G = (sel === 'total') ? 'Todos os anos' : sel;

      document.getElementById('ins-kpis').innerHTML = `
        <div class="kpi"><div class="rotulo">Ações (${G})</div><div class="valor">${fmt(B.total)}</div><div class="detalhe">${fmt(B.inspecoes)} inspeções</div></div>
        <div class="kpi bad"><div class="rotulo">Em aberto</div><div class="valor">${fmt(B.abertos)}</div><div class="detalhe">${fmt(B.situacao_prazo.atrasada || 0)} atrasadas</div></div>
        <div class="kpi ok"><div class="rotulo">Concluídas</div><div class="valor">${fmt(B.concluidos)}</div><div class="detalhe">${B.pct_conclusao}% do total</div></div>
        <div class="kpi info"><div class="rotulo">GUT médio</div><div class="valor">${B.gut_medio ?? '—'}</div><div class="detalhe">prioridade média</div></div>`;

      document.getElementById('ins-graficos').innerHTML = `
        <div class="painel full"><h2>Apontamentos por mês — concluídos x em andamento</h2><div class="canvas-wrap alto"><canvas id="g-iap"></canvas></div></div>
        <div class="painel"><h2>Status geral</h2><div class="canvas-wrap"><canvas id="g-ist"></canvas></div></div>
        <div class="painel"><h2>Prioridade GUT (em aberto)</h2><div class="canvas-wrap"><canvas id="g-ipr"></canvas></div></div>
        <div class="painel"><h2>Atrasos por setor responsável</h2><div class="canvas-wrap alto"><canvas id="g-iat"></canvas></div></div>
        <div class="painel"><h2>Em aberto por setor inspecionado</h2><div class="canvas-wrap alto"><canvas id="g-ise"></canvas></div></div>
        <div class="painel"><h2>Em aberto por andar</h2><div class="canvas-wrap"><canvas id="g-ian"></canvas></div></div>
        <div class="painel"><h2>Em aberto por categoria FMS</h2><div class="canvas-wrap alto"><canvas id="g-icf"></canvas></div></div>
        <div class="painel full"><h2>Inspeções por mês (quantidade)</h2><div class="canvas-wrap"><canvas id="g-iim"></canvas></div></div>
        <div class="painel full"><h2>Ações em aberto de prioridade alta/imediata</h2>
          <div style="max-height:420px; overflow:auto;">
            <table>
              <thead><tr><th>Data</th><th>Setor</th><th>Apontamento</th><th>Responsável</th><th>Prioridade</th><th>GUT</th><th>Situação</th></tr></thead>
              <tbody>
                ${B.prioridade_alta.map(a => `
                  <tr>
                    <td>${a.data}</td><td>${a.setor}</td><td class="apont">${a.apontamento}</td>
                    <td>${a.responsavel}</td>
                    <td><span class="badge bad">${a.prioridade}</span></td>
                    <td>${a.gut ?? '—'}</td>
                    <td><span class="badge ${badgeClasse(a.situacao)}">${a.situacao}</span></td>
                  </tr>`).join('') || '<tr><td colspan="7" class="vazio">Nenhuma ação de prioridade alta em aberto</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>`;

      ['g-iap','g-ist','g-ipr','g-iat','g-ise','g-ian','g-icf','g-iim'].forEach(id => {
        const c = Chart.getChart(id); if (c) c.destroy();
      });

      const am = B.apontamentos_mes;
      novoGrafico('g-iap', 'bar', am.labels, [
        { label: 'Concluídos', data: am.concluidos, backgroundColor: '#16a34a', borderRadius: 4 },
        { label: 'Em andamento', data: am.andamento, backgroundColor: '#2563eb', borderRadius: 4 }
      ], { variant: 'stacked', xLabel: 'mês/ano', yLabel: 'apontamentos' });

      novoGrafico('g-ist', 'doughnut', Object.keys(B.status),
        [{ data: Object.values(B.status), backgroundColor: ['#16a34a', '#2563eb'] }]);

      const ordPri = ['Imediata', 'Alta', 'Moderada', 'Baixa', 'Pendente de avaliação', 'Sem avaliação'];
      const priKeys = ordPri.filter(k => B.prioridade_aberto[k]);
      novoGrafico('g-ipr', 'doughnut', priKeys,
        [{ data: priKeys.map(k => B.prioridade_aberto[k]),
           backgroundColor: priKeys.map(k => ({'Imediata':'#7f1d1d','Alta':'#dc2626','Moderada':'#d97706','Baixa':'#16a34a','Pendente de avaliação':'#94a3b8','Sem avaliação':'#64748b'}[k])) }]);

      const at = [...B.atrasos_responsavel].sort((a,b) => b.total - a.total);
      novoGrafico('g-iat', 'bar', at.map(x => x.setor),
        [dsRotulo('Atrasadas', at.map(x => x.total), '#dc2626')],
        { indexAxis: 'y', plugins: { legend: { display: false } } });

      const se = [...B.abertos_setor].sort((a,b) => b.total - a.total);
      novoGrafico('g-ise', 'bar', se.map(x => x.setor),
        [dsRotulo('Em aberto', se.map(x => x.total), '#2563eb')],
        { indexAxis: 'y', plugins: { legend: { display: false } } });

      const an = [...B.abertos_andar].sort((a,b) => b.total - a.total);
      novoGrafico('g-ian', 'bar', an.map(x => x.andar),
        [dsRotulo('Em aberto', an.map(x => x.total),
          an.map(x => x.andar === 'Não identificado' ? '#94a3b8' : '#7c3aed'))],
        { indexAxis: 'y', plugins: { legend: { display: false } } });

      const cf = [...B.categoria_fms_aberto].sort((a,b) => b.total - a.total);
      novoGrafico('g-icf', 'bar', cf.map(x => x.categoria),
        [dsRotulo('Em aberto', cf.map(x => x.total), '#0891b2')],
        { indexAxis: 'y', plugins: { legend: { display: false } } });

      const im = B.inspecoes_mes;
      novoGrafico('g-iim', 'line', im.labels,
        [{ label: 'Inspeções realizadas', data: im.valores, borderColor: '#1e3a5f',
           backgroundColor: 'rgba(30,58,95,.12)', fill: true, tension: .3, pointRadius: 4 }],
        { yLabel: 'inspeções' });
    }

    document.getElementById('ins-anos').addEventListener('click', e => {
      const b = e.target.closest('button[data-ano]');
      if (b) render(b.dataset.ano);
    });

    render('total');
  };

  RENDER.inspecoes = RENDER.inspecoes_v3;
  if (renderizado.inspecoes) { renderizado.inspecoes = false; RENDER.inspecoes(); renderizado.inspecoes = true; }

})();

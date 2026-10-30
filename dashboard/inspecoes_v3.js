/* Painel de Inspecoes v3 - filtro por ano + 8 graficos.
   Carregado DEPOIS do script principal: substitui RENDER.inspecoes.
   Os helpers (fmt, cor, dsRotulo, badgeClasse, novoGrafico) vem do escopo global. */
(function(){
  const escapar = value => String(value ?? '').replace(/[&<>"']/g,
    c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const graficos = ['g-iap','g-ist','g-ipr','g-iat','g-ise','g-icf','g-iim','g-ico'];

  RENDER.inspecoes_v3 = function(){
    const I = DADOS.inspecoes;
    const anos = I.anos;

    const sec = document.getElementById('aba-inspecoes');
    sec.innerHTML = `
      <div class="seletor-anos" id="ins-anos">
        <span>Período:</span>
        <button data-ano="total" class="ativo" aria-pressed="true">Todos</button>
        ${anos.map(a => `<button data-ano="${a}" aria-pressed="false">${a}</button>`).join('')}
      </div>
      <div class="kpis" id="ins-kpis"></div>
      <div class="grade" id="ins-graficos"></div>`;

    function render(sel){
      document.querySelectorAll('#ins-anos button').forEach(b => {
        const ativo = b.dataset.ano === String(sel);
        b.classList.toggle('ativo', ativo);
        b.setAttribute('aria-pressed', String(ativo));
      });

      const B = (sel === 'total') ? I.total : I.por_ano[String(sel)];
      if (!B) return;
      const G = (sel === 'total') ? 'Todos os anos' : sel;
      const conclusao = [...B.conclusao_responsavel].sort((a,b) =>
        b.concluidos / b.total - a.concluidos / a.total || b.total - a.total || a.setor.localeCompare(b.setor));
      const percentual = x => x.total ? x.concluidos / x.total * 100 : 0;
      // Destruir os gráficos antes de remover seus canvases do documento.
      graficos.forEach(id => { const c = Chart.getChart(id); if (c) c.destroy(); });

      document.getElementById('ins-kpis').innerHTML = `
        <div class="kpi"><div class="rotulo">Ações (${G})</div><div class="valor">${fmt(B.total)}</div><div class="detalhe">${fmt(B.inspecoes)} inspeções</div></div>
        <div class="kpi bad"><div class="rotulo">Em aberto</div><div class="valor">${fmt(B.abertos)}</div><div class="detalhe">${fmt(B.situacao_prazo.atrasada || 0)} atrasadas</div></div>
        <div class="kpi ok"><div class="rotulo">Concluídas</div><div class="valor">${fmt(B.concluidos)}</div><div class="detalhe">${fmt(B.pct_conclusao)}% do total</div></div>
        <div class="kpi info"><div class="rotulo">GUT médio</div><div class="valor">${B.gut_medio == null ? '—' : fmt(B.gut_medio)}</div><div class="detalhe">prioridade média</div></div>`;

      document.getElementById('ins-graficos').innerHTML = `
        <div class="painel full"><h2>Apontamentos por mês — concluídos x em andamento</h2><div class="canvas-wrap alto"><canvas id="g-iap"></canvas></div></div>
        <div class="painel"><h2>Status geral</h2><div class="canvas-wrap"><canvas id="g-ist"></canvas></div></div>
        <div class="painel"><h2>Prioridade GUT (em aberto)</h2>${B.abertos ? '' : '<p class="vazio">Nenhuma ação em aberto neste período.</p>'}<div class="canvas-wrap"><canvas id="g-ipr"></canvas></div></div>
        <div class="painel"><h2>Apontamentos por setor</h2><p style="font-size:.82rem;color:var(--muted);margin-bottom:12px">Setor responsável · todas as ações concluídas e em aberto no período selecionado.</p><div class="canvas-wrap alto"><canvas id="g-iat"></canvas></div></div>
        <div class="painel full"><h2>Taxa de conclusão por setor responsável</h2>
          <p class="vazio">Status atual dos apontamentos registrados no período selecionado. Considere também o volume, os prazos e a gravidade das ações.</p>
          ${conclusao.length ? '' : '<p class="vazio">Nenhum apontamento neste período.</p>'}
          <div class="canvas-wrap alto"><canvas id="g-ico" role="img" aria-label="Percentual de apontamentos concluídos e em aberto por setor responsável. Quantidades na tabela abaixo."></canvas></div>
          <details><summary>Ver percentuais e quantidades por setor</summary><div style="overflow:auto"><table>
            <thead><tr><th>Setor responsável</th><th>Concluídos</th><th>Em aberto</th><th>Total</th><th>Conclusão</th></tr></thead>
            <tbody>${conclusao.map(x => `<tr><td>${escapar(x.setor)}</td><td>${fmt(x.concluidos)}</td><td>${fmt(x.abertos)}</td><td>${fmt(x.total)}</td><td>${fmt(percentual(x))}%</td></tr>`).join('')}</tbody>
          </table></div></details>
        </div>
        <div class="painel"><h2>Em aberto por setor inspecionado</h2><div class="canvas-wrap alto"><canvas id="g-ise"></canvas></div></div>
        <div class="painel"><h2>Apontamentos por categoria FMS — todos os status</h2><p style="font-size:.82rem;color:var(--muted);margin-bottom:12px">Inclui todas as categorias, com ações concluídas e em aberto no período selecionado.</p><div class="canvas-wrap alto"><canvas id="g-icf"></canvas></div></div>
        <div class="painel full"><h2>Inspeções por mês (quantidade)</h2><p class="vazio">Contagem por data de registro e setor; múltiplos apontamentos da mesma visita contam uma vez.</p><div class="canvas-wrap"><canvas id="g-iim"></canvas></div></div>
        <div class="painel full"><h2>Ações em aberto de prioridade alta/imediata</h2><p class="vazio">Até 40 ações mais recentes do período.</p>
          <div style="max-height:420px; overflow:auto;">
            <table>
              <thead><tr><th>Data</th><th>Setor</th><th>Apontamento</th><th>Responsável</th><th>Prioridade</th><th>GUT</th><th>Situação</th></tr></thead>
              <tbody>
                ${B.prioridade_alta.map(a => `
                  <tr>
                    <td>${escapar(a.data)}</td><td>${escapar(a.setor)}</td><td class="apont">${escapar(a.apontamento)}</td>
                    <td>${escapar(a.responsavel)}</td>
                    <td><span class="badge bad">${escapar(a.prioridade)}</span></td>
                    <td>${a.gut ?? '—'}</td>
                    <td><span class="badge ${badgeClasse(a.situacao)}">${escapar(a.situacao)}</span></td>
                  </tr>`).join('') || '<tr><td colspan="7" class="vazio">Nenhuma ação de prioridade alta em aberto</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>`;

      [['g-ico', conclusao], ['g-iat', B.apontamentos_responsavel], ['g-ise', B.abertos_setor],
       ['g-icf', B.categoria_fms]].forEach(([id, rows]) => {
        document.getElementById(id).parentElement.style.height = `${Math.max(280, rows.length * 28 + 50)}px`;
      });

      const am = B.apontamentos_mes;
      novoGrafico('g-iap', 'bar', am.labels, [
        { label: 'Concluídos', data: am.concluidos, backgroundColor: '#16a34a', borderRadius: 4 },
        { label: 'Em andamento', data: am.andamento, backgroundColor: '#2563eb', borderRadius: 4 }
      ], { scales: {
        x: { stacked: true, title: { display: true, text: 'Mês/ano do registro' } },
        y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Apontamentos' } }
      } });

      novoGrafico('g-ist', 'doughnut', Object.keys(B.status),
        [{ data: Object.values(B.status), backgroundColor: ['#16a34a', '#2563eb'] }]);

      const ordPri = ['Imediata', 'Alta', 'Moderada', 'Baixa', 'Pendente de avaliação', 'Sem avaliação'];
      const priKeys = [...ordPri.filter(k => B.prioridade_aberto[k]),
        ...Object.keys(B.prioridade_aberto).filter(k => !ordPri.includes(k))];
      novoGrafico('g-ipr', 'doughnut', priKeys,
        [{ data: priKeys.map(k => B.prioridade_aberto[k]),
           backgroundColor: priKeys.map(k => ({'Imediata':'#7f1d1d','Alta':'#dc2626','Moderada':'#d97706','Baixa':'#16a34a','Pendente de avaliação':'#94a3b8','Sem avaliação':'#64748b'}[k])) }]);

      const at = [...B.apontamentos_responsavel].sort((a,b) => b.total - a.total);
      novoGrafico('g-iat', 'bar', at.map(x => x.setor),
        [dsRotulo('Apontamentos (todos os status)', at.map(x => x.total), '#2563eb')],
        { indexAxis: 'y', scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { ticks: { autoSkip: false } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.parsed.x} apontamentos (${B.total ? fmt(ctx.parsed.x / B.total * 100) : '0'}% do total)` } } } });

      const se = [...B.abertos_setor].sort((a,b) => b.total - a.total);
      novoGrafico('g-ico', 'bar', conclusao.map(x => x.setor), [
        {label: 'Concluídos', data: conclusao.map(percentual), backgroundColor: '#16a34a'},
        {label: 'Em aberto', data: conclusao.map(x => 100 - percentual(x)), backgroundColor: '#d97706'}
      ], {indexAxis: 'y', scales: {
        x: {stacked: true, min: 0, max: 100, ticks: {callback: v => `${v}%`}},
        y: {stacked: true, ticks: {autoSkip: false}}
      }, plugins: {legend: {display: true}, tooltip: {mode: 'index', intersect: false, callbacks: {
        label: ctx => {
          const x = conclusao[ctx.dataIndex];
          const n = ctx.datasetIndex === 0 ? x.concluidos : x.abertos;
          return `${ctx.dataset.label}: ${fmt(n / x.total * 100)}% — ${fmt(n)} de ${fmt(x.total)} apontamentos`;
        }
      }}}});
      novoGrafico('g-ise', 'bar', se.map(x => x.setor),
        [dsRotulo('Em aberto', se.map(x => x.total), '#2563eb')],
        { indexAxis: 'y', plugins: { legend: { display: false } } });

      const cf = [...B.categoria_fms].sort((a,b) => b.total - a.total);
      novoGrafico('g-icf', 'bar', cf.map(x => x.categoria),
        [dsRotulo('Apontamentos (todos os status)', cf.map(x => x.total), '#0891b2')],
        { indexAxis: 'y', scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { ticks: { autoSkip: false, font: { size: 10 } } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.parsed.x} apontamentos (${B.total ? fmt(ctx.parsed.x / B.total * 100) : '0'}% do total)` } } } });

      const im = B.inspecoes_mes;
      novoGrafico('g-iim', 'line', im.labels,
        [{ label: 'Inspeções realizadas', data: im.valores, borderColor: '#1e3a5f',
           backgroundColor: 'rgba(30,58,95,.12)', fill: true, tension: .3, pointRadius: 4 }],
        { scales: { y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: 'Inspeções' } } } });
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

# Vinicius Analista Qualidade — Dashboard Integrado da Qualidade

Site público com **6 painéis integrados** da Qualidade do Hospital Vera Cruz, em um só lugar:

| Aba | Fonte (aba da planilha) | Conteúdo |
|---|---|---|
| 🏠 Visão Geral | todas | KPIs consolidados e atalhos |
| 🔍 Inspeções | Inspeção das Instalações | GUT, prioridades, setores, prazos |
| 🔄 Rounds | Rounds + Interações (2 abas) | Realizados x previstos, % por setor, interações |
| 📢 Huddle | Planos de ação Huddle + Foloow Up Huddle | Status, áreas, categorias, evolução anual |
| 🛏️ Watcher | Pacientes Watcher | Desfechos, motivos, tempo de vigilância (**anonimizado**) |
| 📋 JCI + Comitês | Planos de ação JCI + Planos de Ação | Conformidade por capítulo, planos de comitê |

**Site:** https://viniciusnascimento179.github.io/vinicius-analista-qualidade/

## Ouvidoria

A aba Ouvidoria permite filtrar ano de abertura, setor, tipo e status. Mostra
conclusões, elogios, queixas, solicitações, todos os setores com registros em
barras horizontais e os principais motivos. O catálogo de setores sem registros
pode ser incluído no gráfico. A análise crítica acompanha os filtros e fica ao final.

Atualize a fonte separada localmente, sem adicionar o arquivo original ao GitHub:

```bash
python scripts/importa_ouvidoria.py --fonte "caminho/Nova Planilha Ouvidoria Oficial 1 2026.xlsx"
python -m unittest discover -s scripts -p 'test_*.py'
node scripts/test_ouvidoria.cjs
python scripts/versiona_assets.py
```

O arquivo `dashboard/ouvidoria-dados.js` contém somente contagens por ano/mês,
setor, tipo, status e motivo. Pacientes, responsáveis nominais, números de BO,
descrições e observações são excluídos. Motivos fora do catálogo são agrupados
como “Motivo não padronizado”. Campos vazios permanecem “Não informado”.
Cada linha preenchida conta como um registro; BO repetido não é deduplicado.
O ano vem da data de abertura, mesmo quando difere do nome da aba. A atualização
da planilha principal preserva esta base independente da Ouvidoria.

## Atualização diária por pasta local

A tarefa recorrente no Codex consulta a pasta **Dados dos Painéis** na Área de
Trabalho todos os dias às **8h (horário de Brasília)**. O computador precisa estar
ligado e o Codex aberto. Substitua a planilha principal diariamente, mantendo
apenas uma versão atual. A fonte do SIP/CME é uma planilha separada; quando ela
não estiver disponível, os dados já publicados desse painel são preservados.

O processamento local aceita o caminho do arquivo, sem copiar o original para
o repositório:

```bash
python scripts/processa_dados.py --fonte "caminho/planilha.xlsx"
```

Valide os resultados e os testes antes de publicar os dados gerados em
`dashboard/data.js`. Não envie as planilhas originais para o repositório público.
Se os indicadores não mudarem, o processamento preserva a data de atualização.

O workflow **Atualizar dashboard** valida e publica os dados processados.
Alterações apenas no dashboard ou nos scripts não reprocessam a planilha antiga
do repositório. O reprocessamento dessa base ocorre somente se `data/` mudar ou
se a opção **Reprocessar a planilha armazenada no repositório** for marcada em
**Actions → Atualizar dashboard → Run workflow**. Deixe essa opção desmarcada
para republicar os dados mais recentes processados localmente.

## Privacidade (Watcher)

O pipeline **remove do site** os campos: Prontuário, N° de Atendimento, Nome, Nascimento,
Quarto/Leito, Setores percorridos, Responsável (nomes) e Observações. O painel mostra
apenas dados agregados (contagens por motivo, desfecho, faixa de tempo).

## Estrutura

```
data/planos_de_acao_qualidade.xlsx   <- planilha do Power BI (12 abas)
scripts/processa_dados.py            <- pipeline: lê, limpa, anonimiza e agrega
dashboard/index.html                 <- site (6 abas, Chart.js)
dashboard/data.js                    <- dados processados (gerado pelo pipeline)
.github/workflows/                   <- automação GitHub Actions
```

## Rodar localmente

```bash
pip install -r requirements.txt
python scripts/processa_dados.py
# abrir dashboard/index.html no navegador
```
# Análise crítica dos painéis

Cada aba contém uma análise descritiva dos dados: achados, interpretação, ações
sugeridas, acompanhamento e limitações. Nas abas Inspeções e Rounds, o texto
acompanha o ano selecionado. As análises são calculadas no navegador sem enviar
dados a serviços externos de IA.

Em **Registro da equipe**, registre a conclusão validada, causas e evidências,
ações, meta, responsável, prazo e avaliação de eficácia. Clique em **Salvar
rascunho neste navegador**. Os registros ficam no armazenamento local deste
navegador, separados por aba e período; não são publicados nem compartilhados.
Limpar os dados do navegador remove os rascunhos. Uma mudança da base sinaliza
a necessidade de revisão. O recurso não oferece assinatura eletrônica ou trilha
de auditoria institucional.

**Exportar relatório (.html)** gera um arquivo com a análise automática, a base,
o período e os campos atuais da equipe. Abra-o no navegador e use **Imprimir →
Salvar como PDF**, se necessário. Arquive o relatório conforme o processo da
instituição. Não insira identificadores de pacientes nos campos de texto.

A referência metodológica é o capítulo QPS dos
[padrões hospitalares JCI, 8ª edição](https://digitalassets.jointcommission.org/api/public/content/79e9f5d2cd444a1a9178ab3f9487889a?v=4d4ea7b7).
O texto automático apoia a avaliação da equipe; não certifica conformidade.

O gráfico de categorias FMS inclui **todos os status** no período selecionado,
sem limitar a quantidade de categorias. A soma das barras corresponde ao total
de apontamentos do recorte.

Testes: `python -m unittest discover -s scripts -p 'test_*.py'` e
`node scripts/test_analises.cjs`. Ambos também são executados antes da publicação.

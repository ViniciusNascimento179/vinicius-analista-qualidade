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

## Como atualizar (ritual mensal)

1. Baixe a planilha nova (Power BI) e salve como `planos_de_acao_qualidade.xlsx`
2. No GitHub, entre em **Add file → Upload files** e suba o arquivo **na pasta `data/`** (substituindo o antigo)
3. Commit — o workflow **"Atualizar dashboard"** roda sozinho e publica o site novo em ~2 minutos
4. Acompanhe em **Actions**; se quiser forçar, **Actions → Atualizar dashboard → Run workflow**

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
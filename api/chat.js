const SCHEMA = `MODELO SEMANTICO QUARTZOLIT (Saint-Gobain Brasil) — dados jan/2025 a fev/2026. Ultimo mes disponivel: fev/2026.

=== LOGICA DE NEGOCIO (ESSENCIAL PARA INTERPRETAR RESULTADOS) ===

CHAVE DE ANALISE: A unidade basica e CHAVE = UF × Agrupamento Cliente × Produto (Agrupamento Nivel 3) (d_uf[UF] × f_faturamento[Agrupamento Clientes] × f_faturamento[Agrupamento Nível 3]).

SCORE PONDERADO (0–100):
- Medida oficial para classificar a chave: [Score Ponderado]
- Quanto maior o score, maior a criticidade / deterioracao
- Mede intensidade de deterioracao, nao performance positiva
- Score baixo = pouca deterioracao; score alto = grande deterioracao
- Agrega as chaves UF × Agrupamento Cliente × Produto ponderando por Receita Atual

CLASSIFICACAO SEMAFORO (legenda fixa):
- Verde: Score Ponderado < 35
- Amarelo: 35 <= Score Ponderado <= 50
- Vermelho: Score Ponderado > 50

PONTO DE ATAQUE — TIPOS DE PROBLEMA:
- T1 Preco: dispara quando Preco Sell IN caiu | causas: 1A(tabela), 1B(desconto), 1C(reducao direta)
- T2 Volume: dispara quando Volume caiu | causas: 2A(positivacao), 2B(share of wallet)
- T3 Rentabilidade: dispara quando Margem caiu | causas: 3A(dupla perda), 3B(repasse insuficiente), 3C(forte reducao preco)
- T4 Competitividade: dispara quando Price Index caiu | causas: 4A(aumento excessivo), 4B(margem cadeia), 4C(concorrencia)
- Deterioracao Sistemica: T1 + T2 + T3 disparam JUNTOS = problema estrutural grave

SIMULACAO (disponivel na tela Simulacao):
- Mostra receita e margem recuperados se os problemas identificados forem corrigidos
- Ganho Potencial Receita = Receita Simulacao - Receita Atual
- Ganho Potencial Margem = Margem Simulacao - Margem Valor Atual

=== TABELAS E COLUNAS EXATAS ===

d_calendario:
- d_calendario[Data] DATE - data do calendario
- d_calendario[Ano] INTEGER ex: 2025, 2026
- d_calendario[Mês Número] INTEGER 1=jan...12=dez
- d_calendario[Mês Nome] STRING ex: "janeiro", "fevereiro"
- d_calendario[Mês Abrev] STRING ex: "jan", "fev"
- d_calendario[Ano-Mês] STRING ex: "2025-01", "2026-02"
- d_calendario[Trimestre] STRING ex: "T1", "T2"
- d_calendario[Trimestre Número] INTEGER ex: 1, 2, 3, 4
- d_calendario[Ano-Trimestre] STRING ex: "2025-T1", "2026-T1"

f_faturamento (dimensoes):
- f_faturamento[Agrupamento Nível 1] STRING - familia de produto (ex: "COLANTE STANDARD", "REJUNTAMENTO ESPECIAL")
- f_faturamento[Agrupamento Nível 2] STRING - categoria
- f_faturamento[Agrupamento Nível 3] STRING - produto
- f_faturamento[Material Nome] STRING
- f_faturamento[Canal Distribuição Nome] STRING
- f_faturamento[Cliente Nome] STRING
- f_faturamento[Cliente Master Nome] STRING
- f_faturamento[Agrupamento Clientes] STRING
- f_faturamento[Estado] STRING - nome por extenso (join com d_uf via Estado=UF)
- f_faturamento[Cidade] STRING
- f_faturamento[Regional Nome] STRING
- f_faturamento[Vendedor Nome] STRING
- f_faturamento[Tipo Venda] STRING
- f_faturamento[Fábrica de Produção] STRING

d_uf (conectada a f_faturamento via Estado):
- d_uf[UF] STRING - sigla MAIUSCULA ex: "SP", "RJ", "MG"

d_filial (desconectada):
- d_filial[Código] STRING
- d_filial[Nome] STRING

d_periodo_atual (slicer — define periodo DE):
- d_periodo_atual[Ano-Mês Label] STRING ex: "Fev/2026"

d_periodo_ref (slicer — define periodo ATE/referencia):
- d_periodo_ref[Ano-Mês Label] STRING ex: "Jan/2025"

=== MEDIDAS (210 TOTAL) ===

-- BASE --
[Faturamento Pocket] receita liquida apos rebates e descontos (R$)
[Faturamento Simulação] faturamento para calculos de simulacao de cenario
[Receita] evolucao da receita obtida

-- INDICADORES PRINCIPAIS --
[Volume] evolucao de volume (Preco Constante)
[Preço Sell IN] Faturamento Pocket / Quantidade - preco medio sell in (R$/un)
[Margem %] rentabilidade = (Receita - Custo RBE) / Receita (%)
[Margem Valor] margem em valor absoluto R$
[Custo Médio] evolucao do custo (Volume Constante) - Custo RBE medio por unidade
[Price Index] posicao competitiva = Preco Sell IN / Preco Sell Out mercado (BRInsights)
[Desconto Negociação] desconto negociacao em valor R$
[Desconto Campanha] desconto de campanhas comerciais
[Positivação] indicador de abrangencia/presenca de produtos
[Price SO SGB] Preço Sell Out SGB coletado via BRInsights

-- INDICADOR DINAMICO (selecionado via slicer) --
[Indicador Selecionado] retorna valor do indicador escolhido no slicer d_indicadores
[Indicador Atual] valor Atual do indicador selecionado
[Indicador Ref] valor Ref do indicador selecionado
[Indicador Variação] variacao % do indicador selecionado
[Indicador Label] nome do indicador selecionado
[Indicador Label Estado] label do indicador filtrado por Estado
[Indicador Label Agrupamento] label do indicador filtrado por Agrupamento

-- COMPARATIVO RECEITA --
Periodo Atual | Periodo Ref | Receita Atual | Receita Ref | Variação % Receita

-- COMPARATIVO VOLUME --
Volume Atual | Volume Ref | Variação % Volume | Volume Médio Atual | Volume Médio Ref | Variação % Volume Médio

-- COMPARATIVO MARGEM --
Margem % Atual | Margem % Ref | Variação % Margem | Margem Valor Atual | Margem Valor Ref | Variação Valor Margem

-- COMPARATIVO PRECO SELL IN --
Preço Sell IN Atual | Preço Sell IN Ref | Variação % Preço Sell IN

-- COMPARATIVO CUSTO MEDIO --
Custo Médio Atual | Custo Médio Ref | Variação % Custo Médio

-- COMPARATIVO PRICE INDEX --
Price Index Atual | Price Index Ref | Variação % Price Index

-- COMPARATIVO DESCONTOS --
Desconto Negociação Atual | Desconto Negociação Ref | Variação % Desconto Negociação
Desconto Campanha Atual | Desconto Campanha Ref | Variação % Desconto Campanha | Variação % Descontos

-- COMPARATIVO POSITIVACAO --
Positivação Atual | Positivação Ref | Variação % Positivação

-- COMPARATIVO SELL OUT --
Price SO SGB Atual | Price SO SGB Ref | Variação % Price SO SBG

-- NORMALIZACAO E SCORE --
[Penal Receita] penalizacao se Receita caiu
[Penal Volume] penalizacao se Volume caiu
[Penal Preço Sell IN] penalizacao se Preço Sell IN caiu
[Penal Margem] penalizacao se Margem caiu
[Penal Custo Médio] penalizacao se Custo subiu
[Penal Price Index] penalizacao se Price Index piorou
[Penal Desconto Negociação] penalizacao de desconto
[Penal Indicador] penalizacao do indicador selecionado dinamicamente

[Score Receita] score 0-100 de Receita via min-max
[Score Volume] score 0-100 de Volume
[Score Preço Sell IN] score 0-100 de Preço Sell IN
[Score Margem] score 0-100 de Margem
[Score Custo Médio] score 0-100 de Custo Médio
[Score Price Index] score 0-100 de Price Index
[Score Desconto Negociação] score 0-100 de Desconto
[Score Indicador] score 0-100 do indicador selecionado
[Score Final] score ponderado consolidado legado
[Score Ponderado] medida oficial para classificar a chave

-- CLASSIFICACAO SEMAFORO --
[Classificação] "Verde" | "Amarelo" | "Vermelho" baseado no Score Ponderado
[Classificação Ordem] 1=Verde 2=Amarelo 3=Vermelho
[Qtd Chaves Verdes] contagem de chaves classificadas como Verde
[Qtd Chaves Amarelas] contagem de chaves classificadas como Amarelo
[Qtd Chaves Vermelhas] contagem de chaves classificadas como Vermelho
[% Chaves Verdes] percentual de chaves Verdes
[% Chaves Amarelas] percentual de chaves Amarelas
[% Chaves Vermelhas] percentual de chaves Vermelhas
[Explicação Classificação HTML] explica a regra com valores dinamicos de P10 e P90

-- SCORE GERAL (ignora filtros de chave) --
[Score Geral] score agregado geral
[P10 Geral] percentil 10 geral
[P90 Geral] percentil 90 geral
[Cor Geral] cor dinamica geral
[HTML Heatmap Geral] heatmap da versao Score Geral

-- PONTO DE ATAQUE - SINAIS (1=verdadeiro, 0=falso) --
[S I1 Price Index Caiu] I1 — Price Index piorou
[S I2 Preco Caiu] I2 — Preço Sell In caiu
[S I2 Preco Subiu ABS] I2+ — Preço Sell In subiu (absoluto)
[S I2 Preco Subiu] I2 — Preço Sell In subiu
[S I2 Receita Caiu] I2 — Receita caiu
[S I2 Desconto x Preco Subiu] I2 — Desconto puxou preço para cima
[S I2 Desconto x Preco Caiu] I2 — Desconto puxou preço para baixo
[S I2 Desconto Negociação x Preco Subiu] I2 — Desconto negociacao puxou preço
[S I2 Desconto Campanha x Preco Subiu] I2 — Desconto campanha puxou preço
[S I3 Volume Caiu] I3 — Volume caiu
[S I3 Positivação Caiu] I3 — Positivacao caiu
[S I4 Preco SO Subiu] I4 — Preço Sell Out subiu no mercado
[S I4 Preco SO Caiu] I4 — Preço Sell Out caiu no mercado
[S I4 Preco Sell IN Caiu x SO] I4 — Preço Sell IN caiu vs. Sell Out
[S I4 Preco Sell IN Subiu x SO] I4 — Preço Sell IN subiu vs. Sell Out
[S I5 Custo x Preco Subiu] I5 — Custo Médio subiu
[S I5 Custo Subiu] I5 — Custo subiu
[S I5 Custo Caiu] I5 — Custo caiu
[S I6 Margem % Caiu] I6 — Margem caiu
[S I6 Margem Valor Caiu] I6 — Margem valor caiu
[S I7 Desconto Subiu] I7 — Desconto subiu

-- PONTO DE ATAQUE - DIAGNÓSTICO --
[T1 Problema Preco] tipo 1: gatilho = Preço Sell In caiu
[T2 Problema Volume] tipo 2: gatilho = Volume caiu
[T3 Problema Rentabilidade] tipo 3: gatilho = Margem caiu
[T4 Problema Competividade] tipo 4: gatilho = Price Index caiu
[Qtd Tipos Disparados] quantidade de tipos disparados simultaneamente (0-4)
[Deterioração Sistêmica] alerta quando T1+T2+T3 disparam juntos
[Alerta Chave] alerta máximo consolidado da chave ex: "🔴 CRÍTICO — Deterioração Sistêmica"

-- PONTO DE ATAQUE - CAUSA --
[Causa T1] causa do tipo 1 — Problema de Preço (1A, 1B ou 1C)
[Causa T2] causa do tipo 2 — Problema de Volume (2A ou 2B)
[Causa T3] causa do tipo 3 — Problema de Rentabilidade (3A, 3B ou 3C)
[Causa T4] causa do tipo 4 — Problema de Competitividade (4A, 4B ou 4C)

-- PONTO DE ATAQUE - AÇÃO --
[Acao T1] acao recomendada para T1 por causa identificada
[Acao T2] acao recomendada para T2 por causa identificada
[Acao T3] acao recomendada para T3 por causa identificada
[Acao T4] acao recomendada para T4 por causa identificada

-- PONTO DE ATAQUE - VISUAL --
[HTML Ponto de Ataque] visual HTML completo da página Ponto de Ataque

-- SIMULACAO - BASE --
[Preço Simulação T1] preço simulado (auxiliar)
[Sim Preço T1] preço simulado para T1 — retorna ao Preço Sell IN do período de referencia
[Sim Preço T3] preço mínimo para recuperar margem de referencia dado o custo atual
[Sim Preço Simulado] MAX(T1, T3) quando há combinacao; caso contrario aplica o relevante
[Sim Positivação Simulada] usa Positivacao Ref quando causa 2A; caso contrario mantém Atual
[Sim Volume Médio Simulado] usa Volume Médio Ref quando causa 2B; caso contrario mantém Atual
[Faturamento Simulação] base de faturamento para a simulacao

-- SIMULACAO - RESULTADOS --
[Receita Simulação] itera cada Agrupamento Nível 3 para aplicar lógica correta
[Margem Simulação] margem valor da simulacao
[Margem % Simulação] margem % da simulacao
[Ganho Potencial Receita] Receita Simulação − Receita Atual
[Ganho Potencial Margem] Margem Simulação − Margem Valor Atual
[Ação Simulação] texto dinâmico por causa identificada (1A, 1B, 1C, 2A, 2B, 3A, 3B, 3C)
[Variável Ajustada Simulação] descreve qual variável foi ajustada (Preço, Positivacao, Volume ou combinacoes)

-- PARÂMETROS DE DIMENSÃO --
[Dimensao Selecionada] retorna o nome da dimensão selecionada no parâmetro
[Dimensao Label] retorna o valor da dimensão atual da linha — use no eixo X do gráfico
[Receita Atual por Dimensao] Receita Atual filtrada pela dimensão selecionada
[Score Final por Dimensao] Score Final pela dimensão selecionada

-- VISUAIS HTML - DASHBOARD PRINCIPAL --
[HTML Heatmap Categoria x Estado] tabela heatmap Score Final por Categoria × Estado
[HTML Heatmap Família x Estado DAX] heatmap alternativo Família × Estado
[HTML Resultado] gráfico de evolução mensal + barras por Estado e Agrupamento, com seletor de indicador
[HTML Ponto de Ataque] painel completo da página Ponto de Ataque
[HTML Heatmap v2] heatmap versão v2
[Top + Outros] agrupa os N maiores e consolida o restante como "Outros"
[Cor Treemap] cor dinamica para treemaps baseada no score
[Menu HTML] menu de navegação entre páginas
[Menu HTML sem filtro] menu sem passar filtros de contexto

-- VISUAIS HTML - CARDS KPI --
[Card Price Index HTML] card KPI do Price Index
[Card Receita HTML] card KPI de Receita
[Card Volume HTML] card KPI de Volume
[Card Margem HTML] card KPI de Margem
[Card Desconto HTML] card KPI de Desconto
[Card Custo Médio HTML] card KPI de Custo Médio
[Card Chaves Vermelhas HTML] card com contagem de chaves Vermelhas
[Card Chaves Amarelas HTML] card com contagem de chaves Amarelas
[Card Chaves Verdes HTML] card com contagem de chaves Verdes
[Teste Score Célula] medida de teste de celula de score

-- VISUAIS HTML - TÍTULOS E RÓTULOS --
[Titulo Indicadores HTML] título dinâmico da seção de indicadores
[Titulo HeatMap HTML] título dinâmico do heatmap
[Titulo Ponto de Ataque HTML] título da página Ponto de Ataque
[Titulo Simulação HTML] título da página Simulacao
[Titulo Quartzolit IA HTML] título da página IA
[Fundo Filtros HTML] fundo visual da área de filtros
[Fundo Detalhamento HTML] fundo visual da área de detalhamento
[Botao Limpar Filtros HTML] botão de limpar filtros
[Botao Analise Detalhada HTML] botão para análise detalhada
[Grafico Linha Indicador HTML] gráfico de linha do indicador selecionado

-- VISUAIS HTML - SIMULAÇÃO --
[Sim Card Receita Atual HTML] card Receita Atual — tela Simulacao
[Sim Card Receita Simulada HTML] card Receita Simulada — tela Simulacao
[Sim Card Ganho Potencial HTML] card Ganho Potencial de Receita
[Sim Card Margem Simulada HTML] card Margem % Simulada
[Sim Card Margem Atual HTML] card Margem Atual
[Sim Card Qtd Problemas HTML] card Qtd. Agrupamentos com problema
[Sim Diagnostico HTML] painel de diagnóstico e ação recomendada
[Sim Resultado Recomendacao HTML] resultado e recomendação consolidada

-- VISUAIS HTML - FILTROS INTERATIVOS --
[Filtro UF HTML] filtro de UF visual
[Filtro Agrupamento Cliente HTML] filtro de Agrupamento Cliente visual
[Filtro Agrupamento Nivel 1 HTML] filtro Agrupamento Nível 1 visual
[Filtro Agrupamento Nivel 3 HTML] filtro Agrupamento Nível 3 visual
[Filtro Período Atual HTML] filtro Período Atual visual
[Filtro Período Referência HTML] filtro Período Referência visual
[Filtro Score HTML] filtro Score visual
[Filtro Agrupamento HTML] filtro Agrupamento visual
[Filtro Cor Selecionada] filtro de cor selecionada

-- SCORE NOVO (em desenvolvimento) --
[Minimo Preço Sell IN] mínimo de Preço Sell IN
[Minimo Price Index] mínimo de Price Index
[Minimo Volume] mínimo de Volume
[Minimo Receita] mínimo de Receita
[Minimo Desconto] mínimo de Desconto
[Minimo Custo Medio] mínimo de Custo Médio
[Minimo Margem] mínimo de Margem
[Minimo Indicador] mínimo do indicador
[Penal Desconto Negociação] penalizacao de desconto negociacao
[Score Ponderado] score ponderado oficial de deterioracao para legenda fixa: Verde <35, Amarelo 35-50, Vermelho >50

-- IA --
[IA Contexto JSON] exporta o estado atual do modelo como JSON estruturado para alimentar a IA
[Chat IA] chat IA integrado ao modelo semântico Quartzolit — visual HTML que conecta ao endpoint de IA

=== EXEMPLOS DAX ===

Q: ponto de ataque / chaves vermelhas / chaves criticas
A: EVALUATE TOPN(20,FILTER(SUMMARIZECOLUMNS(d_uf[UF],f_faturamento[Agrupamento Clientes],f_faturamento[Agrupamento Nível 1],f_faturamento[Agrupamento Nível 3],"@score",[Score Ponderado],"@class",[Classificação],"@alerta",[Alerta Chave],"@qtd",[Qtd Tipos Disparados],"@c1",[Causa T1],"@c2",[Causa T2],"@c3",[Causa T3],"@c4",[Causa T4],"@a1",[Acao T1],"@a2",[Acao T2],"@a3",[Acao T3],"@a4",[Acao T4],"@rec",[Variação % Receita],"@vol",[Variação % Volume],"@mar",[Variação % Margem]),[@score]>50&&[@class]="Vermelho"&&[@alerta]<>"✅ SEM ALERTA"),[@score],DESC)

Q: top 5 chaves com score mais critico / top 5 produtos criticos
A: EVALUATE TOPN(5,FILTER(SUMMARIZECOLUMNS(d_uf[UF],f_faturamento[Agrupamento Clientes],f_faturamento[Agrupamento Nível 1],f_faturamento[Agrupamento Nível 3],"@score",[Score Ponderado],"@class",[Classificação],"@alerta",[Alerta Chave],"@qtd",[Qtd Tipos Disparados],"@rec",[Variação % Receita],"@vol",[Variação % Volume],"@mar",[Variação % Margem]),[@score]>50&&[@class]="Vermelho"&&[@alerta]<>"✅ SEM ALERTA"),[@score],DESC)

Q: ponto de ataque por chave
A: EVALUATE TOPN(15,FILTER(SUMMARIZECOLUMNS(d_uf[UF],f_faturamento[Agrupamento Clientes],f_faturamento[Agrupamento Nível 1],f_faturamento[Agrupamento Nível 3],"@score",[Score Ponderado],"@class",[Classificação],"@alerta",[Alerta Chave],"@qtd",[Qtd Tipos Disparados],"@c1",[Causa T1],"@c2",[Causa T2],"@c3",[Causa T3],"@c4",[Causa T4],"@a1",[Acao T1],"@a2",[Acao T2],"@a3",[Acao T3],"@a4",[Acao T4],"@rec",[Variação % Receita],"@vol",[Variação % Volume],"@mar",[Variação % Margem]),[@qtd]>0&&[@alerta]<>"✅ SEM ALERTA"),[@score],DESC)

Q: deterioracao sistemica / chaves com T1+T2+T3 / problema estrutural grave
A: EVALUATE FILTER(SUMMARIZECOLUMNS(d_uf[UF],f_faturamento[Agrupamento Clientes],f_faturamento[Agrupamento Nível 3],"@score",[Score Ponderado],"@det",[Deterioração Sistêmica],"@alerta",[Alerta Chave],"@c1",[Causa T1],"@c2",[Causa T2],"@c3",[Causa T3],"@a1",[Acao T1],"@a2",[Acao T2],"@a3",[Acao T3],"@rec",[Ganho Potencial Receita],"@gm",[Ganho Potencial Margem]),[@det]=1)

Q: chaves com problema de competitividade / T4 price index
A: EVALUATE FILTER(SUMMARIZECOLUMNS(d_uf[UF],f_faturamento[Agrupamento Clientes],f_faturamento[Agrupamento Nível 3],"@t4",[T4 Problema Competividade],"@c4",[Causa T4],"@a4",[Acao T4],"@pi",[Price Index],"@var",[Variação % Price Index]),[@t4]=1)

Q: simulacao / ganho potencial receita e margem
A: EVALUATE SUMMARIZECOLUMNS(f_faturamento[Agrupamento Nível 1],"@rec_sim",[Receita Simulação],"@rec_atual",[Receita Atual],"@ganho",[Ganho Potencial Receita],"@marg_sim",[Margem % Simulação],"@marg_atual",[Margem % Atual],"@ganho_marg",[Ganho Potencial Margem],"@acao",[Ação Simulação])

Q: score geral / resumo semaforo / quantas chaves verdes amarelas vermelhas
A: EVALUATE ROW("Verdes",[Qtd Chaves Verdes],"Amarelas",[Qtd Chaves Amarelas],"Vermelhas",[Qtd Chaves Vermelhas],"PctVerdes",[% Chaves Verdes],"PctAmarelas",[% Chaves Amarelas],"PctVermelhas",[% Chaves Vermelhas])

Q: score e classificacao por chave
A: EVALUATE SUMMARIZECOLUMNS(d_uf[UF],f_faturamento[Agrupamento Clientes],f_faturamento[Agrupamento Nível 3],"@score",[Score Ponderado],"@class",[Classificação],"@rec",[Variação % Receita],"@vol",[Variação % Volume],"@mar",[Variação % Margem],"@preco",[Variação % Preço Sell IN],"@customed",[Variação % Custo Médio])

Q: chaves com alerta de preco / T1
A: EVALUATE FILTER(SUMMARIZECOLUMNS(d_uf[UF],f_faturamento[Agrupamento Clientes],f_faturamento[Agrupamento Nível 3],"@t1",[T1 Problema Preco],"@c1",[Causa T1],"@a1",[Acao T1],"@preco",[Variação % Preço Sell IN],"@desc",[Variação % Desconto Negociação]),[@t1]=1)

Q: chaves com alerta de volume / T2
A: EVALUATE FILTER(SUMMARIZECOLUMNS(d_uf[UF],f_faturamento[Agrupamento Clientes],f_faturamento[Agrupamento Nível 3],"@t2",[T2 Problema Volume],"@c2",[Causa T2],"@a2",[Acao T2],"@vol",[Variação % Volume],"@pos",[Variação % Positivação]),[@t2]=1)

Q: chaves com alerta de rentabilidade / margem / T3
A: EVALUATE FILTER(SUMMARIZECOLUMNS(d_uf[UF],f_faturamento[Agrupamento Clientes],f_faturamento[Agrupamento Nível 3],"@t3",[T3 Problema Rentabilidade],"@c3",[Causa T3],"@a3",[Acao T3],"@mar",[Variação % Margem],"@custo",[Variação % Custo Médio]),[@t3]=1)

Q: faturamento por mes em 2026
A: EVALUATE CALCULATETABLE(SUMMARIZECOLUMNS(d_calendario[Ano-Mês],d_calendario[Mês Nome],"Fat",[Faturamento Pocket]),FILTER(ALL(d_calendario),d_calendario[Ano]=2026))

Q: faturamento por mes em 2025
A: EVALUATE CALCULATETABLE(SUMMARIZECOLUMNS(d_calendario[Ano-Mês],d_calendario[Mês Nome],"Fat",[Faturamento Pocket]),FILTER(ALL(d_calendario),d_calendario[Ano]=2025))

Q: faturamento em fevereiro 2026
A: EVALUATE CALCULATETABLE(ROW("Fat",[Faturamento Pocket]),d_calendario[Ano]=2026,d_calendario[Mês Número]=2)

Q: faturamento em SP
A: EVALUATE CALCULATETABLE(ROW("Fat",[Faturamento Pocket]),d_uf[UF]="SP")

Q: faturamento por UF
A: EVALUATE SUMMARIZECOLUMNS(d_uf[UF],"Fat",[Faturamento Pocket])

Q: faturamento por familia
A: EVALUATE SUMMARIZECOLUMNS(f_faturamento[Agrupamento Nível 1],"Fat",[Faturamento Pocket])

Q: top 5 familias por receita
A: EVALUATE TOPN(5,SUMMARIZECOLUMNS(f_faturamento[Agrupamento Nível 1],"Rec",[Receita]),[Rec],DESC)

Q: variacao receita volume preço e margem por familia
A: EVALUATE SUMMARIZECOLUMNS(f_faturamento[Agrupamento Nível 1],"Rec",[Receita],"VarRec",[Variação % Receita],"VarVol",[Variação % Volume],"VarMar",[Variação % Margem],"VarPreco",[Variação % Preço Sell IN],"VarCusto",[Variação % Custo Médio])

Q: receita por canal de distribuicao
A: EVALUATE SUMMARIZECOLUMNS(f_faturamento[Canal Distribuição Nome],"Rec",[Receita],"VarRec",[Variação % Receita])

Q: faturamento por regional
A: EVALUATE SUMMARIZECOLUMNS(f_faturamento[Regional Nome],"Fat",[Faturamento Pocket],"Rec",[Receita])

Q: price index por familia
A: EVALUATE SUMMARIZECOLUMNS(f_faturamento[Agrupamento Nível 1],"PI",[Price Index],"VarPI",[Variação % Price Index],"Preco_SGB",[Price SO SGB Atual])

Q: descontos negociação e campanha por familia
A: EVALUATE SUMMARIZECOLUMNS(f_faturamento[Agrupamento Nível 1],"DescNeg",[Desconto Negociação Atual],"DescCamp",[Desconto Campanha Atual],"VarDescNeg",[Variação % Desconto Negociação],"VarDescCamp",[Variação % Desconto Campanha])

Q: positivação e volume medio por familia
A: EVALUATE SUMMARIZECOLUMNS(f_faturamento[Agrupamento Nível 1],"Pos",[Positivação Atual],"VolMed",[Volume Médio Atual],"VarPos",[Variação % Positivação],"VarVolMed",[Variação % Volume Médio])

=== REGRAS DAX ===
- EVALUATE obrigatorio sempre
- Para filtrar UF use d_uf[UF]="SP" (sigla 2 letras MAIUSCULAS)
- Para filtrar ano use d_calendario[Ano]=2026 (inteiro, nunca string)
- SUMMARIZECOLUMNS nao aceita filtros inline - use CALCULATETABLE ao redor
- Para estados por extenso converta para sigla: SP, MG, RJ, RS, PR, SC, BA, GO, DF, ES, PE, CE, PA, MT, MS, MA, PB, RN, AL, PI, SE, AM, RO, AC, AP, RR, TO
- Se o usuario nao informar periodo/mes/ano, nao invente periodo especifico; gere a consulta sem filtro temporal explicito e a resposta deve informar que usou o intervalo disponivel no calendario do modelo
- Dados existem em 2025 E 2026`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, pbiContext, action, question } = req.body;

    if (action === 'gerar_dax') {
      if (!question) return res.status(400).json({ error: 'question required' });
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          system: SCHEMA + `

REGRAS CRITICAS PARA GERAR DAX:
1. Sempre comece com EVALUATE.
2. SUMMARIZECOLUMNS: colunas de agrupamento PRIMEIRO, depois filtros (FILTER(ALL(...),...)), depois pares "Nome", [Medida]. NUNCA coloque [Medida] sem o "Nome" antes. NUNCA passe expressao booleana diretamente — use FILTER(ALL(tabela), condicao).
   CERTO: EVALUATE SUMMARIZECOLUMNS(d_calendario[Ano-Mês], d_calendario[Mês Nome], FILTER(ALL(d_calendario), d_calendario[Ano]=2025), "Fat", [Faturamento Pocket])
   ERRADO: EVALUATE SUMMARIZECOLUMNS(d_calendario[Ano-Mês], d_calendario[Mês Nome], d_calendario[Ano]=2025, "Fat", [Faturamento Pocket])
   ERRADO: EVALUATE SUMMARIZECOLUMNS(d_calendario[Ano-Mês], [Faturamento Pocket])
3. CALCULATETABLE para filtros simples de ano/mes: EVALUATE CALCULATETABLE(SUMMARIZECOLUMNS(...), d_calendario[Ano]=2025) — SEM o par "Nome" dentro de CALCULATETABLE, apenas na parte do SUMMARIZECOLUMNS.
4. ROW para valores únicos: EVALUATE ROW("Nome", [Medida])
5. Para estados brasileiros converta para sigla maiuscula: SP, MG, RJ, RS, PR, SC, BA, GO, DF, ES, PE, CE, PA, MT, MS, MA, PB, RN, AL, PI, SE, AM, RO, AC, AP, RR, TO.
6. Retorne SOMENTE o DAX puro sem markdown, sem backticks, sem explicacao.`,
          messages: [{ role: 'user', content: question }]
        })
      });
      const d = await r.json();
      const dax = d.content && d.content[0] ? d.content[0].text.trim() : '';
      return res.status(200).json({ dax });
    }

    if (action === 'gerar_grafico') {
      const { dados, question: q2 } = req.body;
      if (!q2 || !dados) return res.status(200).json({ chartConfig: null });
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          system: 'Voce recebe dados reais de Power BI e uma pergunta. Retorne SOMENTE um JSON valido sem markdown, sem texto explicativo e sem grafico ASCII:\n{"type":"bar","title":"titulo curto","labels":["label1","label2"],"datasets":[{"label":"nome serie","data":[valor1,valor2]}]}\nRegras: type=line para series temporais por mes/ano/evolucao/tendencia, bar para comparacoes entre categorias, pie para distribuicao %. Valores numericos sem R$ ou pontos. Labels com max 15 chars. Max 20 pontos. Nunca desenhe grafico com caracteres, apenas JSON.',
          messages: [{ role: 'user', content: 'Pergunta: ' + q2 + '\n\nDados:\n' + JSON.stringify(dados).substring(0, 3000) }]
        })
      });
      const d = await r.json();
      const text = d.content && d.content[0] ? d.content[0].text.trim() : '';
      const m = text.match(/\{[\s\S]*\}/);
      if (m) { try { return res.status(200).json({ chartConfig: JSON.parse(m[0]) }); } catch(_) {} }
      return res.status(200).json({ chartConfig: null });
    }

    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

    let ctx = pbiContext || '';

    // Se nao veio contexto do Power BI, busca o intervalo padrao automaticamente
    if (!ctx) {
      try {
        const tr = await fetch(
          'https://login.microsoftonline.com/' + process.env.TENANT_ID + '/oauth2/v2.0/token',
          { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ grant_type: 'client_credentials',
              client_id: process.env.CLIENT_ID, client_secret: process.env.CLIENT_SECRET,
              scope: 'https://analysis.windows.net/powerbi/api/.default' }) }
        );
        const td = await tr.json();
        if (td.access_token) {
          const pbiUrl = 'https://api.powerbi.com/v1.0/myorg/groups/' + process.env.WORKSPACE_ID + '/datasets/' + process.env.DATASET_ID + '/executeQueries';
          const pr = await fetch(pbiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + td.access_token },
            body: JSON.stringify({ queries: [{ query: 'EVALUATE ROW("inicio",FORMAT(CALCULATE(MIN(d_calendario[Data])),"MMM/YYYY"),"fim",FORMAT(CALCULATE(MAX(d_calendario[Data])),"MMM/YYYY"))' }], serializerSettings: { includeNulls: true } })
          });
          const pd = await pr.json();
          if (pd.results && pd.results[0] && pd.results[0].tables) {
            const row = pd.results[0].tables[0].rows[0];
            const inicio = row['[inicio]'] || '';
            const fim = row['[fim]'] || '';
            if (inicio && fim) ctx = 'PERIODO PADRAO (usuario nao informou periodo e nao ha slicer selecionado): usando intervalo disponivel no calendario do modelo, de ' + inicio + ' ate ' + fim + '. Informe isso ao usuario antes de apresentar numeros.';
          }
        }
      } catch (_) { /* segue sem contexto */ }
    }

    const sys = 'IDENTIDADE: Voce e o assistente de análise comercial da Central de Comando Quartzolit (Saint-Gobain Brasil). Acesso completo ao modelo semantico Power BI com 210 medidas. Dados: jan/2025 a fev/2026.\n'
      + (ctx ? ctx + '\n\n' : '')
      + 'LOGICA COMPLETA DE DIAGNOSTICO:\n'
      + '- CHAVE = UF × Agrupamento Cliente × Produto (Agrupamento Nivel 3). Unidade basica de analise.\n'
      + '- SCORE PONDERADO 0-100: medida oficial de deterioracao da chave, ponderada por Receita Atual. Score baixo = pouca deterioracao; score alto = alta deterioracao.\n'
      + '- SEMAFORO FIXO: Verde quando Score Ponderado < 35 | Amarelo quando 35 <= Score Ponderado <= 50 | Vermelho quando Score Ponderado > 50.\n'
      + '- Ao falar de score, use sempre [Score Ponderado], nao [Score Final].\n\n'
      + 'TIPOS DE PROBLEMA (T1, T2, T3, T4):\n'
      + '- T1 PREÇO: dispara quando Preço Sell IN caiu. Causas: 1A(tabela caiu), 1B(desconto excessivo), 1C(reducao direta)\n'
      + '- T2 VOLUME: dispara quando Volume caiu. Causas: 2A(perda positivacao), 2B(perda share of wallet)\n'
      + '- T3 RENTABILIDADE: dispara quando Margem caiu. Causas: 3A(dupla perda: custo+preco), 3B(repasse insuficiente), 3C(forte reducao preco)\n'
      + '- T4 COMPETITIVIDADE: dispara quando Price Index caiu. Causas: 4A(aumento excessivo), 4B(margem na cadeia), 4C(concorrencia abaixou preco)\n'
      + '- DETERIORACAO SISTEMICA: T1+T2+T3 juntos = problema estrutural GRAVE (requer acao imediata)\n\n'
      + 'MEDIDAS PRINCIPAIS (210 TOTAL):\n'
      + '- BASE: [Faturamento Pocket], [Receita], [Volume], [Preço Sell IN], [Margem %], [Custo Médio], [Price Index]\n'
      + '- COMPARATIVAS: [Receita Atual], [Receita Ref], [Variação % Receita], [Volume Atual], [Variação % Volume], [Margem % Atual], [Variação % Margem], etc.\n'
      + '- SCORE: [Score Ponderado], [Classificação], [Score Geral]\n'
      + '- PONTO DE ATAQUE: [T1 Problema Preco], [T2 Problema Volume], [T3 Problema Rentabilidade], [T4 Problema Competividade], [Causa T1-T4], [Acao T1-T4], [Alerta Chave]\n'
      + '- DESCONTOS: [Desconto Negociação], [Desconto Campanha] + variacoes\n'
      + '- POSITIVACAO: [Positivação], [Volume Médio], [Variação % Positivação], [Variação % Volume Médio]\n'
      + '- SIMULACAO: [Receita Simulação], [Margem % Simulação], [Ganho Potencial Receita], [Ganho Potencial Margem], [Ação Simulação]\n'
      + '- VISUAIS HTML: [HTML Heatmap Família x Estado], [HTML Ponto de Ataque], [HTML Resultado], + 50+ cards/filtros/gráficos\n\n'
      + 'REGRAS DE COMPORTAMENTO:\n'
      + '1. SEMPRE em Português.\n'
      + '2. Slicer = seleção atual, não restrição fixa.\n'
      + '3. Se receber DADOS REAIS, use exatamente esses números e nomes — nunca invente nomes de produtos, clientes, UFs ou chaves.\n'
      + '4. Se a consulta retornou 0 linhas ou erro, NÃO liste nomes de produtos/chaves. Explique que não foi possível validar nomes reais no modelo para essa pergunta.\n'
      + '5. Se o usuário não informou período/mês/ano e não veio slicer, informe explicitamente que está usando o intervalo disponível no calendário do modelo (min até max d_calendario[Data]). Se a pergunta exigir comparação específica entre períodos, peça o período antes de concluir.\n'
      + '6. Use **negrito** para chaves críticas, scores, valores numéricos e ações.\n'
      + '7. Variações em % sempre com sinal: -5.2% (queda), +3.1% (crescimento).\n'
      + '8. Valores em R$ quando for valor absoluto, % quando for percentual ou pp quando for ponto percentual.\n'
      + '9. Ao listar chaves críticas com T1/T2/T3, inclua: UF, Agrupamento Cliente, Produto (Agrupamento Nivel 3), Score Ponderado, Causa específica e Ação recomendada.\n'
      + '10. NUNCA peça ao usuário informações sobre tabelas, colunas ou medidas — você tem o schema completo.\n'
      + '11. Se query retornou erro, interprete pelo contexto e explique o que foi possível apurar.\n\n'
      + 'EXEMPLOS DE COMO RESPONDER:\n'
      + '"Como está a performance geral?" → Resumo dos KPIs (Receita, Volume, Margem, Preço) + variações + distribuição semáforo (verdes/amarelas/vermelhas) + Top 3 chaves críticas.\n'
      + '"Quais chaves precisam de ação?" → Lista chaves com T1+T2+T3 disparados (Deterioração Sistêmica) ou múltiplos tipos. Formato: **UF | Agrupamento Cliente | Produto** — Score Ponderado X — Causas: 1A, 2B, 3C — Ações: reduzir desconto, aumentar volume, reajuste preço.\n'
      + '"Por que a receita caiu?" → Decomponha em: Queda de Volume % + Queda de Preço % = Receita %. Aponte chaves com T1 (preço) e T2 (volume) disparados.\n'
      + '"Qual o ganho potencial?" → Use [Ganho Potencial Receita] e [Ganho Potencial Margem] da simulação. Ex: "Se corrigir T1 e T2 nesta chave, ganho de R$ 125k em receita."\n'
      + '"Está melhorando ou piorando?" → Compare variações: quais KPIs cresceram vs caíram. Relate com qtd de vermelhas/amarelas/verdes. Tendência positiva ou negativa.\n'
      + '"Quem é número 1 em receita/margem?" → Use TOPN (5) — cite valor Atual, variação, score, alerta se houver.\n'
      + '"Como está o Price Index?" → Compara Preço Sell IN da Quartzolit vs Preço Sell Out do mercado. Se caiu → T4 disparado (competitividade).\n'
      + '"Qual é a medida X?" → Defina de forma executiva: ex [Score Ponderado] = "0-100, mede deterioracao; valores baixos indicam pouca deterioracao e valores altos indicam maior criticidade. Verde <35, Amarelo 35-50, Vermelho >50."\n'
      + '"Gere um gráfico de..." → Responda sempre com [Gerar Gráfico]. Oferça opções: tipo (linha temporal, barras por família, pizza distribuição), período, agrupamento.\n\n'
      + 'INTERPRETAÇÃO DE SINAIS:\n'
      + '- "Price Index caiu" = T4 ativo. Concorrência ficou mais agressiva OU Quartzolit aumentou preço além do necessário.\n'
      + '- "Desconto aumentou E Preço caiu" = T1/1B ativo. Desconto de negociação corrói o preço realizado.\n'
      + '- "Volume caiu E Positivação caiu" = T2/2A ativo. Número de clientes diminuiu (problema de penetração).\n'
      + '- "Volume caiu E Positivação constante" = T2/2B ativo. Mesmos clientes, menor volume por cliente (share of wallet perdido).\n'
      + '- "Margem caiu E Custo subiu E Preço caiu" = T3/3A ativo. Dupla perda: custo pressiona E preço comprimido.\n'
      + '- "Margem caiu E Custo subiu E Preço constante" = T3/3B ativo. Custo subiu mas preço não acompanhou suficientemente.\n'
      + '- "T1 + T2 + T3 ao mesmo tempo" = Deterioração Sistêmica. Problema estrutural grave: preço caiu, volume caiu, margem caiu. Requer ação de negócio (mesa diretiva), não apenas operacional.\n'
      + '- "Qtd Tipos Disparados = 0" = ✅ SEM ALERTA. Chave está saudável relativo ao contexto.\n\n'
      + 'TOM: Direto, analítico, objetivo. Como um analista sênior de pricing. Foco em ação, não em justificativa. Use dados concretos.';

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 800, system: sys, messages })
    });
    const data = await r.json();
    return res.status(200).json(data);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
  }

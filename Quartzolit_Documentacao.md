# 📊 Documentação do Modelo Semântico — Quartzolit (Saint-Gobain)

> **Projeto:** Quartzolit — Central de Comando  
> **Cliente:** Saint-Gobain  
> **Ferramenta:** Power BI Desktop  
> **Compatibilidade:** 1600  
> **Última atualização do esquema:** 12/05/2026  
> **Última atualização dos dados:** 30/04/2026  
> **Gerado automaticamente em:** 13/05/2026

---

## Índice

1. [Visão Geral do Modelo](#1-visão-geral-do-modelo)
2. [Tabelas Fato](#2-tabelas-fato)
3. [Tabelas Dimensão](#3-tabelas-dimensão)
4. [Tabelas de Parâmetro / Slicer Desconectado](#4-tabelas-de-parâmetro--slicer-desconectado)
5. [Tabelas Auxiliares](#5-tabelas-auxiliares)
6. [Relacionamentos](#6-relacionamentos)
7. [Medidas (DAX)](#7-medidas-dax)
   - [Base](#base)
   - [Indicadores](#indicadores)
   - [Comparativo](#comparativo)
   - [Normalização e Score](#normalização-e-score)
   - [Classificação (Semáforo)](#classificação-semáforo)
   - [Ponto de Ataque](#ponto-de-ataque)
   - [Simulação](#simulação)
   - [Score Geral](#score-geral)
   - [Score Novo](#score-novo)
   - [Parâmetros de Dimensão](#parâmetros-de-dimensão)
   - [Visuais HTML](#visuais-html)
   - [IA](#ia)
8. [Padrões e Convenções do Modelo](#8-padrões-e-convenções-do-modelo)

---

## 1. Visão Geral do Modelo

O modelo semântico **Quartzolit** sustenta a **Central de Comando** — um dashboard analítico para acompanhamento de performance comercial da Quartzolit (Saint-Gobain). O modelo integra dados de faturamento, custos, inteligência competitiva (BRInsights), preço sell-out e calcula indicadores de performance, score de alertas e simulações de cenários.

### Arquitetura Geral

```
                     ┌─────────────────┐
                     │   d_calendario  │
                     └────────┬────────┘
                              │ (Referência Temporal)
        ┌─────────────────────▼─────────────────────┐
        │              f_faturamento                 │  ← Tabela central
        │  FK_Custos ──────────────► f_custos        │
        │  FK_BRInsights ──────────► f_brinsights    │
        │  PK_PriceIndex ──────────► d_preco_sellout │
        │  Estado ─────────────────► d_uf            │
        └───────────────────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          │  d_periodo_atual (TREATAS — inativo)  │
          │  d_periodo_ref   (TREATAS — inativo)  │
          └───────────────────────────────────────┘
```

**Tabelas de negócio:** 3 fatos + 9 dimensões + 6 parâmetros/auxiliares  
**Total de colunas:** 214  
**Total de medidas:** 210  
**Relacionamentos:** 14

---

## 2. Tabelas Fato

### `f_faturamento`
Tabela principal com dados de faturamento por linha de pedido. É a origem da maioria das medidas de negócio.

| Coluna | Tipo | Observação |
|--------|------|-----------|
| Ano | Int64 | |
| Referência Temporal | DateTime | Chave para d_calendario |
| Data Pedido | DateTime | Chave para LocalDateTable |
| Mês | String | |
| Empresa | String | |
| Canal Distribuição Nome | String | |
| Cliente Código | String | |
| Cliente Nome | String | |
| Cidade | String | |
| Estado | String | Chave para d_uf |
| Escritório Vendas Completo | String | |
| Filial Código | String | |
| Regional Nome | String | |
| Fábrica de Produção | String | Compõe chave composta com f_custos |
| Agrupamento Nível 2 | String | |
| Código Produto | String | Compõe chave composta |
| Agrupamento Nível 3 | String | Chave de granularidade de produto |
| Agrupamento Nível 1 | String | |
| Material Nome | String | |
| Material Produto (Nivel 3) | String | |
| Organização Vendas Código | String | |
| Vendedor Nome | String | |
| Cliente Master Código | String | |
| Cliente Master Completo | String | |
| Cliente Master Nome | String | |
| Consolidador Pricing Código | String | |
| Descrição Condição Pagamento | String | |
| Agrupamento Clientes | String | |
| Descrição Região Vendas | String | |
| Documento Vendas | String | |
| Nota Fiscal | String | |
| Região Vendas | String | |
| Tipo Venda | String | |
| Incoterms | String | |
| Quantidade | Double | Volume em unidades |
| Quantidade Vendas TON | Double | Volume em toneladas |
| Faturamento Líquido | Double | |
| Valor Rebates | Double | |
| Valor YAJU % | Double | |
| Valor YCEN % | Double | |
| Desconto Política | Double | |
| Valor YDRG % | Double | |
| Valor YCAM % | Double | |
| Valor YCLI % | Double | |
| Valor YPOL % | Double | |
| YPR0 Unit | Double | |
| Taxa Financeira pelo Prazo | Double | |
| Valor YLIM % | Double | |
| Valor YEXC % | Double | |
| Preço ZLIP | Double | |
| Frete Unitário | Double | |
| Desconto Negociação | Double | |
| ZLIP R$ Calc | Double | |
| Valor da NF c/IPI e ST | Double | |
| **FK_Custos** | String (calc.) | Chave composta: `Mês & Produto & Fábrica` |
| **FK_BRInsights** | String (calc.) | Chave composta para f_brinsights |
| **PK_PriceIndex** | String (calc.) | Chave composta para d_preco_sellout |
| Mes | String (calc.) | Versão padronizada do mês |
| Price Index | Double (calc.) | Price Index calculado por coluna |
| Price SO SG | Double (calc.) | Preço Sell Out SGB por coluna |

---

### `f_custos`
Tabela de custos de produção por material/fábrica/mês.

| Coluna | Tipo | Observação |
|--------|------|-----------|
| Agrupador Marca | String | |
| Mês de Apuração Custo | DateTime | |
| Família | String | |
| Categoria | String | |
| Código Produto | String | |
| Material Nome | String | |
| Fábrica de Produção | String | |
| Custo MPE | Double | Custo padrão |
| Custo RBE | Double | Custo real |
| **PK_Custos** | String (calc.) | Chave composta: `Mês & Produto & Fábrica` |

---

### `f_brinsights`
Dados de inteligência competitiva — preços de sell-out coletados no mercado.

| Coluna | Tipo | Observação |
|--------|------|-----------|
| Semana | String | |
| CODEAN | Int64 | Código EAN do produto |
| Código + Vendido | String | |
| Material Nome | String | |
| Material Família Agrupador | String | |
| Material Família (Nivel 1) | String | |
| Material Categoria (Nivel 2) | String | |
| Material Produto (Nivel 3) | String | |
| Agrupamento Nível 3 | String | |
| Marca do Fornecedor | String | |
| STATUS CONCORRÂNCIA | String | |
| FAMILIA CONCORRÂNCIA | Double | |
| DESCRICAO | String | |
| Preço Sell Out | Double | |
| DESCONTO | Double | |
| Data da Coleta de Preço | DateTime | |
| HORAPRECO | DateTime | |
| CNPJ | Int64 | |
| Cliente | String | |
| BANDEIRA | String | |
| MUNICÍPIO | String | |
| Estado | String | |
| LOGRADOURO | String | |
| Column24–26 | String | Colunas auxiliares |
| **PK_BRInsights** | String (calc.) | Chave primária composta |
| Pk_Concorrentes | String | |
| f_concorrentes.MARCA | String | |
| Flag | Int64 | |

---

## 3. Tabelas Dimensão

### `d_calendario`
Tabela de datas marcada como tabela de data oficial do modelo.

| Coluna | Tipo |
|--------|------|
| Date | DateTime |
| Data | DateTime |
| Ano | Int64 |
| Mês Número | Int64 |
| Mês Nome | String |
| Mês Abrev | String |
| Trimestre | String |
| Trimestre Número | Int64 |
| Ano-Mês | String |
| Semana ISO | Int64 |
| Dia da Semana | Int64 |
| Dia da Semana Nome | String |
| Dia | Int64 |
| Ano-Trimestre | String |

---

### `d_material`
Dimensão de produtos/materiais.

| Coluna | Tipo |
|--------|------|
| Código | String |
| Nome | String |
| Família | String |
| Categoria | String |
| Produto | String |

---

### `d_filial`
Dimensão de filiais.

| Coluna | Tipo |
|--------|------|
| Código | String |
| Nome | String |

---

### `d_uf`
Dimensão de estados brasileiros.

| Coluna | Tipo |
|--------|------|
| UF | String |

---

### `d_preco_sellout`
Tabela de preços sell-out da SGB e do mercado para cálculo do Price Index.

| Coluna | Tipo | Observação |
|--------|------|-----------|
| Ano | Int64 | |
| Mês | String | |
| Agrupamento Nível 3 | String | |
| Estado | String | |
| Preço Sell Out SGB | Double | |
| Preço Sell Out Concorrente | Double | |
| **PK_PriceIndex** | String (calc.) | Chave composta |
| Preço Index | Double (calc.) | |

---

### `d_indicadores`
Dimensão de seleção de indicadores via slicer — controla qual KPI é exibido dinamicamente.

| Coluna | Tipo |
|--------|------|
| Indicador ID | Int64 |
| Indicador Nome | String |
| Indicador Ordem | Int64 |

---

### `d_classificacao`
Tabela auxiliar de semáforo — mapeamento de cores e ordem de classificação.

| Coluna | Tipo |
|--------|------|
| Classificação ID | Int64 |
| Classificação Nome | String |
| Classificação Cor | String |
| Classificação Ordem | Int64 |

---

### `d_dimensao`
Parâmetro de seleção dinâmica de dimensão de agrupamento nos gráficos.

| Coluna | Tipo |
|--------|------|
| Dimensao ID | Int64 |
| Dimensao Nome | String |

---

## 4. Tabelas de Parâmetro / Slicer Desconectado

Essas tabelas são **desconectadas** da fato no modelo (relacionamentos inativos) e operam via `TREATAS` nas medidas.

### `d_periodo_atual`
Slicer de período "DE" — define o período atual da comparação.

| Coluna | Tipo |
|--------|------|
| Data | DateTime |
| Ano | Int64 |
| Mês Número | Int64 |
| Mês Nome | String |
| Ano-Mês | String |
| Ano-Mês Label | DateTime |

---

### `d_periodo_ref`
Slicer de período "ATÉ" — define o período de referência da comparação.

| Coluna | Tipo |
|--------|------|
| Data | DateTime |
| Ano | Int64 |
| Mês Número | Int64 |
| Mês Nome | String |
| Ano-Mês | String |
| Ano-Mês Label | DateTime |

---

### `d_agrupamento_top`
Parâmetro de filtro de agrupamentos prioritários.

| Coluna | Tipo |
|--------|------|
| Agrupamento | String |

---

### `d_pagina`
Parâmetro de controle de navegação entre páginas do relatório.

| Coluna | Tipo |
|--------|------|
| Pagina | String |

---

### `Tabela`
Tabela auxiliar de dados externos de variação de preço (sell-out concorrência).

| Coluna | Tipo |
|--------|------|
| Agrupamento Nível 3 | String |
| Estado | String |
| Agrupamento Clientes | String |
| Var Preco | Double |

---

## 5. Tabelas Auxiliares

### `_Medidas`
Tabela centralizada para hospedar todas as medidas DAX do modelo. Contém apenas uma coluna auxiliar `x` (Int64) que não é usada em análises.

---

## 6. Relacionamentos

| # | De (Fato) | Coluna FK | Para (Dim) | Coluna PK | Ativo | Filtro | Cardinalidade |
|---|-----------|-----------|------------|-----------|-------|--------|---------------|
| 1 | f_faturamento | Referência Temporal | d_calendario | Data | ✅ | Single | Many→One |
| 2 | f_faturamento | Estado | d_uf | UF | ✅ | Single | Many→One |
| 3 | f_faturamento | FK_Custos | f_custos | PK_Custos | ✅ | Single | Many→One |
| 4 | f_faturamento | FK_BRInsights | f_brinsights | PK_BRInsights | ✅ | Single | **Many→Many** |
| 5 | f_faturamento | PK_PriceIndex | d_preco_sellout | PK_PriceIndex | ✅ | Single | Many→One |
| 6 | f_faturamento | Referência Temporal | d_periodo_atual | Data | ❌ | Single | Many→One |
| 7 | f_faturamento | Referência Temporal | d_periodo_ref | Data | ❌ | Single | Many→One |
| 8 | f_brinsights | Data da Coleta de Preço | LocalDateTable | Date | ✅ | Single | Many→One |
| 9 | f_custos | Mês de Apuração Custo | LocalDateTable | Date | ✅ | Single | Many→One |
| 10 | f_faturamento | Data Pedido | LocalDateTable | Date | ✅ | Single | Many→One |
| 11 | d_periodo_atual | Ano-Mês Label | LocalDateTable | Date | ✅ | Single | Many→One |
| 12 | d_periodo_ref | Ano-Mês Label | LocalDateTable | Date | ✅ | Single | Many→One |
| 13 | d_periodo_atual | Data | LocalDateTable | Date | ✅ | Single | Many→One |
| 14 | d_periodo_ref | Data | LocalDateTable | Date | ✅ | Single | Many→One |

> **Nota sobre d_periodo_atual / d_periodo_ref:** Os relacionamentos com f_faturamento são **inativos** (❌). As medidas comparativas usam `TREATAS` para aplicar o filtro do slicer diretamente sobre a fato, sem ativar o relacionamento.

---

## 7. Medidas (DAX)

Todas as 210 medidas ficam na tabela `_Medidas`, organizadas em pastas hierárquicas.

---

### Base

| Medida | Descrição |
|--------|-----------|
| **Faturamento Pocket** | Receita líquida após rebates e descontos — base de todas as demais métricas financeiras |
| **Faturamento Simulação** | Versão do faturamento para cálculos de simulação de cenário |

---

### Indicadores

Principais KPIs de negócio. Cada indicador tem versão Atual, Ref e Variação % no grupo Comparativo.

| Medida | Descrição |
|--------|-----------|
| **Receita** | Evolução da receita obtida |
| **Volume** | Evolução de volume (Preço Constante) |
| **Preço Sell IN** | Evolução de preço (Volume Constante) — Faturamento Pocket / Quantidade |
| **Margem %** | Rentabilidade: (Receita - Custo) / Receita |
| **Margem Valor** | Margem em valor absoluto R$ |
| **Custo Médio** | Evolução do custo (Volume Constante) — Custo RBE médio por unidade |
| **Price Index** | Posição competitiva de preço — Preço Sell IN da Quartzolit vs Preço Sell Out do mercado (BRInsights) |
| **Desconto Negociação** | Desconto Negociação em valor R$ = Faturamento Pocket × % Desconto Negociação |
| **Desconto Campanha** | Desconto de campanhas comerciais |
| **Positivação** | Indicador de abrangência/presença de produtos |
| **Price SO SGB** | Preço Sell Out da SGB no mercado |
| **Indicador Selecionado** | Retorna o valor do indicador escolhido no slicer `d_indicadores` |
| **Indicador Atual** | Valor Atual do indicador selecionado |
| **Indicador Ref** | Valor Ref do indicador selecionado |
| **Indicador Variação** | Variação % do indicador selecionado |
| **Indicador Label** | Nome do indicador selecionado — usado em títulos dinâmicos |
| **Indicador Label Estado** | Label do indicador filtrado por Estado |
| **Indicador Label Agrupamento** | Label do indicador filtrado por Agrupamento |
| **Top + Outros** | Agrupa os N maiores e consolida o restante como "Outros" |
| **Cor Treemap** | Cor dinâmica para treemaps baseada no score |

---

### Comparativo

Medidas de período comparativo — usam `TREATAS` com `d_periodo_atual` e `d_periodo_ref`.

#### Receita
| Medida | Descrição |
|--------|-----------|
| Periodo Atual | Data inicial do período DE selecionado |
| Periodo Ref | Data inicial do período ATÉ selecionado |
| Receita Atual | Receita no período DE selecionado |
| Receita Ref | Receita no período ATÉ selecionado |
| Variação % Receita | Variação % entre os dois períodos |

#### Volume
| Medida | Descrição |
|--------|-----------|
| Volume Atual | Volume no período atual |
| Volume Ref | Volume no período de referência |
| Variação % Volume | Variação % entre períodos |
| Volume Médio Atual | Volume médio por ponto no período atual |
| Volume Médio Ref | Volume médio por ponto no período de referência |
| Variação % Volume Médio | Variação % de volume médio |

#### Margem
| Medida | Descrição |
|--------|-----------|
| Margem % Atual | Margem % no período atual |
| Margem % Ref | Margem % no período de referência |
| Variação % Margem | Variação % de margem |
| Margem Valor Atual | Margem em R$ no período atual |
| Margem Valor Ref | Margem em R$ no período de referência |
| Variação Valor Margem | Variação absoluta de margem valor |

#### Preço Sell IN
| Medida |
|--------|
| Preço Sell IN Atual |
| Preço Sell IN Ref |
| Variação % Preço Sell IN |

#### Custo Médio
| Medida |
|--------|
| Custo Médio Atual |
| Custo Médio Ref |
| Variação % Custo Médio |

#### Price Index
| Medida |
|--------|
| Price Index Atual |
| Price Index Ref |
| Variação % Price Index |

#### Descontos
| Medida |
|--------|
| Desconto Negociação Atual |
| Desconto Negociação Ref |
| Variação % Desconto Negociação |
| Desconto Campanha Atual |
| Desconto Campanha Ref |
| Variação % Desconto Campanha |
| Variação % Descontos |

#### Positivação
| Medida |
|--------|
| Positivação Atual |
| Positivação Ref |
| Variação % Positivação |

#### Sell Out
| Medida |
|--------|
| Price SO SGB Atual |
| Price SO SGB Ref |
| Variação % Price SO SBG |

---

### Normalização e Score

Lógica de penalização e normalização 0–100 para cada indicador. Só quedas geram penalização.

| Medida | Descrição |
|--------|-----------|
| Penal Receita | Penalização se Receita caiu |
| Penal Volume | Penalização se Volume caiu |
| Penal Preço Sell IN | Penalização se Preço Sell IN caiu |
| Penal Margem | Penalização se Margem caiu |
| Penal Custo Médio | Penalização se Custo subiu |
| Penal Price Index | Penalização se Price Index piorou |
| Penal Desconto Negociação | Penalização de desconto |
| Penal Indicador | Penalização do indicador selecionado dinamicamente |
| Score Receita | Score 0–100 de Receita via min-max |
| Score Volume | Score 0–100 de Volume |
| Score Preço Sell IN | Score 0–100 de Preço Sell IN |
| Score Margem | Score 0–100 de Margem |
| Score Custo Médio | Score 0–100 de Custo Médio |
| Score Price Index | Score 0–100 de Price Index |
| Score Desconto Negociação | Score 0–100 de Desconto |
| Score Indicador | Score 0–100 do indicador selecionado |
| **Score Final** | Score ponderado consolidado de todos os indicadores |

---

### Classificação (Semáforo)

Classificação em Verde / Amarelo / Vermelho baseada nos percentis P10/P90 do Score Final calculados dinamicamente sobre o contexto filtrado.

| Medida | Descrição |
|--------|-----------|
| P10 Score Final | Percentil 10 do Score Final no contexto |
| P90 Score Final | Percentil 90 do Score Final no contexto |
| **Classificação** | `Verde` / `Amarelo` / `Vermelho` baseado em P10 e P90 |
| Classificação Ordem | Ordem numérica da classificação |
| Qtd Chaves Verdes | Contagem de chaves classificadas como Verde |
| Qtd Chaves Amarelas | Contagem de chaves classificadas como Amarelo |
| Qtd Chaves Vermelhas | Contagem de chaves classificadas como Vermelho |
| % Chaves Verdes | Percentual de chaves Verdes |
| % Chaves Amarelas | Percentual de chaves Amarelas |
| % Chaves Vermelhas | Percentual de chaves Vermelhas |
| Explicação Classificação HTML | Explica a regra com valores dinâmicos de P10 e P90 |

---

### Ponto de Ataque

Motor de diagnóstico automático que identifica problemas, causas e recomenda ações por chave (Agrupamento Nível 3).

#### Sinais
Sinais binários (1/0) que detectam movimentos nos indicadores entre Atual e Ref.

| Medida | Descrição |
|--------|-----------|
| S I1 Price Index Caiu | I1 — Price Index piorou |
| S I2 Preco Caiu | I2 — Preço Sell In caiu |
| S I2 Preco Subiu ABS | I2+ — Preço Sell In subiu (absoluto) |
| S I2 Preco Subiu | I2 — Preço Sell In subiu |
| S I2 Receita Caiu | I2 — Receita caiu |
| S I2 Desconto x Preco Subiu | I2 — Desconto puxou preço para cima |
| S I2 Desconto x Preco Caiu | I2 — Desconto puxou preço para baixo |
| S I2 Desconto Negociação x Preco Subiu | I2 — Desconto negociação puxou preço |
| S I2 Desconto Campanha x Preco Subiu | I2 — Desconto campanha puxou preço |
| S I3 Volume Caiu | I3 — Volume caiu |
| S I3 Positivação Caiu | I3 — Positivação caiu |
| S I4 Preco SO Subiu | I4 — Preço Sell Out subiu no mercado |
| S I4 Preco SO Caiu | I4 — Preço Sell Out caiu no mercado |
| S I4 Preco Sell IN Caiu x SO | I4 — Preço Sell IN caiu vs. Sell Out |
| S I4 Preco Sell IN Subiu x SO | I4 — Preço Sell IN subiu vs. Sell Out |
| S I5 Custo x Preco Subiu | I5 — Custo Médio subiu |
| S I5 Custo Subiu | I5 — Custo subiu |
| S I5 Custo Caiu | I5 — Custo caiu |
| S I6 Margem % Caiu | I6 — Margem caiu |
| S I6 Margem Valor Caiu | I6 — Margem valor caiu |
| S I7 Desconto Subiu | I7 — Desconto subiu |

#### Diagnóstico
| Medida | Descrição |
|--------|-----------|
| T1 Problema Preco | Tipo 1: gatilho = Preço Sell In caiu |
| T2 Problema Volume | Tipo 2: gatilho = Volume caiu |
| T3 Problema Rentabilidade | Tipo 3: gatilho = Margem caiu |
| T4 Problema Competividade | Tipo 4: problema de competitividade de preço |
| Qtd Tipos Disparados | Quantidade de tipos disparados simultaneamente |
| Deterioração Sistêmica | Alerta quando 3 tipos disparam juntos |
| Alerta Chave | Alerta máximo consolidado da chave |

#### Causa
| Medida | Descrição |
|--------|-----------|
| Causa T1 | Causa do Tipo 1 — Problema de Preço |
| Causa T2 | Causa do Tipo 2 — Problema de Volume |
| Causa T3 | Causa do Tipo 3 — Problema de Rentabilidade |
| Causa T4 | Causa do Tipo 4 — Problema de Competitividade |

#### Ação
| Medida | Descrição |
|--------|-----------|
| Acao T1 | Ação recomendada para T1 por causa identificada |
| Acao T2 | Ação recomendada para T2 por causa identificada |
| Acao T3 | Ação recomendada para T3 por causa identificada |
| Acao T4 | Ação recomendada para T4 por causa identificada |

#### Visual
| Medida | Descrição |
|--------|-----------|
| HTML Ponto de Ataque | Visual HTML completo da página Ponto de Ataque |

---

### Simulação

Simulação de cenários de recuperação — projeta receita e margem se os problemas identificados forem corrigidos.

#### Base da Simulação
| Medida | Descrição |
|--------|-----------|
| Preço Simulação T1 | Preço simulado (auxiliar) |
| Sim Preço T1 | Preço simulado para T1 — retorna ao Preço Sell IN do período de referência |
| Sim Preço T3 | Preço mínimo para recuperar margem de referência dado o custo atual |
| Sim Preço Simulado | MAX(T1, T3) quando há combinação de problemas; caso contrário aplica o relevante |
| Sim Positivação Simulada | Usa Positivação Ref quando causa 2A; caso contrário mantém Atual |
| Sim Volume Médio Simulado | Usa Volume Médio Ref quando causa 2B; caso contrário mantém Atual |
| Faturamento Simulação | Base de faturamento para a simulação |

#### Resultados da Simulação
| Medida | Descrição |
|--------|-----------|
| Receita Simulação | Itera cada Agrupamento Nível 3 para aplicar lógica correta de preço e volume |
| Margem Simulação | Margem valor da simulação |
| Margem % Simulação | Margem % da simulação |
| Ganho Potencial Receita | Receita Simulação − Receita Atual |
| Ganho Potencial Margem | Margem Simulação − Margem Valor Atual |
| Ação Simulação | Texto dinâmico por causa identificada (1A, 1B, 1C, 2A, 2B, 3A, 3B, 3C) |
| Variável Ajustada Simulação | Descreve qual variável foi ajustada (Preço, Positivação, Volume ou combinações) |

---

### Score Geral

Score alternativo calculado sem segmentação por indicador individual.

| Medida |
|--------|
| Penal Geral |
| Score Geral |
| P10 Geral |
| P90 Geral |
| Cor Geral |
| HTML Heatmap Geral |

---

### Score Novo

Versão em desenvolvimento do score com lógica de mínimos e score ponderado revisado.

#### Mínimos
| Medida |
|--------|
| Minimo Preço Sell IN |
| Minimo Price Index |
| Minimo Volume |
| Minimo Receita |
| Minimo Desconto |
| Minimo Custo Medio |
| Minimo Margem |
| Minimo Indicador |
| Penal Desconto Negociação |

#### Score
| Medida | Descrição |
|--------|-----------|
| Score Ponderado | Score ponderado revisado com nova lógica |

---

### Parâmetros de Dimensão

Medidas para seleção dinâmica de dimensão de análise (Campo, Nível).

| Medida | Descrição |
|--------|-----------|
| Dimensao Selecionada | Retorna o nome da dimensão selecionada no parâmetro |
| Dimensao Label | Retorna o valor da dimensão atual da linha — use no eixo X do gráfico |
| Receita Atual por Dimensao | Receita Atual filtrada pela dimensão selecionada |
| Score Final por Dimensao | Score Final pela dimensão selecionada |

---

### Visuais HTML

Medidas que geram HTML completo renderizado via visual HTML Content no relatório.

| Medida | Descrição |
|--------|-----------|
| HTML Heatmap Categoria x Estado | Tabela heatmap Score Final por Categoria × Estado |
| HTML Heatmap Família x Estado DAX | Heatmap alternativo Família × Estado |
| HTML Resultado | Gráfico de evolução mensal + barras por Estado e Agrupamento, com seletor de indicador |
| HTML Ponto de Ataque | Painel completo da página Ponto de Ataque |
| HTML Heatmap Geral | Heatmap da versão Score Geral |
| HTML Heatmap v2 | Heatmap versão v2 |
| Teste Score Célula | Medida de teste de célula de score |
| Menu HTML | Menu de navegação entre páginas |
| Menu HTML sem filtro | Menu sem passar filtros de contexto |
| Card Price Index HTML | Card KPI do Price Index |
| Card Receita HTML | Card KPI de Receita |
| Card Volume HTML | Card KPI de Volume |
| Card Margem HTML | Card KPI de Margem |
| Card Desconto HTML | Card KPI de Desconto |
| Card Custo Médio HTML | Card KPI de Custo Médio |
| Card Chaves Vermelhas HTML | Card com contagem de chaves Vermelhas |
| Card Chaves Amarelas HTML | Card com contagem de chaves Amarelas |
| Card Chaves Verdes HTML | Card com contagem de chaves Verdes |
| Titulo Indicadores HTML | Título dinâmico da seção de indicadores |
| Titulo HeatMap HTML | Título dinâmico do heatmap |
| Titulo Ponto de Ataque HTML | Título da página Ponto de Ataque |
| Titulo Simulação HTML | Título da página Simulação |
| Titulo Quartzolit IA HTML | Título da página IA |
| Grafico Linha Indicador HTML | Gráfico de linha do indicador selecionado |
| Fundo Filtros HTML | Fundo visual da área de filtros |

#### Visuais Simulação
| Medida | Descrição |
|--------|-----------|
| Sim Card Receita Atual HTML | Card Receita Atual — tela Simulação |
| Sim Card Receita Simulada HTML | Card Receita Simulada — tela Simulação |
| Sim Card Ganho Potencial HTML | Card Ganho Potencial de Receita |
| Sim Card Margem Simulada HTML | Card Margem % Simulada |
| Sim Card Margem Atual HTML | Card Margem Atual |
| Sim Card Qtd Problemas HTML | Card Qtd. Agrupamentos com problema |
| Sim Diagnostico HTML | Painel de diagnóstico e ação recomendada |
| Sim Resultado Recomendacao HTML | Resultado e recomendação consolidada |
| Botao Limpar Filtros HTML | Botão de limpar filtros |
| Botao Analise Detalhada HTML | Botão para análise detalhada |
| Filtro UF HTML | Filtro de UF visual |
| Filtro Agrupamento Cliente HTML | Filtro de Agrupamento Cliente visual |
| Filtro Agrupamento Nivel 1 HTML | Filtro Agrupamento Nível 1 visual |
| Filtro Agrupamento Nivel 3 HTML | Filtro Agrupamento Nível 3 visual |
| Filtro Período Atual HTML | Filtro Período Atual visual |
| Filtro Período Referência HTML | Filtro Período Referência visual |
| Filtro Score HTML | Filtro Score visual |
| Filtro Agrupamento HTML | Filtro Agrupamento visual |
| Fundo Detalhamento HTML | Fundo visual da área de detalhamento |

#### Visuais v2 (em desenvolvimento)
| Medida |
|--------|
| Score Penal v2 |
| Score v2 |
| P10 v2 |
| P90 v2 |
| Cor v2 |
| HTML Heatmap v2 |
| Filtro Cor Selecionada |

---

### IA

Integração de inteligência artificial ao modelo semântico.

| Medida | Descrição |
|--------|-----------|
| **IA Contexto JSON** | Exporta o estado atual do modelo como JSON estruturado para alimentar a IA |
| **Chat IA** | Chat IA integrado ao modelo semântico Quartzolit — visual HTML que conecta ao endpoint de IA |

---

## 8. Padrões e Convenções do Modelo

### Nomenclatura de Tabelas
- **`f_`** — tabelas fato (ex: `f_faturamento`, `f_custos`)
- **`d_`** — tabelas dimensão (ex: `d_calendario`, `d_material`)
- **`_Medidas`** — tabela centralizada de medidas DAX

### Chaves Compostas
O modelo usa o padrão de **chave composta com pipe** (`|`) para relacionamentos entre tabelas que não possuem chave única simples:

```dax
-- Exemplo FK_Custos em f_faturamento
FK_Custos = 
    f_faturamento[Mês] & "|" & 
    f_faturamento[Código Produto] & "|" & 
    f_faturamento[Fábrica de Produção]
```

A tabela fato cria a coluna `FK_*` calculada, e a tabela destino cria a coluna `PK_*` calculada com a mesma concatenação.

### Períodos Comparativos (TREATAS)
Os slicers `d_periodo_atual` e `d_periodo_ref` são tabelas **desconectadas**. As medidas de comparação aplicam filtro via `TREATAS`:

```dax
-- Padrão das medidas de período
Receita Atual = 
CALCULATE(
    [Receita],
    TREATAS(
        VALUES(d_periodo_atual[Data]),
        f_faturamento[Referência Temporal]
    )
)
```

### Normalização Score (0–100)
O Score Final usa normalização **min-max com penalização** — apenas quedas nos indicadores geram pontuação negativa. A escala é invertida para que o melhor = 100.

```
Score = 100 × (Penalização − Mínimo) / (Máximo − Mínimo)
```

### Classificação por Percentil
A classificação Verde/Amarelo/Vermelho é dinâmica, calculada sobre o contexto filtrado:
- **Verde**: Score Final ≥ P90
- **Amarelo**: P10 ≤ Score Final < P90
- **Vermelho**: Score Final < P10

### Organização das Medidas em Pastas
```
_Medidas/
├── Base/
├── Indicadores/
├── Comparativo/
│   ├── Receita/
│   ├── Volume/
│   ├── Margem/
│   ├── Preço Sell IN/
│   ├── Custo Médio/
│   ├── Price Index/
│   ├── Descontos/
│   ├── Positivação/
│   └── Sell Out/
├── Normalização/
├── Classificação/
├── Ponto de Ataque/
│   ├── Sinais/
│   ├── Diagnóstico/
│   ├── Causa/
│   ├── Ação/
│   └── Visual/
├── Simulação/
│   ├── Base/
│   ├── Resultados/
│   └── Visuais/
├── Score Geral/
├── Score Novo/
│   ├── Mínimos/
│   └── Score/
├── Parâmetros/
│   └── Dimensao/
├── Visuais/
│   └── Dashboard/
├── Visuais v2/
└── IA/
    ├── Contexto/
    └── Visual/
```

---

*Documentação gerada automaticamente via MCP Power BI Modeling · Quantiz · 13/05/2026*

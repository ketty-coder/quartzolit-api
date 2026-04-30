# 📊 Documentação Técnica — Dashboard Central de Comando Quartzolit
**Projeto:** Central de Comando — Quartzolit (Saint-Gobain Brasil)  
**Ferramenta:** Power BI Desktop + Vercel (Chat IA)  
**Desenvolvido por:** QuantiZ Pricing Solutions  
**Dados disponíveis:** Jan/2025 em diante  

---

## 1. Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    FONTES DE DADOS                          │
│   SAP (faturamento)  |  Custos RBE  |  BRInsights (preços)  │
└──────────────┬───────────────┬──────────────────────────────┘
               │               │
┌──────────────▼───────────────▼──────────────────────────────┐
│              MODELO SEMÂNTICO POWER BI                      │
│   Tabelas Fato + Dimensões + 99 Medidas DAX                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              DASHBOARD (5 páginas)                          │
│   Cover | Resultado | Heatmap | Ponto de Ataque | Chat IA   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              CHAT IA (Vercel + Claude)                      │
│   quartzolit-api-6a8h.vercel.app                            │
│   /api/chat (Claude Haiku) | /api/query (DAX via REST API)  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Estrutura do Modelo de Dados

### Diagrama de Relacionamentos

```
d_periodo_atual ─────────────┐
d_periodo_ref ────────────── ├──► f_faturamento ◄──► f_custos
d_calendario ────────────────┤         │
d_uf ────────────────────────┘         └──────────► f_brinsights
                                       │
d_material (desconectada)              │
d_filial (desconectada)                │
d_indicadores (slicer)                 │
d_classificacao (slicer)               │
_Medidas (tabela de medidas) ──────────┘
```

---

## 3. Tabelas

### 3.1 Tabelas Fato

#### `f_faturamento` — Faturamento por linha de pedido
**Fonte:** SAP (via Power Query)  
**Granularidade:** Uma linha por item de pedido/nota fiscal  

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| Referência Temporal | DateTime | Data usada para filtros de período (join com d_calendario) |
| Data Pedido | DateTime | Data do pedido |
| Ano | Int | Ano do pedido |
| Mês | String | Mês do pedido |
| Empresa | String | Código da empresa |
| Agrupamento Nível 1 | String | **Família de produto** (principal dimensão de análise) |
| Agrupamento Nível 2 | String | Categoria de produto |
| Agrupamento Nível 3 | String | Produto específico |
| Estado | String | UF do cliente |
| Cidade | String | Cidade do cliente |
| Cliente Código / Nome | String | Identificação do cliente |
| Cliente Master | String | Grupo/master do cliente |
| Canal Distribuição Nome | String | Canal de vendas |
| Regional Nome | String | Regional comercial |
| Escritório Vendas Completo | String | Escritório de vendas |
| Fábrica de Produção | String | Fábrica de origem |
| Vendedor Nome | String | Nome do vendedor |
| Quantidade | Double | Volume em unidades |
| Quantidade Vendas TON | Double | Volume em toneladas |
| Faturamento Líquido | Double | Faturamento sem descontos |
| Desconto Negociação | Double | Valor do desconto negociado |
| YPR0 Unit | Double | Preço tabela unitário (ZLIP base) |
| Preço ZLIP | Double | Preço ZLIP |
| ZLIP R$ Calc | Double | ZLIP calculado em R$ |
| Valor da NF c/IPI e ST | Double | Valor total da NF |
| Valor Rebates | Double | Valor de rebates |
| Desconto Política | Double | Desconto de política comercial |
| Taxa Financeira pelo Prazo | Double | Taxa financeira por prazo |
| FK_Custos | String | **Chave composta** para join com f_custos (calculada) |
| FK_BRInsights | String | **Chave composta** para join com f_brinsights (calculada) |

---

#### `f_custos` — Custos RBE por material
**Fonte:** Planilha/sistema de custos  
**Granularidade:** Uma linha por material × mês × fábrica  

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| Mês de Apuração Custo | DateTime | Mês de referência do custo |
| Família | String | Família do produto |
| Categoria | String | Categoria do produto |
| Código Produto | String | Código do material |
| Material Nome | String | Nome do material |
| Fábrica de Produção | String | Fábrica de origem |
| Custo RBE | Double | **Custo padrão RBE** (usado no cálculo de margem) |
| Custo MPE | Double | Custo MPE |
| PK_Custos | String | **Chave primária** composta (calculada) |

---

#### `f_brinsights` — Preços de mercado (BRInsights)
**Fonte:** BRInsights — coleta de preços concorrentes  
**Granularidade:** Uma linha por produto × ponto de venda × semana  

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| Data da Coleta de Preço | DateTime | Data da coleta |
| Semana | String | Semana de referência |
| CODEAN | Int | Código EAN do produto |
| Material Nome | String | Nome do produto |
| Material Família (Nível 1) | String | Família |
| Material Categoria (Nível 2) | String | Categoria |
| Agrupamento Nível 3 | String | Produto |
| Marca do Fornecedor | String | Marca concorrente |
| STATUS CONCORRÊNCIA | String | Status da concorrência |
| Preço Sell Out | Double | **Preço de venda ao consumidor final** |
| DESCONTO | Double | Desconto observado |
| Estado | String | UF do ponto de coleta |
| Cliente / BANDEIRA | String | Rede/bandeira do ponto de venda |
| PK_BRInsights | String | **Chave primária** composta (calculada) |

---

### 3.2 Tabelas Dimensão

#### `d_calendario` — Calendário principal
**Tipo:** Tabela de datas (Date Table marcada)  
**Conectada a:** `f_faturamento[Referência Temporal]`  

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| Date / Data | DateTime | Data completa |
| Ano | Int | Ano (ex: 2025) |
| Mês Número | Int | Número do mês (1–12) |
| Mês Nome | String | Nome do mês (ex: "Janeiro") |
| Mês Abrev | String | Abreviação (ex: "jan") |
| Trimestre | String | Ex: "T1", "T2" |
| Trimestre Número | Int | Número do trimestre (1–4) |
| Ano-Mês | String | Formato "2025-01" (usado para agrupar) |
| Ano-Trimestre | String | Formato "2025-T1" |
| Semana ISO | Int | Número da semana ISO |
| Dia | Int | Dia do mês |
| Dia da Semana | Int | Dia da semana (1–7) |
| Dia da Semana Nome | String | Nome do dia |

---

#### `d_periodo_atual` — Slicer de período atual
**Função:** Slicer desconectado que define o "Período DE" para comparativos  
**Relacionamento com f_faturamento:** Inativo (usado via CALCULATE + USERELATIONSHIP)  

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| Data | DateTime | Data do período |
| Ano | Int | Ano |
| Mês Número | Int | Número do mês |
| Mês Nome | String | Nome do mês |
| Ano-Mês | String | Formato "2025-01" |
| Ano-Mês Label | DateTime | Label exibido no slicer |

---

#### `d_periodo_ref` — Slicer de período de referência
**Função:** Slicer desconectado que define o "Período ATÉ" (referência) para comparativos  
**Relacionamento com f_faturamento:** Inativo (usado via CALCULATE + USERELATIONSHIP)  

> ⚠️ **Nota:** As tabelas `d_periodo_atual` e `d_periodo_ref` contêm todos os meses disponíveis (jan/2025–fev/2026). Quando nenhum mês está selecionado, a medida `Chat IA` usa como padrão o último mês ≤ dez/2025 (atual) e jan/2025 (referência).

---

#### `d_uf` — Estados brasileiros
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| UF | String | Sigla do estado (ex: "SP", "RJ") |

**Conectada a:** `f_faturamento[Estado]`

---

#### `d_material` — Dimensão de materiais
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| Código | String | Código do material |
| Nome | String | Nome do material |
| Família | String | Família de produto |
| Categoria | String | Categoria |
| Produto | String | Produto |

> ⚠️ **Nota:** Tabela desconectada — não tem relacionamento ativo com f_faturamento (análise por material é feita pela própria fato).

---

#### `d_filial` — Filiais
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| Código | String | Código da filial |
| Nome | String | Nome da filial |

> ⚠️ **Nota:** Tabela desconectada.

---

#### `d_indicadores` — Slicer de indicadores
**Função:** Controla qual indicador é exibido nos visuais dinâmicos  

| Coluna | Tipo | Valores |
|--------|------|---------|
| Indicador ID | Int | 1–6 |
| Indicador Nome | String | Receita, Volume, Preço Sell IN, Margem, Custo Médio, Price Index |
| Indicador Ordem | Int | Ordem de exibição |

---

#### `d_classificacao` — Tabela de classificação semáforo
**Função:** Define as cores do semáforo (Verde/Amarelo/Vermelho)  

| Coluna | Tipo | Valores |
|--------|------|---------|
| Classificação ID | Int | 1, 2, 3 |
| Classificação Nome | String | "Verde", "Amarelo", "Vermelho" |
| Classificação Cor | String | Código de cor |
| Classificação Ordem | Int | Ordem de exibição |

---

## 4. Medidas DAX (99 medidas)

### 4.1 Base

| Medida | Pasta | Descrição |
|--------|-------|-----------|
| `Faturamento Pocket` | Base | Faturamento líquido total em R$ (soma da coluna Faturamento Líquido menos descontos) |

---

### 4.2 Indicadores Principais

| Medida | Pasta | Descrição |
|--------|-------|-----------|
| `Receita` | Indicadores | Evolução da receita — mede ganho/perda de receita ajustado |
| `Volume` | Indicadores | Evolução de volume (Preço Constante) — isola o efeito volume |
| `Preço Sell IN` | Indicadores | Evolução de preço (Volume Constante) = Fat Pocket / Quantidade |
| `Margem` | Indicadores | Rentabilidade = (Receita − Custo) / Receita |
| `Custo Médio` | Indicadores | Evolução do custo (Volume Constante) = Custo RBE médio por unidade |
| `Price Index` | Indicadores | Posição competitiva = Preço Sell IN Quartzolit vs Preço Sell Out mercado (BRInsights) |
| `Desconto Negociação` | Indicadores | Desconto negociado em R$ = Faturamento Pocket × % Desconto Negociação |

---

### 4.3 Comparativo (Atual vs Referência)

Cada indicador tem 3 medidas: `[Indicador] Atual`, `[Indicador] Ref`, `Variação [tipo] [Indicador]`

| Grupo | Medidas | Variação |
|-------|---------|----------|
| Receita | `Receita Atual`, `Receita Ref` | `Variação % Receita` (%) |
| Volume | `Volume Atual`, `Volume Ref` | `Variação % Volume` (%) |
| Margem | `Margem Atual`, `Margem Ref` | `Variação pp Margem` (pontos percentuais) |
| Preço Sell IN | `Preço Sell IN Atual`, `Preço Sell IN Ref` | `Variação % Preço Sell IN` (%) |
| Custo Médio | `Custo Médio Atual`, `Custo Médio Ref` | `Variação % Custo Médio` (%) |
| Price Index | `Price Index Atual`, `Price Index Ref` | `Variação pp Price Index` (pp) |

> **Mecânica:** As medidas Atual e Ref usam `CALCULATE` com `USERELATIONSHIP` para ativar o relacionamento inativo entre `f_faturamento` e `d_periodo_atual`/`d_periodo_ref`.

---

### 4.4 Indicador Dinâmico (seleção via slicer)

| Medida | Descrição |
|--------|-----------|
| `Indicador Selecionado` | Retorna o valor do indicador selecionado em `d_indicadores` |
| `Indicador Atual` | Valor Atual do indicador selecionado |
| `Indicador Ref` | Valor Ref do indicador selecionado |
| `Indicador Variação` | Variação do indicador selecionado |
| `Indicador Label` | Nome do indicador — usado em títulos dinâmicos dos visuais |
| `Indicador Penal` | Penalização do indicador selecionado |
| `Score Indicador` | Score 0–100 do indicador selecionado |

---

### 4.5 Normalização e Score

**Lógica:** Apenas quedas geram penalização. Escala 0–100 por min-max dentro do contexto.

| Medida | Descrição |
|--------|-----------|
| `Penal Receita` | 1 se Receita caiu, 0 caso contrário |
| `Penal Volume` | 1 se Volume caiu |
| `Penal Preço Sell IN` | 1 se Preço caiu |
| `Penal Margem` | 1 se Margem caiu |
| `Penal Custo Médio` | 1 se Custo subiu (penaliza aumento) |
| `Penal Price Index` | 1 se Price Index piorou |
| `Score Receita` | Score 0–100 normalizado por variação de receita |
| `Score Volume` | Score 0–100 por variação de volume |
| `Score Preço Sell IN` | Score 0–100 por variação de preço |
| `Score Margem` | Score 0–100 por variação de margem |
| `Score Custo Médio` | Score 0–100 por variação de custo |
| `Score Price Index` | Score 0–100 por variação de price index |
| `Score Final` | **Score ponderado final** — média dos scores ativos |

---

### 4.6 Score Geral (visão agregada ALL)

| Medida | Descrição |
|--------|-----------|
| `Penal Geral` | Penalização geral (ignora filtros de UF/família) |
| `Score Geral` | Score geral — base para classificação de chaves |
| `P10 Geral` | Percentil 10 do Score Geral (limiar Verde) |
| `P90 Geral` | Percentil 90 do Score Geral (limiar Vermelho) |
| `Cor Geral` | Cor do semáforo: 🟢 Verde / 🟡 Amarelo / 🔴 Vermelho |
| `HTML Heatmap Geral` | Visual HTML do heatmap geral |

---

### 4.7 Classificação Semáforo

**Lógica:** P10 = limiar Verde, P90 = limiar Vermelho. Calculado dinamicamente com ALL(d_uf).

| Medida | Descrição |
|--------|-----------|
| `P10 Score Final` | Percentil 10 dinâmico do Score Final |
| `P90 Score Final` | Percentil 90 dinâmico do Score Final |
| `Classificação` | "Verde", "Amarelo" ou "Vermelho" |
| `Classificação Ordem` | Ordem numérica da classificação (para ordenação) |
| `Qtd Chaves Verdes` | Quantidade de chaves classificadas como Verde |
| `Qtd Chaves Amarelas` | Quantidade de chaves classificadas como Amarelo |
| `Qtd Chaves Vermelhas` | Quantidade de chaves classificadas como Vermelho |
| `% Chaves Verdes` | % de chaves Verdes |
| `% Chaves Amarelas` | % de chaves Amarelas |
| `% Chaves Vermelhas` | % de chaves Vermelhas |
| `Explicação Classificação HTML` | HTML explicando a regra com P10/P90 dinâmicos |
| `Filtro Cor Selecionada` | Filtro para selecionar cor no heatmap |

---

### 4.8 Ponto de Ataque — Sinais

| Medida | Sinal | Condição |
|--------|-------|----------|
| `S I1 Price Index Piorou` | I1 | Price Index caiu |
| `S I2 Preço Caiu` | I2 | Preço Sell IN caiu |
| `S I2 Preço Subiu` | I2+ | Preço Sell IN subiu (positivo) |
| `S I3 Volume Caiu` | I3 | Volume caiu |
| `S I5 Custo Subiu` | I5 | Custo Médio subiu |
| `S I6 Margem Caiu` | I6 | Margem caiu |
| `S I7 Desconto Subiu` | I7 | Desconto Negociação subiu |
| `Desconto Negociação Atual` | — | Desconto no período atual |
| `Desconto Negociação Ref` | — | Desconto no período de referência |

---

### 4.9 Ponto de Ataque — Diagnóstico (T1/T2/T3)

| Medida | Tipo | Gatilho |
|--------|------|---------|
| `T1 Problema Preço` | Tipo 1 | I2 (Preço Sell IN caiu) |
| `T2 Problema Volume` | Tipo 2 | I3 (Volume caiu) |
| `T3 Problema Rentabilidade` | Tipo 3 | I6 (Margem caiu) |
| `Qtd Tipos Disparados` | — | Soma dos tipos disparados (0–3) |
| `Deterioração Sistêmica` | — | Quando T1 + T2 + T3 disparam juntos |
| `Alerta Chave` | — | Alerta máximo consolidado da chave |

---

### 4.10 Ponto de Ataque — Causas e Ações

| Tipo | Causa | Ação |
|------|-------|------|
| T1 Preço | `Causa T1` — sub-causa do problema de preço | `Acao T1` — ação recomendada |
| T2 Volume | `Causa T2` — sub-causa do problema de volume | `Acao T2` — ação recomendada |
| T3 Rentabilidade | `Causa T3` — sub-causa do problema de rentabilidade | `Acao T3` — ação recomendada |

**Causas possíveis:**
- **T1 Preço:** 1A - Tabela caiu: planejado ou pressão? | 1B - Desconto excessivo corrói preço realizado
- **T2 Volume:** 2A - Queda estrutural de mercado | 2B - Reajuste gerou fuga de volume | 2C - Perda estrutural go-to-market
- **T3 Rentabilidade:** 3A - Margem comprimida por custo | 3B - Rebates absorvendo margem | 3C - Mix desfavorável

---

### 4.11 Visuais HTML

| Medida | Descrição |
|--------|-----------|
| `HTML Heatmap Categoria x Estado` | Tabela heatmap HTML com Score Final por Categoria × Estado |
| `HTML Heatmap Família x Estado DAX` | Tabela heatmap HTML com Score Final por Família × Estado |
| `HTML Heatmap Geral` | Heatmap geral com Score Geral |
| `HTML Ponto de Ataque` | Visual completo da página Ponto de Ataque |

---

### 4.12 IA — Chat Integrado

| Medida | Pasta | Descrição |
|--------|-------|-----------|
| `IA Contexto JSON` | IA\Contexto | Exporta estado atual do modelo como JSON para alimentar a IA |
| `Chat IA` | IA\Visual | Gera iframe do chat hospedado no Vercel com parâmetros do período atual |

---

## 5. Relacionamentos

| De | Coluna FK | Para | Coluna PK | Ativo | Filtro |
|----|-----------|------|-----------|-------|--------|
| f_faturamento | Referência Temporal | d_calendario | Data | ✅ Ativo | Uno |
| f_faturamento | Estado | d_uf | UF | ✅ Ativo | Uno |
| f_faturamento | FK_Custos | f_custos | PK_Custos | ✅ Ativo | Muitos-Muitos |
| f_faturamento | FK_BRInsights | f_brinsights | PK_BRInsights | ✅ Ativo | Muitos-Muitos |
| f_faturamento | Referência Temporal | d_periodo_atual | Data | ❌ Inativo* | Uno |
| f_faturamento | Referência Temporal | d_periodo_ref | Data | ❌ Inativo* | Uno |

> *Relacionamentos inativos são ativados via `USERELATIONSHIP` nas medidas comparativas.

---

## 6. Chaves Compostas (Joins Especiais)

### FK_Custos (f_faturamento → f_custos)
```dax
FK_Custos = 
    f_faturamento[Código Produto] & "|" & 
    FORMAT(f_faturamento[Referência Temporal], "YYYYMM") & "|" & 
    f_faturamento[Fábrica de Produção]
```

### FK_BRInsights (f_faturamento → f_brinsights)
```dax
FK_BRInsights = 
    f_faturamento[Agrupamento Nível 3] & "|" & 
    FORMAT(f_faturamento[Referência Temporal], "YYYYWW")
```

> Chaves compostas foram necessárias porque não há uma única coluna que relacione faturamento com custos (precisando de produto + mês + fábrica) e com BRInsights (produto + semana).

---

## 7. Páginas do Dashboard

### Página 1 — COVER
Tela de entrada com logo Quartzolit/Saint-Gobain e navegação para as demais páginas.

### Página 2 — RESULTADO
- **Slicers:** Período Atual (d_periodo_atual), Período Ref (d_periodo_ref), UF (d_uf), Indicador (d_indicadores)
- **Visuais:** Cards de variação por indicador, gráfico de evolução temporal, tabela por família
- **Medidas principais:** `Indicador Selecionado`, `Variação %/pp`, `Score Final`

### Página 3 — HEATMAP
- **Visual central:** HTML Heatmap Família × Estado ou Categoria × Estado
- **Medidas:** `HTML Heatmap Geral`, `Classificação`, `Score Final`
- **Lógica:** Score Final classificado por P10/P90 em Verde/Amarelo/Vermelho

### Página 4 — PONTO DE ATAQUE
- **Visual central:** `HTML Ponto de Ataque` (visual HTML personalizado)
- **Medidas:** `T1/T2/T3`, `Causa T1/T2/T3`, `Acao T1/T2/T3`, `Alerta Chave`, `Deterioração Sistêmica`
- **Filtros:** Por família, classificação (semáforo)

### Página 5 — CHAT IA
- **Visual:** HTML Content (iframe) renderizando `Chat IA`
- **URL:** `https://quartzolit-api-6a8h.vercel.app?atual=...&ref=...&uf=...&vd=...&va=...&vv=...&al=...`
- **Parâmetros passados:** período atual/ref, UF, contagem de chaves (verdes/amarelas/vermelhas), alertas das top 5 famílias

---

## 8. Arquitetura do Chat IA

### Stack Tecnológica
- **Frontend:** HTML + JavaScript (hospedado no Vercel como site estático)
- **Backend:** Vercel Serverless Functions (Node.js, plano Hobby — limite 10s por função)
- **IA:** Claude Haiku 4.5 (Anthropic API)
- **Dados:** Power BI REST API (Azure AD Client Credentials)

### Endpoints

| Endpoint | Método | Função |
|----------|--------|--------|
| `GET /` | GET | Interface do chat (HTML estático) |
| `POST /api/chat` | POST | Gera resposta via Claude (modo normal ou modo gerar_dax) |
| `POST /api/query` | POST | Executa query DAX no modelo semântico via REST API |
| `GET /api/dados` | GET | Busca KPIs + alertas via DAX (alta latência ~54s) |

### Fluxo de Consulta ao Modelo

```
1. Usuário faz pergunta (ex: "faturamento por mês em 2025")
2. Frontend detecta que precisa consultar modelo
3. POST /api/chat com action="gerar_dax" + pergunta
   → Claude gera DAX correto em <3s
4. POST /api/query com o DAX gerado
   → Token Azure AD → Power BI executeQueries → resultado
   (sem limite de tempo no browser)
5. POST /api/chat com messages + dados retornados
   → Claude interpreta e formata resposta
```

### Variáveis de Ambiente (Vercel)

| Variável | Descrição |
|----------|-----------|
| `ANTHROPIC_API_KEY` | Chave da API Anthropic (Claude) |
| `TENANT_ID` | Azure AD Tenant ID |
| `CLIENT_ID` | App Registration Client ID |
| `CLIENT_SECRET` | App Registration Client Secret |
| `WORKSPACE_ID` | ID do workspace Power BI |
| `DATASET_ID` | ID do dataset/modelo semântico |

### Schema DAX usado pelo Claude para gerar consultas

```
COLUNAS d_calendario:
- d_calendario[Ano] INTEGER
- d_calendario[Mês Número] INTEGER  
- d_calendario[Mês Nome] STRING
- d_calendario[Ano-Mês] STRING "2025-01"

COLUNAS f_faturamento:
- f_faturamento[Agrupamento Nível 1] STRING (família)
- f_faturamento[Estado] STRING (UF)

DIMENSÕES:
- d_uf[UF] STRING (siglas: SP, RJ, MG...)

MEDIDAS PRINCIPAIS:
- [Faturamento Pocket], [Receita], [Volume], [Margem], [Preço Sell IN]
```

---

## 9. Lógica de Negócio

### Score Final (0–100)
- **0** = nenhum problema
- **100** = máximo de deterioração
- Calculado por normalização min-max das variações negativas de cada indicador
- Ponderado entre: Receita, Volume, Preço Sell IN, Margem, Custo Médio, Price Index

### Classificação Semáforo
```
Score ≤ P10 → 🟢 Verde (saudável)
P10 < Score < P90 → 🟡 Amarelo (atenção)
Score ≥ P90 → 🔴 Vermelho (crítico)
```
> P10 e P90 são calculados dinamicamente sobre todas as chaves (com ALL(d_uf) para estabilidade).

### Deterioração Sistêmica
Ocorre quando T1 (Preço) + T2 (Volume) + T3 (Rentabilidade) disparam simultaneamente na mesma família/chave — sinal de problema estrutural grave.

### Chave de Análise
A chave básica de análise é: **Família (Agrupamento Nível 1) × UF**. Cada combinação família-estado é uma "chave" classificada pelo semáforo.

---

## 10. Glossário

| Termo | Definição |
|-------|-----------|
| **Faturamento Pocket** | Receita líquida após todos os descontos aplicados |
| **Receita** | Evolução medida com volume constante (isolando efeito preço) |
| **Volume** | Evolução medida com preço constante (isolando efeito volume) |
| **Preço Sell IN** | Preço de venda da Quartzolit ao canal (distribuidor/varejista) |
| **Preço Sell Out** | Preço de venda ao consumidor final (coletado via BRInsights) |
| **Price Index** | Razão entre Preço Sell IN Quartzolit e Preço Sell Out de mercado — posição competitiva |
| **Custo RBE** | Custo Realizado Bruto Estimado — custo padrão usado no cálculo de margem |
| **Margem** | (Receita − Custo RBE) / Receita |
| **P10/P90** | Percentil 10 e 90 do Score Final — limiares dinâmicos para classificação |
| **T1/T2/T3** | Tipos de problema: T1=Preço, T2=Volume, T3=Rentabilidade |
| **Deterioração Sistêmica** | T1 + T2 + T3 disparados simultaneamente |
| **BRInsights** | Ferramenta de inteligência de mercado com coleta de preços concorrentes |
| **ZLIP** | Preço lista interno da Quartzolit |
| **Chave** | Combinação Família × UF — unidade básica de análise do dashboard |

---

*Documentação gerada em: Abril/2026*  
*Modelo: Quartzolit — Central de Comando (Power BI Desktop)*
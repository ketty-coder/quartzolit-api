# Documentação Técnica — Score e Classificação
**Modelo Semântico Quartzolit · Central de Comando**
_Gerado automaticamente via MCP · Maio/2026_

---

## Visão Geral

O sistema de score é o coração da Central de Comando. Ele transforma variações percentuais de 4 indicadores em um único número (0–100) que representa o grau de deterioração de cada chave comercial. Esse número alimenta a classificação Verde / Amarelo / Vermelho exibida nos visuais do dashboard.

---

## 1. Granularidade

O score é calculado individualmente para cada **chave**, definida como a combinação de:

```
UF  ×  Agrupamento Clientes  ×  Agrupamento Nível 3
```

O **Score Ponderado** — usado na `Classificação` — agrega essas chaves usando a **Receita Atual como peso**, dentro do contexto de filtros ativo na tela.

---

## 2. Indicadores que compõem o score

| Indicador | Medida DAX | Direção penalizada |
|-----------|-----------|-------------------|
| Volume | `Variação % Volume` | Queda |
| Preço Sell IN | `Variação % Preço Sell IN` | Queda |
| Custo Médio | `Variação % Custo Médio` | Alta |
| Price Index | `Variação % Price Index` | Queda |

> **Custo Médio** é penalizado por **alta** (quanto mais o custo subiu, pior). Os demais são penalizados por **queda**.

> **Price Index** retorna `BLANK` quando não há dados de mercado disponíveis para aquela chave. Nesses casos ele é excluído da média — o Score Final é calculado com os 3 indicadores restantes.

---

## 3. Cadeia de cálculo passo a passo

### Passo 1 — Penalização

Captura apenas o lado negativo da variação. Se o indicador subiu, a penalização é zero.

```dax
Penal Volume      = ABS( MIN(0, [Variação % Volume]) )
Penal Preço       = ABS( MIN(0, [Variação % Preço Sell IN]) )
Penal Custo Médio = ABS( MIN(0, [Variação % Custo Médio]) )
Penal Price Index = ABS( MIN(0, [Variação % Price Index]) )
```

**Exemplos:**
- Volume caiu 8%  → `Penal Volume = 0,08`
- Volume subiu 5% → `Penal Volume = 0`
- Custo subiu 12% → `Penal Custo Médio = 0` *(custo é invertido — veja Passo 2)*

> ⚠️ Para o Custo Médio, a lógica de inversão acontece no próprio `Minimo Custo Medio` — o mínimo da variação de custo é o valor mais negativo (maior queda de custo), então uma alta de custo gera penalização positiva ao entrar na fórmula do Score.

---

### Passo 2 — Mínimo de referência (âncora da escala)

Cada indicador tem um mínimo calculado sobre **todos os estados**, independentemente do filtro de UF aplicado na tela. Isso garante que a escala de normalização seja consistente — o pior caso observado em qualquer UF do modelo serve como piso.

```dax
Minimo Volume = MINX(
    FILTER(
        ALL(d_uf[UF]),
        -- exclui UFs sem dados válidos nos dois períodos
        CALCULATE([Volume Ref])  <> 0 &&
        CALCULATE([Volume Atual]) <> 0 &&
        NOT ISBLANK(CALCULATE([Volume Ref])) &&
        NOT ISBLANK(CALCULATE([Volume Atual]))
    ),
    CALCULATE([Variação % Volume])
)
```

A mesma lógica se aplica para `Minimo Preço Sell IN`, `Minimo Custo Medio` e `Minimo Price Index`.

**O que esse valor representa:** é a maior queda percentual observada entre todas as UFs com dados válidos, para aquele indicador, no período comparado. Serve como "piso" da normalização.

---

### Passo 3 — Score individual por indicador (escala 0 a 1)

```dax
Score Volume =
IF(
    [Variação % Volume] = 1 || [Variação % Volume] = -1,
    0,  -- entrada ou saída de produto → score zero para evitar distorção
    1 - DIVIDE(
        [Penal Volume] - ABS([Minimo Volume]),
        -ABS([Minimo Volume])
    )
)
```

**Como interpretar a fórmula:**

```
Score = 1 - ( (Penal - |Mínimo|) / -|Mínimo| )
      = 1 - ( (Penal / |Mínimo|) - 1 )
      = 2 - Penal / |Mínimo|
```

| Situação | Penalização | Resultado |
|----------|------------|-----------|
| Não caiu | 0 | Score = 1,0 (máximo) |
| Caiu metade do pior caso | |Mínimo| / 2 | Score = 0,5 |
| Caiu igual ao pior caso | |Mínimo| | Score = 0,0 (mínimo) |

A mesma fórmula se aplica para Score Preço Sell IN e Score Custo Médio.

**Price Index tem tratamento especial:**
```dax
Score Price Index =
IF(
    [Variação % Price Index] = 1  ||
    [Variação % Price Index] = -1 ||
    [Variação % Price Index] = BLANK(),
    BLANK(),  -- sem dados de mercado → exclui do cálculo
    1 - DIVIDE(...)
)
```

---

### Passo 4 — Score Final (média simples, escala 0–100)

```dax
Score Final =
VAR v1 = [Score Volume]
VAR v2 = [Score Custo Médio]
VAR v3 = [Score Price Index]
VAR v4 = [Score Preço Sell IN]

VAR Soma =
    COALESCE(v1,0) + COALESCE(v2,0) + COALESCE(v3,0) + COALESCE(v4,0)

VAR Qtd =
    IF(NOT ISBLANK(v1),1,0) +
    IF(NOT ISBLANK(v2),1,0) +
    IF(NOT ISBLANK(v3),1,0) +
    IF(NOT ISBLANK(v4),1,0)

RETURN ROUND( DIVIDE(Soma, Qtd) * 100, 0 )
```

Resultado: **inteiro de 0 a 100**.
- `0` = máxima deterioração (todos os indicadores no pior caso)
- `100` = sem deterioração (todos os indicadores sem queda)

Se Price Index for BLANK, o Score Final é calculado com os 3 indicadores disponíveis.

---

### Passo 5 — Score Ponderado (agregação por Receita)

Itera sobre todas as chaves `UF × Agrupamento Clientes × Agrupamento Nível 3` e pondera o Score Final pela Receita Atual de cada chave:

```dax
Score Ponderado =
DIVIDE(
    SUMX(
        SUMMARIZE(
            f_faturamento,
            d_uf[UF],
            f_faturamento[Agrupamento Clientes],
            f_faturamento[Agrupamento Nível 3]
        ),
        VAR vReceita = [Receita Atual]
        VAR vScore   = [Score Final]
        RETURN IF(NOT ISBLANK(vReceita) && NOT ISBLANK(vScore),
                  vScore * vReceita)
    ),
    SUMX(
        SUMMARIZE(
            f_faturamento,
            d_uf[UF],
            f_faturamento[Agrupamento Clientes],
            f_faturamento[Agrupamento Nível 3]
        ),
        VAR vReceita = [Receita Atual]
        RETURN IF(NOT ISBLANK(vReceita), vReceita)
    )
)
```

**Efeito prático:** chaves com maior receita têm mais peso na nota final agregada. Um produto pequeno com score 0 afeta menos o resultado do que um produto grande com score 0.

---

## 4. Classificação: Verde, Amarelo ou Vermelho

A `Classificação` compara o **Score Ponderado** da chave contra dois limiares:

```dax
Classificação =
VAR vScore = [Score Ponderado]
VAR vP10   = [P10 Score Final]  -- atualmente = 35 (fixo)
VAR vP90   = [P90 Score Final]  -- atualmente = 50 (fixo)

RETURN
    IF( ISBLANK(vScore), BLANK(),
    IF( vP10 = vP90, "Sem dados",
        SWITCH(TRUE(),
            vScore < vP10, "Verde",
            vScore > vP90, "Vermelho",
            "Amarelo"
        )
    ))
```

### Tabela de decisão

| Score Ponderado | Classificação | Significado |
|-----------------|---------------|-------------|
| < 35 | 🟢 **Verde** | Baixa deterioração — performance boa |
| 35 a 50 | 🟡 **Amarelo** | Deterioração moderada — atenção |
| > 50 | 🔴 **Vermelho** | Alta deterioração — ação necessária |
| BLANK | — | Sem dados suficientes |
| P10 = P90 | "Sem dados" | Distribuição degenerada |

### ⚠️ Inversão intencional da escala

A escala está **invertida em relação ao intuitivo**:

- Score **baixo** (próximo de 0) = **pouca queda** = **Verde** ✅
- Score **alto** (próximo de 100) = **grande queda** = **Vermelho** ❌

Isso acontece porque o score mede **intensidade de deterioração**, não performance positiva. Um score 0 significa que nenhum indicador piorou — é a melhor situação possível.

---

## 5. Limiares P10 e P90 — situação atual

Os limiares estão **hardcoded** nas medidas:

```dax
P10 Score Final = 35   -- fixo, definido manualmente
P90 Score Final = 50   -- fixo, definido manualmente
```

O código comentado nas medidas indica a intenção original de calcular dinamicamente:

```dax
-- PERCENTILEX.INC(
--     ALLSELECTED(f_faturamento[Agrupamento Nível 1]),
--     CALCULATE([Score Final]),
--     0.10
-- )
```

**Implicações dos limiares fixos:**
- A faixa Amarelo (35–50) é estreita — 15 pontos numa escala de 100
- Não se adapta automaticamente quando o contexto muda (período, UF, agrupamento)
- Calibração manual necessária ao longo do tempo

**Recomendação:** após acumular pelo menos 3 meses de dados reais, recalibrar os limiares com base na distribuição efetiva dos scores observados, ou ativar o cálculo dinâmico via `PERCENTILEX.INC`.

---

## 6. Impacto dos filtros do contexto

| Filtro aplicado | Impacto no Score Ponderado | Impacto nos Mínimos |
|-----------------|---------------------------|---------------------|
| Slicer UF | Filtra as chaves agregadas | ❌ Não afeta — Mínimos usam `ALL(d_uf)` |
| Slicer Período Atual | Muda os valores Atual de todos os indicadores | ✅ Afeta — variações recalculadas |
| Slicer Período Ref | Muda a base de comparação | ✅ Afeta — variações recalculadas |
| Slicer Agrupamento Nível 1 | Filtra as chaves do SUMMARIZE | ❌ Não afeta os Mínimos |
| Slicer Agrupamento Clientes | Filtra as chaves do SUMMARIZE | ❌ Não afeta os Mínimos |
| Nenhum filtro | Score agrega todas as chaves com dados | Mínimos = pior caso global |

**Ponto importante:** os **Mínimos são sempre calculados sobre `ALL(d_uf[UF])`**. Isso significa que filtrar por UF na tela não muda a âncora da escala — um score 0,3 em São Paulo significa a mesma coisa que um score 0,3 no Paraná.

---

## 7. Diagrama da cadeia completa

```
Variação % Volume ──────► Penal Volume ──────► Minimo Volume ──► Score Volume ──┐
Variação % Preço  ──────► Penal Preço  ──────► Minimo Preço  ──► Score Preço   ──┤
Variação % Custo  ──────► Penal Custo  ──────► Minimo Custo  ──► Score Custo   ──┼──► Score Final (0–100)
Variação % PI     ──────► Penal PI     ──────► Minimo PI     ──► Score PI      ──┘         │
                                                                                            │
                                                                              Score Ponderado
                                                                         (ponderado por Receita Atual)
                                                                                            │
                                                                    ┌───────────────────────┘
                                                                    ▼
                                                          P10 = 35 ──► Verde  (< 35)
                                                          P90 = 50 ──► Amarelo (35–50)
                                                                    ──► Vermelho (> 50)
```

---

## 8. Exemplo numérico

**Cenário:** chave `SP × Canal Direto × Argamassa AC-II`

| Indicador | Var % Atual | Var % Mínimo (pior UF) | Penalização | Score |
|-----------|------------|----------------------|-------------|-------|
| Volume | -12% | -30% | 0,12 | 0,60 |
| Preço Sell IN | -5% | -20% | 0,05 | 0,75 |
| Custo Médio | +8% | +25% | 0,08 | 0,68 |
| Price Index | -3% | -15% | 0,03 | 0,80 |

```
Score Final = ROUND( MÉDIA(0,60; 0,75; 0,68; 0,80) × 100, 0 )
            = ROUND( 0,7075 × 100, 0 )
            = 71
```

**Score Ponderado** = 71 → **Vermelho** (> 50)

---

## 9. Uso na documentação do Chat IA

Ao incorporar o score no system prompt do Chat IA, considerar:

- O JSON atual envia apenas contagem de `verdes`, `amarelas` e `vermelhas` — não o score numérico por família
- Para respostas mais precisas, enriquecer o JSON com `"score_ponderado"` por família crítica
- Ao interpretar a classificação, lembrar que **Verde = baixa deterioração** (score < 35), não necessariamente crescimento absoluto
- Os limiares fixos (35/50) devem ser documentados no prompt para a IA não extrapolar interpretações dinâmicas que o modelo ainda não suporta

---

_Documentação gerada com leitura direta das medidas DAX via MCP · powerbi-modeling-mcp · Quantiz · Maio/2026_

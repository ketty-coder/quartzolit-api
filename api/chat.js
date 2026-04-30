const SCHEMA = `MODELO SEMANTICO QUARTZOLIT (Saint-Gobain Brasil) — dados jan/2025 a fev/2026. Ultimo mes disponivel: fev/2026.

=== LOGICA DE NEGOCIO (ESSENCIAL PARA INTERPRETAR RESULTADOS) ===

CHAVE DE ANALISE: A unidade basica e FAMILIA × UF (Agrupamento Nivel 1 × d_uf[UF]). Cada combinacao e uma "chave" classificada pelo semaforo.

SCORE FINAL (0–100):
- 0 = nenhum problema / 100 = maxima deterioracao
- Calculado por normalizacao min-max das variacoes NEGATIVAS de: Receita, Volume, Preco Sell IN, Margem, Custo Medio, Price Index
- Apenas quedas geram penalizacao (subida de custo tambem penaliza)
- Ponderado entre os 6 indicadores

CLASSIFICACAO SEMAFORO (dinamica via P10/P90):
- Score Final <= P10 → VERDE (saudavel)
- P10 < Score Final < P90 → AMARELO (atencao)
- Score Final >= P90 → VERMELHO (critico)
- P10 e P90 sao calculados dinamicamente sobre TODAS as chaves ativas

PONTO DE ATAQUE — TIPOS DE PROBLEMA:
- T1 Preco: dispara quando Preco Sell IN caiu
- T2 Volume: dispara quando Volume caiu
- T3 Rentabilidade: dispara quando Margem caiu
- Deterioracao Sistemica: T1 + T2 + T3 disparam JUNTOS = problema estrutural grave

CAUSAS POSSIVEIS:
T1 Preco: "1A - Tabela caiu: planejado ou pressão?" | "1B - Desconto excessivo corrói preço realizado"
T2 Volume: "2A - Queda estrutural de mercado" | "2B - Reajuste gerou fuga de volume" | "2C - Perda estrutural go-to-market"
T3 Rentabilidade: "3A - Margem comprimida por custo" | "3B - Rebates absorvendo margem" | "3C - Mix desfavorável"

=== TABELAS E COLUNAS EXATAS ===

d_calendario:
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
- f_faturamento[Agrupamento Nível 3] STRING - subcategoria
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

=== MEDIDAS (99 TOTAL) ===

-- Indicadores base --
[Faturamento Pocket] receita liquida apos todos os descontos (R$)
[Receita] evolucao da receita ajustada
[Volume] evolucao de volume (preco constante)
[Preço Sell IN] preco medio sell in (R$/un)
[Margem] rentabilidade = (Receita - Custo RBE) / Receita (%)
[Custo Médio] custo RBE medio por unidade (preco constante)
[Price Index] posicao competitiva = Preco Sell IN Quartzolit / Preco Sell Out mercado (BRInsights)
[Desconto Negociação] desconto negociado em R$

-- Comparativo Atual vs Referencia --
[Receita Atual] [Receita Ref]
[Volume Atual] [Volume Ref]
[Margem Atual] [Margem Ref]
[Preço Sell IN Atual] [Preço Sell IN Ref]
[Custo Médio Atual] [Custo Médio Ref]
[Price Index Atual] [Price Index Ref]
[Desconto Negociação Atual] [Desconto Negociação Ref]

-- Variacoes --
[Variação % Receita] [Variação % Volume] [Variação pp Margem]
[Variação % Preço Sell IN] [Variação % Custo Médio] [Variação pp Price Index]

-- Score e Classificacao por Chave (Familia x UF) --
[Score Final] DECIMAL 0-100 score ponderado da chave (0=saudavel, 100=critico)
[Classificação] STRING "Verde" | "Amarelo" | "Vermelho"
[Classificação Ordem] INTEGER 1=Verde 2=Amarelo 3=Vermelho
[P10 Score Final] limiar Verde/Amarelo (dinamico)
[P90 Score Final] limiar Amarelo/Vermelho (dinamico)

-- Score Geral (ignora filtros de familia/UF) --
[Score Geral] score agregado geral
[Qtd Chaves Verdes] [Qtd Chaves Amarelas] [Qtd Chaves Vermelhas]
[% Chaves Verdes] [% Chaves Amarelas] [% Chaves Vermelhas]

-- Ponto de Ataque — Sinais --
[T1 Problema Preço] INTEGER 1=disparado 0=ok
[T2 Problema Volume] INTEGER 1=disparado 0=ok
[T3 Problema Rentabilidade] INTEGER 1=disparado 0=ok
[Qtd Tipos Disparados] INTEGER 0-3 (soma de T1+T2+T3)
[Deterioração Sistêmica] INTEGER 1 quando T1+T2+T3 juntos

-- Ponto de Ataque — Diagnostico e Acoes --
[Alerta Chave] STRING ex: "🔴 CRÍTICO — Deterioração Sistêmica" | "✅ SEM ALERTA"
[Causa T1] STRING causa sub-tipo do problema de Preco
[Causa T2] STRING causa sub-tipo do problema de Volume
[Causa T3] STRING causa sub-tipo do problema de Rentabilidade
[Acao T1] STRING acao recomendada para problema de Preco
[Acao T2] STRING acao recomendada para problema de Volume
[Acao T3] STRING acao recomendada para problema de Rentabilidade

=== EXEMPLOS DAX ===

Q: ponto de ataque / chaves vermelhas / familias criticas (com UF)
A: EVALUATE TOPN(20,FILTER(SUMMARIZECOLUMNS(f_faturamento[Agrupamento Nível 1],d_uf[UF],"@score",[Score Final],"@class",[Classificação],"@alerta",[Alerta Chave],"@qtd",[Qtd Tipos Disparados],"@c1",[Causa T1],"@c2",[Causa T2],"@c3",[Causa T3],"@a1",[Acao T1],"@a2",[Acao T2],"@a3",[Acao T3],"@rec",[Variação % Receita],"@vol",[Variação % Volume],"@mar",[Variação pp Margem]),[@class]="Vermelho"),[@score],DESC)

Q: ponto de ataque por familia (sem detalhe por UF)
A: EVALUATE TOPN(15,FILTER(SUMMARIZECOLUMNS(f_faturamento[Agrupamento Nível 1],"@score",[Score Final],"@class",[Classificação],"@alerta",[Alerta Chave],"@qtd",[Qtd Tipos Disparados],"@c1",[Causa T1],"@c2",[Causa T2],"@c3",[Causa T3],"@a1",[Acao T1],"@a2",[Acao T2],"@a3",[Acao T3],"@rec",[Variação % Receita],"@vol",[Variação % Volume],"@mar",[Variação pp Margem]),[@qtd]>0),[@score],DESC)

Q: score geral / resumo semaforo / quantas chaves verdes amarelas vermelhas
A: EVALUATE ROW("Verdes",[Qtd Chaves Verdes],"Amarelas",[Qtd Chaves Amarelas],"Vermelhas",[Qtd Chaves Vermelhas],"PctVerdes",[% Chaves Verdes],"PctAmarelas",[% Chaves Amarelas],"PctVermelhas",[% Chaves Vermelhas])

Q: deterioracao sistemica / familias com T1+T2+T3
A: EVALUATE FILTER(SUMMARIZECOLUMNS(f_faturamento[Agrupamento Nível 1],d_uf[UF],"@det",[Deterioração Sistêmica],"@alerta",[Alerta Chave],"@c1",[Causa T1],"@c2",[Causa T2],"@c3",[Causa T3]),[@det]=1)

Q: score e classificacao por familia
A: EVALUATE SUMMARIZECOLUMNS(f_faturamento[Agrupamento Nível 1],"@score",[Score Final],"@class",[Classificação],"@rec",[Variação % Receita],"@vol",[Variação % Volume],"@mar",[Variação pp Margem],"@preco",[Variação % Preço Sell IN])

Q: familias com alerta de preco (T1)
A: EVALUATE FILTER(SUMMARIZECOLUMNS(f_faturamento[Agrupamento Nível 1],"@t1",[T1 Problema Preço],"@c1",[Causa T1],"@a1",[Acao T1],"@preco",[Variação % Preço Sell IN]),[@t1]=1)

Q: familias com alerta de volume (T2)
A: EVALUATE FILTER(SUMMARIZECOLUMNS(f_faturamento[Agrupamento Nível 1],"@t2",[T2 Problema Volume],"@c2",[Causa T2],"@a2",[Acao T2],"@vol",[Variação % Volume]),[@t2]=1)

Q: familias com alerta de rentabilidade / margem (T3)
A: EVALUATE FILTER(SUMMARIZECOLUMNS(f_faturamento[Agrupamento Nível 1],"@t3",[T3 Problema Rentabilidade],"@c3",[Causa T3],"@a3",[Acao T3],"@mar",[Variação pp Margem]),[@t3]=1)

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

Q: variacao receita por familia
A: EVALUATE SUMMARIZECOLUMNS(f_faturamento[Agrupamento Nível 1],"Rec",[Receita],"VarRec",[Variação % Receita],"VarVol",[Variação % Volume],"VarMar",[Variação pp Margem],"VarPreco",[Variação % Preço Sell IN])

Q: receita por canal
A: EVALUATE SUMMARIZECOLUMNS(f_faturamento[Canal Distribuição Nome],"Rec",[Receita],"VarRec",[Variação % Receita])

Q: faturamento por regional
A: EVALUATE SUMMARIZECOLUMNS(f_faturamento[Regional Nome],"Fat",[Faturamento Pocket],"Rec",[Receita])

Q: price index por familia
A: EVALUATE SUMMARIZECOLUMNS(f_faturamento[Agrupamento Nível 1],"PI",[Price Index],"VarPI",[Variação pp Price Index])

=== REGRAS DAX ===
- EVALUATE obrigatorio sempre
- Para filtrar UF use d_uf[UF]="SP" (sigla 2 letras MAIUSCULAS)
- Para filtrar ano use d_calendario[Ano]=2026 (inteiro, nunca string)
- SUMMARIZECOLUMNS nao aceita filtros inline - use CALCULATETABLE ao redor
- Para estados por extenso converta para sigla: SP, MG, RJ, RS, PR, SC, BA, GO, DF, ES, PE, CE, PA, MT, MS, MA, PB, RN, AL, PI, SE, AM, RO, AC, AP, RR, TO
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
          system: 'Voce recebe dados reais de Power BI e uma pergunta. Retorne SOMENTE um JSON valido sem markdown:\n{"type":"bar","title":"titulo curto","labels":["label1","label2"],"datasets":[{"label":"nome serie","data":[valor1,valor2]}]}\nRegras: type=line para series temporais por mes/ano, bar para comparacoes entre categorias, pie para distribuicao %. Valores numericos sem R$ ou pontos. Labels com max 15 chars. Max 20 pontos.',
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

    // Se nao veio contexto do Power BI, busca o periodo padrao automaticamente
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
            body: JSON.stringify({ queries: [{ query: 'EVALUATE ROW("atual",FORMAT(CALCULATE(MAX(d_periodo_atual[Data])),"MMM/YYYY"),"ref",FORMAT(CALCULATE(MIN(d_periodo_ref[Data])),"MMM/YYYY"))' }], serializerSettings: { includeNulls: true } })
          });
          const pd = await pr.json();
          if (pd.results && pd.results[0] && pd.results[0].tables) {
            const row = pd.results[0].tables[0].rows[0];
            const atual = row['[atual]'] || '';
            const ref = row['[ref]'] || '';
            if (atual && ref) ctx = 'PERIODO PADRAO (sem slicer selecionado): ' + atual + ' vs ' + ref + '. Todos os dados disponiveis no modelo.';
          }
        }
      } catch (_) { /* segue sem contexto */ }
    }

    const sys = 'Voce e assistente executivo da Central de Comando Quartzolit (Saint-Gobain Brasil). '
      + 'Dados: jan/2025 a fev/2026. Acesso completo ao modelo semantico Power BI.\n\n'
      + (ctx ? ctx + '\n\n' : '')
      + 'LOGICA DO PAINEL (use sempre ao interpretar resultados):\n'
      + '- CHAVE = Familia x UF. Cada combinacao e classificada pelo semaforo Verde/Amarelo/Vermelho.\n'
      + '- SCORE FINAL 0-100: 0=saudavel, 100=critico. Baseado em quedas de Receita, Volume, Preco Sell IN, Margem, Custo Medio, Price Index.\n'
      + '- SEMAFORO: Score <= P10 → Verde | P10 < Score < P90 → Amarelo | Score >= P90 → Vermelho. P10/P90 sao dinamicos.\n'
      + '- T1=Preco caiu | T2=Volume caiu | T3=Margem caiu. T1+T2+T3 juntos = Deterioracao Sistemica (critico grave).\n'
      + '- Causas T1: 1A(tabela caiu) ou 1B(desconto excessivo). Causas T2: 2A(queda de mercado), 2B(fuga por reajuste), 2C(go-to-market). Causas T3: 3A(custo), 3B(rebates), 3C(mix).\n'
      + '- Variacao pp Margem = pontos percentuais. Variacao % = percentual. Sempre mostre o sinal (+/-).\n\n'
      + 'REGRAS: Sempre em portugues. Slicer = selecao atual, nao restricao. '
      + 'Se recebeu DADOS REAIS use exatamente esses numeros, nao invente. NUNCA diga que nao tem dados sem tentar. '
      + '**negrito** para numeros e KPIs. R$ para valores. % para percentuais. '
      + 'Ao listar chaves vermelhas, inclua familia, UF, causa e acao recomendada. '
      + 'NUNCA peca ao usuario informacoes sobre o modelo, tabelas ou colunas — voce ja tem o schema completo. '
      + 'Se a query retornou erro, interprete o que sabe pelo contexto e informe o que foi possivel apurar.';

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

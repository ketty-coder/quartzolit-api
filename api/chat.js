export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, pbiContext } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
    const pbiBase = `https://api.powerbi.com/v1.0/myorg/groups/${process.env.WORKSPACE_ID}/datasets/${process.env.DATASET_ID}/executeQueries`;

    // Catalogo de medidas do modelo semantico
    const CATALOGO = `MEDIDAS DISPONIVEIS NO MODELO SEMANTICO:
- [Faturamento Pocket]: valor absoluto do faturamento
- [Receita]: evolucao da receita obtida
- [Receita Atual]: receita no periodo DE selecionado
- [Receita Ref]: receita no periodo ATE selecionado
- [Variacao % Receita]: variacao % entre os dois periodos
- [Volume]: evolucao de volume (Preco Constante)
- [Volume Atual] / [Volume Ref] / [Variacao % Volume]
- [Preco Sell IN]: evolucao de preco (Volume Constante)
- [Preco Sell IN Atual] / [Preco Sell IN Ref] / [Variacao % Preco Sell IN]
- [Margem]: rentabilidade (Receita - Custo) / Receita
- [Margem Atual] / [Margem Ref] / [Variacao pp Margem]
- [Custo Medio Atual] / [Custo Medio Ref] / [Variacao % Custo Medio]
- [Price Index Atual] / [Price Index Ref] / [Variacao pp Price Index]
- [Score Final]: score 0-100 por familia
- [Qtd Chaves Verdes] / [Qtd Chaves Amarelas] / [Qtd Chaves Vermelhas]
- [Alerta Chave]: alerta maximo consolidado
- [Causa T1] / [Causa T2] / [Causa T3]: causas dos problemas

DIMENSOES DISPONIVEIS:
- d_periodo_atual[Ano-Mes Label]: periodo atual (ex: jan/2025, fev/2025, ..., set/2025)
- d_periodo_ref[Ano-Mes Label]: periodo referencia
- f_faturamento[Agrupamento Nivel 1]: familia de produtos
- d_uf[UF]: estado brasileiro
- d_filial[Filial]: filial/unidade de negocio
- d_material[Material]: produto especifico
- d_classificacao[Classificacao]: classificacao do produto

EXEMPLOS DE DAX VALIDO:
-- Faturamento total jan/2025:
EVALUATE ROW("fat", CALCULATE([Faturamento Pocket], d_periodo_atual[Ano-Mes Label] = "jan/2025"))
-- Receita por familia:
EVALUATE SUMMARIZECOLUMNS(f_faturamento[Agrupamento Nivel 1], "receita", [Receita Atual])
-- Top 5 familias por faturamento:
EVALUATE TOPN(5, SUMMARIZECOLUMNS(f_faturamento[Agrupamento Nivel 1], "fat", [Faturamento Pocket]), [fat], DESC)`;

    // PASSO 1: Claude gera o DAX baseado na pergunta
    const userMsg = messages[messages.length - 1].content;
    const daxPrompt = `Voce e um especialista em DAX do Power BI para o modelo semantico Quartzolit.

${CATALOGO}

${pbiContext ? 'CONTEXTO DO PERIODO ATUAL:\n' + pbiContext : ''}

PERGUNTA DO USUARIO: "${userMsg}"

TAREFA: Gere UMA query DAX para responder essa pergunta.
- Use EVALUATE como primeira palavra
- Use CALCULATE() para filtros de periodo
- Nomes de colunas com acentos exatamente como listados acima
- Se a pergunta for sobre scores/alertas, use as medidas de Score e Classificacao
- Se perguntar sobre valor absoluto, use [Faturamento Pocket] ou [Receita Atual]
- Para filtros de periodo, use: FILTER(ALL(d_periodo_atual), d_periodo_atual[Ano-Mes Label] = "mes/ano")
- Retorne APENAS a query DAX, sem explicacao, sem markdown, sem backticks`;

    const daxResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300,
        messages: [{ role: 'user', content: daxPrompt }] })
    });
    const daxData = await daxResp.json();
    const daxQuery = daxData.content && daxData.content[0] ? daxData.content[0].text.trim() : null;

    let resultadoPBI = null;

    // PASSO 2: Executa o DAX no Power BI (so se a query for valida)
    if (daxQuery && daxQuery.toUpperCase().startsWith('EVALUATE') &&
        !daxQuery.includes('ANTHROPIC') && !daxQuery.includes('http')) {
      try {
        const token = await getToken();
        const pbiResp = await fetch(pbiBase, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ queries: [{ query: daxQuery }], serializerSettings: { includeNulls: true } })
        });
        const pbiData = await pbiResp.json();
        if (pbiData.results && pbiData.results[0] && pbiData.results[0].tables) {
          const rows = pbiData.results[0].tables[0].rows || [];
          resultadoPBI = JSON.stringify(rows).substring(0, 1500);
        } else {
          resultadoPBI = 'Erro DAX: ' + JSON.stringify(pbiData).substring(0, 300);
        }
      } catch(e) {
        resultadoPBI = 'Erro ao executar DAX: ' + e.message;
      }
    }

    // PASSO 3: Claude responde com os dados reais
    const ctxFinal = (pbiContext || '') +
      (resultadoPBI ? '\n\nRESULTADO DA QUERY DAX:\n' + resultadoPBI : '');

    const sys = 'Voce e assistente executivo da Quartzolit (Saint-Gobain Brasil).\n'
      + (ctxFinal ? ctxFinal + '\n' : '')
      + 'REGRAS: Portugues. Use os dados acima. Seja objetivo. **negrito** para numeros. '
      + 'Se tiver resultado DAX, interprete os valores (Faturamento Pocket e Receita estao em R$ mil). '
      + 'Score 0-100: verde=saudavel, vermelho=critico.';

    const finalResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 600, system: sys, messages })
    });
    const finalData = await finalResp.json();
    return res.status(200).json(finalData);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

async function getToken() {
  const r = await fetch(
    'https://login.microsoftonline.com/' + process.env.TENANT_ID + '/oauth2/v2.0/token',
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials',
        client_id: process.env.CLIENT_ID, client_secret: process.env.CLIENT_SECRET,
        scope: 'https://analysis.windows.net/powerbi/api/.default' }) }
  );
  const d = await r.json();
  if (!d.access_token) throw new Error('Token: ' + JSON.stringify(d));
  return d.access_token;
      }

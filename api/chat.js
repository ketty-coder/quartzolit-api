export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, pbiContext } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

    const KEY = process.env.ANTHROPIC_API_KEY;
    const pbiUrl = 'https://api.powerbi.com/v1.0/myorg/groups/' + process.env.WORKSPACE_ID + '/datasets/' + process.env.DATASET_ID + '/executeQueries';

    const CATALOGO = `MODELO SEMANTICO QUARTZOLIT - REFERENCIA DAX:

MEDIDAS (use [NomeMedida]):
- [Faturamento Pocket]: valor absoluto R$ do faturamento
- [Receita Atual]: receita no periodo atual selecionado
- [Receita Ref]: receita no periodo referencia
- [Variacao % Receita]: variacao % entre periodos
- [Volume Atual] / [Volume Ref] / [Variacao % Volume]
- [Preco Sell IN Atual] / [Preco Sell IN Ref] / [Variacao % Preco Sell IN]
- [Margem Atual] / [Margem Ref] / [Variacao pp Margem]
- [Custo Medio Atual] / [Custo Medio Ref] / [Variacao % Custo Medio]
- [Score Final]: score 0-100 por chave
- [Qtd Chaves Verdes] / [Qtd Chaves Amarelas] / [Qtd Chaves Vermelhas]
- [Alerta Chave]: status do alerta
- [Causa T1] / [Causa T2] / [Causa T3]

FILTRO POR PERIODO (IMPORTANTE - use d_calendario):
- d_calendario[Ano-Mes]: formato "YYYY-MM" (ex: "2025-01", "2025-09")
- Dados disponiveis: 2025-01 ate 2025-10
- Para filtrar jan/2025: CALCULATE([medida], d_calendario[Ano-Mes] = "2025-01")

DIMENSOES PARA AGRUPAR:
- f_faturamento[Agrupamento Nivel 1]: familia de produto
- d_uf[UF]: estado (ex: "SP", "RJ")
- d_filial[Filial]: filial
- d_material[Material]: produto

EXEMPLOS:
-- Faturamento total jan/2025:
EVALUATE ROW("resultado", CALCULATE([Faturamento Pocket], d_calendario[Ano-Mes] = "2025-01"))

-- Faturamento por familia em jan/2025:
EVALUATE SUMMARIZECOLUMNS(f_faturamento[Agrupamento Nivel 1], FILTER(ALL(d_calendario), d_calendario[Ano-Mes] = "2025-01"), "fat", [Faturamento Pocket])

-- Top 5 familias por faturamento (periodo atual):
EVALUATE TOPN(5, SUMMARIZECOLUMNS(f_faturamento[Agrupamento Nivel 1], "fat", [Faturamento Pocket]), [fat], DESC)

-- Faturamento acumulado jan-set/2025:
EVALUATE ROW("resultado", CALCULATE([Faturamento Pocket], d_calendario[Ano] = 2025))`;

    // PASSO 1: Claude gera DAX
    const userMsg = messages[messages.length - 1].content;
    const daxResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300,
        messages: [{ role: 'user', content: CATALOGO + '\n\nPERGUNTA: "' + userMsg + '"\n\nGere UMA query DAX. Retorne APENAS a query, sem explicacao, sem markdown, sem backticks.' }] })
    });
    const daxJson = await daxResp.json();
    const daxQuery = daxJson.content && daxJson.content[0] ? daxJson.content[0].text.trim() : null;

    let resultadoPBI = '';

    // PASSO 2: Executa DAX no Power BI
    if (daxQuery && daxQuery.toUpperCase().startsWith('EVALUATE')) {
      try {
        const token = await getToken();
        const pbiResp = await fetch(pbiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ queries: [{ query: daxQuery }], serializerSettings: { includeNulls: true } })
        });
        const pbiJson = await pbiResp.json();
        if (pbiJson.results && pbiJson.results[0] && pbiJson.results[0].tables) {
          resultadoPBI = JSON.stringify(pbiJson.results[0].tables[0].rows || []).substring(0, 1000);
        } else {
          resultadoPBI = 'Erro: ' + JSON.stringify(pbiJson).substring(0, 200);
        }
      } catch(e) { resultadoPBI = 'Erro DAX: ' + e.message; }
    }

    // PASSO 3: Claude responde com dados reais
    const sys = 'Voce e assistente executivo da Quartzolit (Saint-Gobain Brasil). Responda em portugues.'
      + (pbiContext ? '\n\nCONTEXTO DO DASHBOARD:\n' + pbiContext : '')
      + (resultadoPBI ? '\n\nDADOS REAIS DO MODELO (resultado da query DAX):\n' + resultadoPBI
        + '\nOBS: Faturamento Pocket e Receita estao em REAIS (R$). Se o valor for negativo provavelmente ha um problema de contexto de filtro.' : '')
      + '\n\nREGRAS: Use os dados acima. Seja objetivo. **negrito** para numeros importantes. Se nao tiver dados suficientes, diga claramente.';

    const finalResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 600, system: sys, messages })
    });
    return res.status(200).json(await finalResp.json());

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

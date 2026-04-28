export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, system } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    // Busca token Azure AD para Power BI REST API
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${process.env.PBI_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: process.env.PBI_CLIENT_ID,
          client_secret: process.env.PBI_CLIENT_SECRET,
          scope: 'https://analysis.windows.net/powerbi/api/.default'
        })
      }
    );
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Executa queries DAX no modelo semantico
    const daxQueries = [
      // KPIs principais
      `EVALUATE ROW(
        "periodo_atual", CALCULATE(MAX(d_periodo_atual[Ano-Mes Label])),
        "periodo_ref", CALCULATE(MIN(d_periodo_ref[Ano-Mes Label])),
        "var_receita", CALCULATE([Variacao % Receita]),
        "var_volume", CALCULATE([Variacao % Volume]),
        "var_margem", CALCULATE([Variacao pp Margem]),
        "var_preco", CALCULATE([Variacao % Preco Sell IN]),
        "qtd_verdes", [Qtd Chaves Verdes],
        "qtd_amarelas", [Qtd Chaves Amarelas],
        "qtd_vermelhas", [Qtd Chaves Vermelhas]
      )`
    ];

    // Executa DAX via Power BI REST API
    const daxRes = await fetch(
      `https://api.powerbi.com/v1.0/myorg/groups/${process.env.PBI_WORKSPACE_ID}/datasets/${process.env.PBI_DATASET_ID}/executeQueries`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          queries: [{ query: daxQueries[0] }],
          serializerSettings: { includeNulls: true }
        })
      }
    );
    const daxData = await daxRes.json();

    // Extrai resultados
    let contexto = 'Sem dados do modelo disponiveis.';
    if (daxData.results && daxData.results[0] && daxData.results[0].tables) {
      const row = daxData.results[0].tables[0].rows[0];
      contexto = `Dados do modelo semantico Power BI em tempo real:
- Periodo atual: ${row['[periodo_atual]'] || 'N/D'}
- Periodo referencia: ${row['[periodo_ref]'] || 'N/D'}
- Variacao Receita: ${(row['[var_receita]'] * 100).toFixed(1)}%
- Variacao Volume: ${(row['[var_volume]'] * 100).toFixed(1)}%
- Variacao Margem: ${(row['[var_margem]']).toFixed(2)}pp
- Variacao Preco Sell IN: ${(row['[var_preco]'] * 100).toFixed(1)}%
- Chaves Verdes (saudaveis): ${row['[qtd_verdes]']}
- Chaves Amarelas (atencao): ${row['[qtd_amarelas]']}
- Chaves Vermelhas (criticas): ${row['[qtd_vermelhas]']}`;
    }

    // Busca top 5 criticos
    const daxCriticosRes = await fetch(
      `https://api.powerbi.com/v1.0/myorg/groups/${process.env.PBI_WORKSPACE_ID}/datasets/${process.env.PBI_DATASET_ID}/executeQueries`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          queries: [{
            query: `EVALUATE TOPN(5, FILTER(
              ADDCOLUMNS(
                ALL(f_faturamento[Agrupamento Nivel 1]),
                "@qtd", [Qtd Tipos Disparados],
                "@alerta", [Alerta Chave],
                "@c1", [Causa T1],
                "@c2", [Causa T2],
                "@c3", [Causa T3]
              ), [@qtd] > 0
            ), [@qtd], DESC)`
          }],
          serializerSettings: { includeNulls: true }
        })
      }
    );
    const criticosData = await daxCriticosRes.json();
    if (criticosData.results && criticosData.results[0] && criticosData.results[0].tables) {
      const rows = criticosData.results[0].tables[0].rows || [];
      if (rows.length > 0) {
        contexto += '\n\nTop familias com alertas:';
        rows.forEach(r => {
          contexto += `\n- ${r['f_faturamento[Agrupamento Nivel 1]']}: ${r['[@alerta]']} | Causa Preco: ${r['[@c1]'] || 'N/A'} | Causa Volume: ${r['[@c2]'] || 'N/A'} | Causa Rentab: ${r['[@c3]'] || 'N/A'}`;
        });
      }
    }

    // Monta system prompt com dados reais
    const systemComDados = (system || '') + '\n\n' + contexto + '\n\nREGRAS: Responda SEMPRE em portugues. Use SOMENTE os dados acima. NUNCA invente numeros. Se faltar dados diga claramente. Seja objetivo. Use **negrito** para numeros importantes.';

    // Chama Claude com contexto real
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: systemComDados,
        messages: messages
      })
    });
    const data = await claudeRes.json();
    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

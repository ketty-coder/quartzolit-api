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

    // Variaveis de ambiente (nomes conforme configurado no Vercel)
    const tenantId    = process.env.TENANT_ID;
    const clientId    = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    const workspaceId = process.env.WORKSPACE_ID;
    const datasetId   = process.env.DATASET_ID;

    // 1. Busca token Azure AD
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
          scope: 'https://analysis.windows.net/powerbi/api/.default'
        })
      }
    );
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      throw new Error('Falha ao obter token Azure: ' + JSON.stringify(tokenData));
    }
    const accessToken = tokenData.access_token;

    // 2. Executa DAX - KPIs principais
    const kpiRes = await fetch(
      `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/executeQueries`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          queries: [{
            query: `EVALUATE ROW(
              "atual", CALCULATE(MAX(d_periodo_atual[Ano-Mes Label])),
              "ref", CALCULATE(MIN(d_periodo_ref[Ano-Mes Label])),
              "var_rec", [Variacao % Receita],
              "var_vol", [Variacao % Volume],
              "var_mar", [Variacao pp Margem],
              "var_pre", [Variacao % Preco Sell IN],
              "verdes", [Qtd Chaves Verdes],
              "amarelas", [Qtd Chaves Amarelas],
              "vermelhas", [Qtd Chaves Vermelhas]
            )`
          }],
          serializerSettings: { includeNulls: true }
        })
      }
    );
    const kpiData = await kpiRes.json();

    // 3. Executa DAX - Familias criticas
    const criticosRes = await fetch(
      `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/executeQueries`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          queries: [{
            query: `EVALUATE TOPN(5,
              FILTER(
                ADDCOLUMNS(
                  ALL(f_faturamento[Agrupamento Nivel 1]),
                  "@qtd", [Qtd Tipos Disparados],
                  "@alerta", [Alerta Chave],
                  "@c1", [Causa T1],
                  "@c2", [Causa T2],
                  "@c3", [Causa T3]
                ),
                [@qtd] > 0
              ),
            [@qtd], DESC)`
          }],
          serializerSettings: { includeNulls: true }
        })
      }
    );
    const criticosData = await criticosRes.json();

    // 4. Monta contexto com dados reais
    let contexto = '';
    if (kpiData.results && kpiData.results[0] && kpiData.results[0].tables) {
      const r = kpiData.results[0].tables[0].rows[0];
      const pct = v => v != null ? (v * 100).toFixed(1) + '%' : 'N/D';
      const pp  = v => v != null ? v.toFixed(2) + 'pp' : 'N/D';
      contexto += `DADOS DO MODELO SEMANTICO POWER BI (TEMPO REAL):
Periodo Atual: ${r['[atual]'] || 'N/D'}
Periodo Referencia: ${r['[ref]'] || 'N/D'}
Variacao Receita: ${pct(r['[var_rec]'])}
Variacao Volume: ${pct(r['[var_vol]'])}
Variacao Margem: ${pp(r['[var_mar]'])}
Variacao Preco Sell IN: ${pct(r['[var_pre]'])}
Chaves Verdes (saudaveis): ${r['[verdes]']}
Chaves Amarelas (atencao): ${r['[amarelas]']}
Chaves Vermelhas (criticas): ${r['[vermelhas]']}`;
    }

    if (criticosData.results && criticosData.results[0] && criticosData.results[0].tables) {
      const rows = criticosData.results[0].tables[0].rows || [];
      if (rows.length > 0) {
        contexto += '\n\nFAMILIAS COM ALERTAS ATIVOS:';
        rows.forEach(r => {
          const fam = r['f_faturamento[Agrupamento Nivel 1]'] || '';
          const alerta = r['[@alerta]'] || '';
          const c1 = r['[@c1]'] || '';
          const c2 = r['[@c2]'] || '';
          const c3 = r['[@c3]'] || '';
          contexto += `\n- ${fam}: ${alerta}`;
          if (c1) contexto += ` | Causa Preco: ${c1}`;
          if (c2) contexto += ` | Causa Volume: ${c2}`;
          if (c3) contexto += ` | Causa Rentab: ${c3}`;
        });
      }
    }

    if (!contexto) contexto = 'Nao foi possivel carregar dados do modelo semantico.';

    // 5. Chama Claude com contexto real do modelo
    const sysFinal = `Voce e assistente de negocios da Quartzolit (Saint-Gobain Brasil).
${contexto}
REGRAS: 1) Responda SEMPRE em portugues. 2) Use SOMENTE os dados acima, NUNCA invente numeros. 3) Se faltar dados diga claramente. 4) Seja objetivo e executivo. 5) Use **negrito** para numeros importantes. 6) Score 0-100: verde=saudavel, vermelho=critico. 7) T1=Preco T2=Volume T3=Rentabilidade. 8) Deterioracao Sistemica=T1+T2+T3 juntos.`;

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
        system: sysFinal,
        messages: messages
      })
    });
    const data = await claudeRes.json();
    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

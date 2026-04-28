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

    const tenantId     = process.env.TENANT_ID;
    const clientId     = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    const workspaceId  = process.env.WORKSPACE_ID;
    const datasetId    = process.env.DATASET_ID;

    // 1. Token Azure AD
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
      console.log('TOKEN ERROR:', JSON.stringify(tokenData));
      throw new Error('Token falhou: ' + (tokenData.error_description || JSON.stringify(tokenData)));
    }
    console.log('TOKEN OK');
    const accessToken = tokenData.access_token;

    // 2. DAX KPIs
    const kpiRes = await fetch(
      `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/executeQueries`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({
          queries: [{ query: "EVALUATE ROW(\"atual\", CALCULATE(MAX(d_periodo_atual[Ano-Mes Label])), \"ref\", CALCULATE(MIN(d_periodo_ref[Ano-Mes Label])), \"var_rec\", [Variacao % Receita], \"var_vol\", [Variacao % Volume], \"var_mar\", [Variacao pp Margem], \"verdes\", [Qtd Chaves Verdes], \"amarelas\", [Qtd Chaves Amarelas], \"vermelhas\", [Qtd Chaves Vermelhas])" }],
          serializerSettings: { includeNulls: true }
        })
      }
    );
    const kpiData = await kpiRes.json();
    console.log('KPI STATUS:', kpiRes.status);
    console.log('KPI DATA:', JSON.stringify(kpiData).substring(0, 500));

    // 3. DAX Criticos
    const criticosRes = await fetch(
      `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/executeQueries`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({
          queries: [{ query: "EVALUATE TOPN(5, FILTER(ADDCOLUMNS(ALL(f_faturamento[Agrupamento Nivel 1]), \"@qtd\", [Qtd Tipos Disparados], \"@alerta\", [Alerta Chave], \"@c1\", [Causa T1], \"@c2\", [Causa T2], \"@c3\", [Causa T3]), [@qtd] > 0), [@qtd], DESC)" }],
          serializerSettings: { includeNulls: true }
        })
      }
    );
    const criticosData = await criticosRes.json();
    console.log('CRITICOS STATUS:', criticosRes.status);
    console.log('CRITICOS DATA:', JSON.stringify(criticosData).substring(0, 500));

    // 4. Monta contexto
    let contexto = '';
    if (kpiData.results && kpiData.results[0] && kpiData.results[0].tables && kpiData.results[0].tables[0].rows) {
      const r = kpiData.results[0].tables[0].rows[0];
      const pct = v => v != null ? (v * 100).toFixed(1) + '%' : 'N/D';
      const pp  = v => v != null ? v.toFixed(2) + 'pp' : 'N/D';
      contexto += `DADOS DO MODELO SEMANTICO POWER BI (TEMPO REAL):
Periodo Atual: ${r['[atual]'] || 'N/D'} | Referencia: ${r['[ref]'] || 'N/D'}
Variacao Receita: ${pct(r['[var_rec]'])} | Volume: ${pct(r['[var_vol]'])} | Margem: ${pp(r['[var_mar]'])}
Chaves Verdes: ${r['[verdes]']} | Amarelas: ${r['[amarelas]']} | Vermelhas: ${r['[vermelhas]']}`;
    } else {
      contexto = 'Nao foi possivel carregar dados do modelo. Erro: ' + JSON.stringify(kpiData).substring(0,200);
    }

    if (criticosData.results && criticosData.results[0] && criticosData.results[0].tables && criticosData.results[0].tables[0].rows) {
      const rows = criticosData.results[0].tables[0].rows || [];
      if (rows.length > 0) {
        contexto += '\nFAMILIAS COM ALERTAS:';
        rows.forEach(r => {
          contexto += `\n- ${r['f_faturamento[Agrupamento Nivel 1]']}: ${r['[@alerta]']}`;
          if(r['[@c1]']) contexto += ` | Preco: ${r['[@c1]']}`;
          if(r['[@c2]']) contexto += ` | Volume: ${r['[@c2]']}`;
          if(r['[@c3]']) contexto += ` | Rentab: ${r['[@c3]']}`;
        });
      }
    }

    const sysFinal = `Voce e assistente de negocios da Quartzolit (Saint-Gobain Brasil).
${contexto}
REGRAS: Responda em portugues. Use SOMENTE os dados acima. NUNCA invente numeros. Seja objetivo. **negrito** para numeros. T1=Preco T2=Volume T3=Rentabilidade.`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 800, system: sysFinal, messages: messages })
    });
    const data = await claudeRes.json();
    return res.status(200).json(data);

  } catch (error) {
    console.log('CATCH ERROR:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

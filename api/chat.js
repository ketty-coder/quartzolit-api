export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, system } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

    const tenantId = process.env.TENANT_ID;
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    const workspaceId = process.env.WORKSPACE_ID;
    const datasetId = process.env.DATASET_ID;

    // 1. Token Azure AD
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId,
          client_secret: clientSecret, scope: 'https://analysis.windows.net/powerbi/api/.default' }) }
    );
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('Token error: ' + JSON.stringify(tokenData));
    const bearer = `Bearer ${tokenData.access_token}`;
    const pbiUrl = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/executeQueries`;
    const pbiHeaders = { 'Content-Type': 'application/json', 'Authorization': bearer };
    const pbiOpts = (q) => ({ method: 'POST', headers: pbiHeaders,
      body: JSON.stringify({ queries: [{ query: q }], serializerSettings: { includeNulls: true } }) });

    // 2. KPIs principais - usando nomes com acentos corretos
    const kpiRes = await fetch(pbiUrl, pbiOpts(
      'EVALUATE ROW(' +
      '"atual", CALCULATE(MAX(d_periodo_atual[Ano-M\u00EAs Label])),' +
      '"ref", CALCULATE(MIN(d_periodo_ref[Ano-M\u00EAs Label])),' +
      '"var_rec", [Varia\u00E7\u00E3o % Receita],' +
      '"var_vol", [Varia\u00E7\u00E3o % Volume],' +
      '"var_mar", [Varia\u00E7\u00E3o pp Margem],' +
      '"var_pre", [Varia\u00E7\u00E3o % Pre\u00E7o Sell IN],' +
      '"verdes", [Qtd Chaves Verdes],' +
      '"amarelas", [Qtd Chaves Amarelas],' +
      '"vermelhas", [Qtd Chaves Vermelhas]' +
      ')'
    ));
    const kpiData = await kpiRes.json();

    // 3. Familias criticas
    const critRes = await fetch(pbiUrl, pbiOpts(
      'EVALUATE TOPN(5, FILTER(ADDCOLUMNS(ALL(f_faturamento[Agrupamento N\u00EDvel 1]),' +
      '"@qtd", [Qtd Tipos Disparados],' +
      '"@alerta", [Alerta Chave],' +
      '"@c1", [Causa T1],' +
      '"@c2", [Causa T2],' +
      '"@c3", [Causa T3]), [@qtd] > 0), [@qtd], DESC)'
    ));
    const critData = await critRes.json();

    // 4. Monta contexto com dados reais
    let contexto = 'Nao foi possivel carregar dados.';

    if (kpiData.results && kpiData.results[0] && kpiData.results[0].tables) {
      const r = kpiData.results[0].tables[0].rows[0];
      const pct = v => v != null ? (v * 100).toFixed(1) + '%' : 'N/D';
      const pp = v => v != null ? Number(v).toFixed(2) + 'pp' : 'N/D';
      contexto = 'DADOS DO MODELO SEMANTICO POWER BI (TEMPO REAL):\n'
        + 'Periodo Atual: ' + (r['[atual]'] || 'N/D') + '\n'
        + 'Periodo Referencia: ' + (r['[ref]'] || 'N/D') + '\n'
        + 'Variacao Receita: ' + pct(r['[var_rec]']) + '\n'
        + 'Variacao Volume: ' + pct(r['[var_vol]']) + '\n'
        + 'Variacao Margem: ' + pp(r['[var_mar]']) + '\n'
        + 'Variacao Preco Sell IN: ' + pct(r['[var_pre]']) + '\n'
        + 'Chaves Verdes (saudaveis): ' + r['[verdes]'] + '\n'
        + 'Chaves Amarelas (atencao): ' + r['[amarelas]'] + '\n'
        + 'Chaves Vermelhas (criticas): ' + r['[vermelhas]'];
    }

    if (critData.results && critData.results[0] && critData.results[0].tables) {
      const rows = critData.results[0].tables[0].rows || [];
      if (rows.length > 0) {
        contexto += '\n\nFAMILIAS COM ALERTAS ATIVOS:';
        rows.forEach(r => {
          const fam = r['f_faturamento[Agrupamento N\u00EDvel 1]'] || '';
          const alerta = r['[@alerta]'] || '';
          const c1 = r['[@c1]'] || '';
          const c2 = r['[@c2]'] || '';
          const c3 = r['[@c3]'] || '';
          contexto += '\n- ' + fam + ': ' + alerta;
          if (c1) contexto += ' | Causa Preco: ' + c1;
          if (c2) contexto += ' | Causa Volume: ' + c2;
          if (c3) contexto += ' | Causa Rentab: ' + c3;
        });
      }
    }

    // 5. Claude com contexto real
    const sysFinal = 'Voce e assistente executivo de negocios da Quartzolit (Saint-Gobain Brasil).\n'
      + contexto
      + '\nREGRAS: 1) Responda SEMPRE em portugues. 2) Use SOMENTE os dados acima. NUNCA invente numeros. '
      + '3) Se faltar dados diga. 4) Seja objetivo. Use **negrito** para numeros. '
      + '5) Score: verde=saudavel, vermelho=critico. 6) T1=Preco T2=Volume T3=Rentabilidade.';

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 800, system: sysFinal, messages: messages })
    });
    const data = await claudeRes.json();
    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

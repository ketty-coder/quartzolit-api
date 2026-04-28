export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, system } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

    // Variaveis Azure / Power BI
    const tenantId = process.env.TENANT_ID;
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    const workspaceId = process.env.WORKSPACE_ID;
    const datasetId = process.env.DATASET_ID;

    // Token Azure AD
    const tokenRes = await fetch(
      'https://login.microsoftonline.com/' + tenantId + '/oauth2/v2.0/token',
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
    if (!tokenData.access_token) throw new Error('Token error: ' + JSON.stringify(tokenData));

    const pbiUrl = 'https://api.powerbi.com/v1.0/myorg/groups/' + workspaceId + '/datasets/' + datasetId + '/executeQueries';
    const pbiHeaders = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tokenData.access_token };

    function dax(q) {
      return fetch(pbiUrl, {
        method: 'POST',
        headers: pbiHeaders,
        body: JSON.stringify({ queries: [{ query: q }], serializerSettings: { includeNulls: true } })
      }).then(function(r) { return r.json(); });
    }

    // Query KPIs - nomes das medidas com unicode escapado
    var q1 = 'EVALUATE ROW(' +
      '"atual", CALCULATE(MAX(d_periodo_atual[Ano-M\u00EAs Label])),' +
      '"ref", CALCULATE(MIN(d_periodo_ref[Ano-M\u00EAs Label])),' +
      '"rec", [Varia\u00E7\u00E3o % Receita],' +
      '"vol", [Varia\u00E7\u00E3o % Volume],' +
      '"mar", [Varia\u00E7\u00E3o pp Margem],' +
      '"pre", [Varia\u00E7\u00E3o % Pre\u00E7o Sell IN],' +
      '"vd", [Qtd Chaves Verdes],' +
      '"va", [Qtd Chaves Amarelas],' +
      '"vv", [Qtd Chaves Vermelhas]' +
      ')';

    // Query familias criticas
    var q2 = 'EVALUATE TOPN(5,FILTER(ADDCOLUMNS(ALL(f_faturamento[Agrupamento N\u00EDvel 1]),' +
      '"@qtd",[Qtd Tipos Disparados],' +
      '"@al",[Alerta Chave],' +
      '"@c1",[Causa T1],' +
      '"@c2",[Causa T2],' +
      '"@c3",[Causa T3]),[@qtd]>0),[@qtd],DESC)';

    const [kpi, crit] = await Promise.all([dax(q1), dax(q2)]);

    var contexto = '';

    if (kpi.results && kpi.results[0] && kpi.results[0].tables) {
      var r = kpi.results[0].tables[0].rows[0];
      function pct(v) { return v != null ? (v * 100).toFixed(1) + '%' : 'N/D'; }
      function pp(v) { return v != null ? Number(v).toFixed(2) + 'pp' : 'N/D'; }
      contexto = 'DADOS DO MODELO SEMANTICO POWER BI:\n' +
        'Periodo Atual: ' + (r['[atual]'] || 'N/D') + '\n' +
        'Periodo Ref: ' + (r['[ref]'] || 'N/D') + '\n' +
        'Variacao Receita: ' + pct(r['[rec]']) + '\n' +
        'Variacao Volume: ' + pct(r['[vol]']) + '\n' +
        'Variacao Margem: ' + pp(r['[mar]']) + '\n' +
        'Variacao Preco: ' + pct(r['[pre]']) + '\n' +
        'Verdes: ' + r['[vd]'] + ' | Amarelas: ' + r['[va]'] + ' | Vermelhas: ' + r['[vv]'];
    }

    if (crit.results && crit.results[0] && crit.results[0].tables) {
      var rows = crit.results[0].tables[0].rows || [];
      if (rows.length > 0) {
        contexto += '\nFAMILIAS COM ALERTAS:';
        rows.forEach(function(r) {
          contexto += '\n- ' + (r['f_faturamento[Agrupamento N\u00EDvel 1]'] || '') +
            ': ' + (r['[@al]'] || '') +
            (r['[@c1]'] ? ' | Preco: ' + r['[@c1]'] : '') +
            (r['[@c2]'] ? ' | Volume: ' + r['[@c2]'] : '') +
            (r['[@c3]'] ? ' | Rentab: ' + r['[@c3]'] : '');
        });
      }
    }

    if (!contexto) contexto = 'Dados do modelo nao disponíveis no momento.';

    var sys = 'Voce e assistente executivo da Quartzolit (Saint-Gobain Brasil).\n' +
      contexto +
      '\nREGRAS: Responda em portugues. Use SOMENTE dados acima. NUNCA invente. Se faltar dados diga. Seja objetivo. **negrito** para numeros. Verde=saudavel, Vermelho=critico. T1=Preco T2=Volume T3=Rentabilidade.';

    const cr = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 800, system: sys, messages: messages })
    });
    const data = await cr.json();
    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
  }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

    // Token Azure AD
    const tokenRes = await fetch(
      'https://login.microsoftonline.com/' + process.env.TENANT_ID + '/oauth2/v2.0/token',
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'client_credentials',
          client_id: process.env.CLIENT_ID, client_secret: process.env.CLIENT_SECRET,
          scope: 'https://analysis.windows.net/powerbi/api/.default' }) }
    );
    const tok = await tokenRes.json();
    if (!tok.access_token) throw new Error('Token: ' + JSON.stringify(tok));

    // Queries DAX em PARALELO (economiza tempo)
    const pbiUrl = 'https://api.powerbi.com/v1.0/myorg/groups/' + process.env.WORKSPACE_ID + '/datasets/' + process.env.DATASET_ID + '/executeQueries';
    const auth = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok.access_token };

    const dq = (q) => fetch(pbiUrl, { method: 'POST', headers: auth,
      body: JSON.stringify({ queries: [{ query: q }], serializerSettings: { includeNulls: true } }) })
      .then(r => r.json()).catch(() => null);

    const q1 = 'EVALUATE ROW("atual",CALCULATE(MAX(d_periodo_atual[Ano-M\u00EAs Label])),"ref",CALCULATE(MIN(d_periodo_ref[Ano-M\u00EAs Label])),"rec",[Varia\u00E7\u00E3o % Receita],"vol",[Varia\u00E7\u00E3o % Volume],"mar",[Varia\u00E7\u00E3o pp Margem],"pre",[Varia\u00E7\u00E3o % Pre\u00E7o Sell IN],"vd",[Qtd Chaves Verdes],"va",[Qtd Chaves Amarelas],"vv",[Qtd Chaves Vermelhas])';
    const q2 = 'EVALUATE TOPN(5,FILTER(ADDCOLUMNS(ALL(f_faturamento[Agrupamento N\u00EDvel 1]),"@q",[Qtd Tipos Disparados],"@a",[Alerta Chave],"@c1",[Causa T1],"@c2",[Causa T2],"@c3",[Causa T3]),[@q]>0),[@q],DESC)';

    const [kpi, crit] = await Promise.all([dq(q1), dq(q2)]);

    // Monta contexto
    var ctx = '';
    if (kpi && kpi.results && kpi.results[0] && kpi.results[0].tables) {
      var r = kpi.results[0].tables[0].rows[0];
      var pc = (v) => v != null ? (v*100).toFixed(1)+'%' : 'N/D';
      var pp = (v) => v != null ? Number(v).toFixed(2)+'pp' : 'N/D';
      ctx = 'DADOS PBI: Atual=' + (r['[atual]']||'N/D') + ' Ref=' + (r['[ref]']||'N/D') +
        ' Rec=' + pc(r['[rec]']) + ' Vol=' + pc(r['[vol]']) + ' Mar=' + pp(r['[mar]']) + ' Pre=' + pc(r['[pre]']) +
        ' Verdes=' + r['[vd]'] + ' Amarelas=' + r['[va]'] + ' Vermelhas=' + r['[vv]'];
    }
    if (crit && crit.results && crit.results[0] && crit.results[0].tables) {
      var rows = crit.results[0].tables[0].rows || [];
      rows.forEach(r => {
        ctx += ' | ' + (r['f_faturamento[Agrupamento N\u00EDvel 1]']||'') + ':' + (r['[@a]']||'') +
          (r['[@c1]'] ? ' P='+r['[@c1]'] : '') + (r['[@c2]'] ? ' V='+r['[@c2]'] : '') + (r['[@c3]'] ? ' R='+r['[@c3]'] : '');
      });
    }

    const sys = 'Assistente executivo Quartzolit (Saint-Gobain Brasil). ' + (ctx || 'Sem dados disponiveis.') +
      ' REGRAS: Portugues. Somente dados acima. Nunca invente. **negrito** numeros. Verde=ok Vermelho=critico T1=Preco T2=Volume T3=Rentab.';

    const cr = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 600, system: sys, messages: messages })
    });
    return res.status(200).json(await cr.json());

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
  }

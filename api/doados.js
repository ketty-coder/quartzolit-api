export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // Token Azure AD
    const tr = await fetch(
      'https://login.microsoftonline.com/' + process.env.TENANT_ID + '/oauth2/v2.0/token',
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'client_credentials',
          client_id: process.env.CLIENT_ID, client_secret: process.env.CLIENT_SECRET,
          scope: 'https://analysis.windows.net/powerbi/api/.default' }) }
    );
    const td = await tr.json();
    if (!td.access_token) return res.status(500).json({ error: 'Token: ' + JSON.stringify(td) });
    const auth = 'Bearer ' + td.access_token;
    const url = 'https://api.powerbi.com/v1.0/myorg/groups/' + process.env.WORKSPACE_ID + '/datasets/' + process.env.DATASET_ID + '/executeQueries';
    const hdr = { 'Content-Type': 'application/json', 'Authorization': auth };
    const run = (q) => fetch(url, { method: 'POST', headers: hdr,
      body: JSON.stringify({ queries: [{query:q}], serializerSettings: {includeNulls:true} }) }).then(r=>r.json());

    // Queries em paralelo
    const [k, c] = await Promise.all([
      run('EVALUATE ROW(' +
        '"atual",CALCULATE(MAX(d_periodo_atual[Ano-M\u00EAs Label])),' +
        '"ref",CALCULATE(MIN(d_periodo_ref[Ano-M\u00EAs Label])),' +
        '"rec",[Varia\u00E7\u00E3o % Receita],' +
        '"vol",[Varia\u00E7\u00E3o % Volume],' +
        '"mar",[Varia\u00E7\u00E3o pp Margem],' +
        '"pre",[Varia\u00E7\u00E3o % Pre\u00E7o Sell IN],' +
        '"vd",[Qtd Chaves Verdes],' +
        '"am",[Qtd Chaves Amarelas],' +
        '"vm",[Qtd Chaves Vermelhas])'),
      run('EVALUATE TOPN(5,FILTER(ADDCOLUMNS(ALL(f_faturamento[Agrupamento N\u00EDvel 1]),' +
        '"@q",[Qtd Tipos Disparados],"@a",[Alerta Chave],' +
        '"@c1",[Causa T1],"@c2",[Causa T2],"@c3",[Causa T3]),[@q]>0),[@q],DESC)')
    ]);

    const pct = v => v!=null ? (v*100).toFixed(1)+'%' : 'N/D';
    const pp  = v => v!=null ? Number(v).toFixed(2)+'pp' : 'N/D';
    let ctx = 'Sem dados.';

    if (k.results && k.results[0] && k.results[0].tables) {
      const r = k.results[0].tables[0].rows[0];
      ctx = 'DADOS POWER BI (TEMPO REAL):\n'
        + 'Periodo: '+r['[atual]']+' vs '+r['[ref]']+'\n'
        + 'Receita: '+pct(r['[rec]'])+' | Volume: '+pct(r['[vol]'])+' | Margem: '+pp(r['[mar]'])+' | Preco: '+pct(r['[pre]'])+'\n'
        + 'Score: '+r['[vd]']+' verdes, '+r['[am]']+' amarelas, '+r['[vm]']+' vermelhas';
    }

    if (c.results && c.results[0] && c.results[0].tables) {
      const rows = c.results[0].tables[0].rows || [];
      if (rows.length > 0) {
        ctx += '\nALERTAS:';
        rows.forEach(r => {
          ctx += '\n- '+(r['f_faturamento[Agrupamento N\u00EDvel 1]']||'')+': '+(r['[@a]']||'');
          if(r['[@c1]']) ctx += ' | '+r['[@c1]'];
          if(r['[@c2]']) ctx += ' | '+r['[@c2]'];
          if(r['[@c3]']) ctx += ' | '+r['[@c3]'];
        });
      }
    }

    return res.status(200).json({ context: ctx });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}

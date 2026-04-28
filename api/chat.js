// Cache em memoria (persiste entre chamadas na mesma instancia)
let pbiCache = null;
let pbiCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

async function getPbiToken() {
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

async function runDax(token, query) {
  const r = await fetch(
    'https://api.powerbi.com/v1.0/myorg/groups/' + process.env.WORKSPACE_ID +
    '/datasets/' + process.env.DATASET_ID + '/executeQueries',
    { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ queries: [{ query }], serializerSettings: { includeNulls: true } }) }
  );
  return r.json();
}

async function loadPbiData() {
  // Retorna do cache se ainda valido
  if (pbiCache && Date.now() - pbiCacheTime < CACHE_TTL) return pbiCache;

  const token = await getPbiToken();

  // Queries em paralelo
  const [kpiData, critData] = await Promise.all([
    runDax(token, 'EVALUATE ROW(' +
      '"atual", CALCULATE(MAX(d_periodo_atual[Ano-M\u00EAs Label])),' +
      '"ref", CALCULATE(MIN(d_periodo_ref[Ano-M\u00EAs Label])),' +
      '"var_rec", [Varia\u00E7\u00E3o % Receita],' +
      '"var_vol", [Varia\u00E7\u00E3o % Volume],' +
      '"var_mar", [Varia\u00E7\u00E3o pp Margem],' +
      '"var_pre", [Varia\u00E7\u00E3o % Pre\u00E7o Sell IN],' +
      '"verdes", [Qtd Chaves Verdes],' +
      '"amarelas", [Qtd Chaves Amarelas],' +
      '"vermelhas", [Qtd Chaves Vermelhas])'),
    runDax(token, 'EVALUATE TOPN(5, FILTER(ADDCOLUMNS(' +
      'ALL(f_faturamento[Agrupamento N\u00EDvel 1]),' +
      '"@qtd", [Qtd Tipos Disparados],' +
      '"@alerta", [Alerta Chave],' +
      '"@c1", [Causa T1],"@c2", [Causa T2],"@c3", [Causa T3]),' +
      '[@qtd] > 0), [@qtd], DESC)')
  ]);

  const pct = v => v != null ? (v * 100).toFixed(1) + '%' : 'N/D';
  const pp  = v => v != null ? Number(v).toFixed(2) + 'pp' : 'N/D';
  let ctx = '';

  if (kpiData.results && kpiData.results[0] && kpiData.results[0].tables) {
    const r = kpiData.results[0].tables[0].rows[0];
    ctx = 'DADOS DO MODELO POWER BI:\n'
      + 'Periodo: ' + (r['[atual]'] || 'N/D') + ' vs ' + (r['[ref]'] || 'N/D') + '\n'
      + 'Variacoes: Receita=' + pct(r['[var_rec]']) + ' Volume=' + pct(r['[var_vol]'])
      + ' Margem=' + pp(r['[var_mar]']) + ' Preco=' + pct(r['[var_pre]']) + '\n'
      + 'Score: ' + r['[verdes]'] + ' verdes, ' + r['[amarelas]'] + ' amarelas, ' + r['[vermelhas]'] + ' vermelhas';
  }

  if (critData.results && critData.results[0] && critData.results[0].tables) {
    const rows = critData.results[0].tables[0].rows || [];
    if (rows.length > 0) {
      ctx += '\nFAMILIAS COM ALERTA:';
      rows.forEach(r => {
        const fam = r['f_faturamento[Agrupamento N\u00EDvel 1]'] || '';
        ctx += '\n- ' + fam + ': ' + (r['[@alerta]'] || '');
        if (r['[@c1]']) ctx += ' | Preco: ' + r['[@c1]'];
        if (r['[@c2]']) ctx += ' | Volume: ' + r['[@c2]'];
        if (r['[@c3]']) ctx += ' | Rentab: ' + r['[@c3]'];
      });
    }
  }

  // Salva cache
  pbiCache = ctx || 'Sem dados disponiveis.';
  pbiCacheTime = Date.now();
  return pbiCache;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // GET /api/chat?warmup=1 - pre-aquece o cache (chamado pelo index.html no load)
  if (req.method === 'GET') {
    try { await loadPbiData(); return res.status(200).json({ ok: true, cached: true }); }
    catch (e) { return res.status(200).json({ ok: false, error: e.message }); }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

    // Busca contexto (do cache se disponivel, senao carrega rapido)
    let ctx;
    try { ctx = await loadPbiData(); }
    catch (e) { ctx = 'Erro ao carregar dados do Power BI: ' + e.message; }

    const sys = 'Voce e assistente executivo da Quartzolit (Saint-Gobain Brasil).\n'
      + ctx + '\n'
      + 'REGRAS: Portugues. Somente dados acima. Nunca invente. Objetivo. **negrito** numeros. Score verde=saudavel vermelho=critico.';

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 600, system: sys, messages })
    });
    const data = await claudeRes.json();
    return res.status(200).json(data);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

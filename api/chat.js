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

    // Token Azure
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId,
          client_secret: clientSecret, scope: 'https://analysis.windows.net/powerbi/api/.default' }) }
    );
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('Token error: ' + JSON.stringify(tokenData));
    const accessToken = tokenData.access_token;

    // Query DAX simples para testar
    const daxRes = await fetch(
      `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/executeQueries`,
      { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ queries: [{ query: 'EVALUATE ROW("teste", 1)' }], serializerSettings: { includeNulls: true } }) }
    );
    const daxData = await daxRes.json();

    // Retorna debug completo
    let contexto = 'DEBUG DAX RESPONSE: ' + JSON.stringify(daxData).substring(0, 500);

    if (daxData.results && daxData.results[0] && daxData.results[0].tables) {
      // Testa query real
      const daxRes2 = await fetch(
        `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/executeQueries`,
        { method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
          body: JSON.stringify({ queries: [{ query: 'EVALUATE ROW("verdes", [Qtd Chaves Verdes], "vermelhas", [Qtd Chaves Vermelhas])' }], serializerSettings: { includeNulls: true } }) }
      );
      const daxData2 = await daxRes2.json();
      contexto += ' | KPI RESPONSE: ' + JSON.stringify(daxData2).substring(0, 500);
    }

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 500,
        system: 'Mostra o debug exatamente como recebeu: ' + contexto, messages: messages })
    });
    const data = await claudeRes.json();
    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
                  }

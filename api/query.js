export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { dax } = req.body;
    if (!dax) return res.status(400).json({ error: 'dax required' });

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

    // Executa DAX
    const dr = await fetch(
      'https://api.powerbi.com/v1.0/myorg/groups/' + process.env.WORKSPACE_ID +
      '/datasets/' + process.env.DATASET_ID + '/executeQueries',
      { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + td.access_token },
        body: JSON.stringify({ queries: [{ query: dax }], serializerSettings: { includeNulls: true } }) }
    );
    const dd = await dr.json();
    return res.status(200).json(dd);

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, pbiContext } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

    // Usa contexto do PBI passado pelo frontend (ja buscado previamente)
    const ctx = pbiContext || 'Dados do modelo Power BI nao disponíveis no momento.';

    const sys = 'Voce e assistente executivo da Quartzolit (Saint-Gobain Brasil).\n'
      + ctx + '\n'
      + 'REGRAS: Portugues. Somente dados acima. Nunca invente. Objetivo. **negrito** numeros. Score verde=saudavel vermelho=critico. T1=Preco T2=Volume T3=Rentabilidade.';

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 600, system: sys, messages })
    });
    const data = await r.json();
    return res.status(200).json(data);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

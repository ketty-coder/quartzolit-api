export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, pbiContext, action, question, schema } = req.body;

    // MODO 1: Gerar DAX a partir de pergunta em linguagem natural
    if (action === 'gerar_dax') {
      if (!question) return res.status(400).json({ error: 'question required' });
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          system: 'Voce e especialista em DAX para Power BI. ' +
            'Dado o schema: ' + (schema || '') + ' ' +
            'Gere APENAS a query DAX para responder a pergunta. ' +
            'Retorne SOMENTE o DAX puro, sem explicacoes, sem markdown, sem backticks. ' +
            'Use EVALUATE obrigatoriamente. Para filtrar mes use d_calendario[Ano-Mes Label]="mes/ano".',
          messages: [{ role: 'user', content: question }]
        })
      });
      const d = await r.json();
      const dax = d.content && d.content[0] ? d.content[0].text.trim() : '';
      return res.status(200).json({ dax: dax });
    }

    // MODO 2: Responder com contexto
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

    const ctx = pbiContext || '';
    const sys = 'Voce e assistente executivo da Quartzolit (Saint-Gobain Brasil). ' +
      'Tem acesso ao modelo semantico Power BI com dados desde jan/2025. ' +
      (ctx ? ctx + '\n\n' : '') +
      'REGRAS: 1) Responda em portugues. ' +
      '2) O slicer do dashboard mostra apenas uma selecao - nao e restricao de dados. ' +
      '3) Se recebeu DADOS REAIS, use-os exatamente. ' +
      '4) NUNCA diga que nao tem dados sem ter consultado. ' +
      '5) Use **negrito** para numeros. Formato: R$ para valores, % para percentuais.';

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 800, system: sys, messages: messages })
    });
    const data = await r.json();
    return res.status(200).json(data);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
      }

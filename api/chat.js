export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, pbiContext } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

    const lastMsg = messages[messages.length - 1].content || '';

    // Detecta se e pergunta sobre dados historicos/especificos do modelo
    const isDataQuery = /faturamento|receita|volume|margem|custo|preco|janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|2025|2026|mes|ano|total|quanto|historico|periodo|filial|estado|uf|familia|categoria/i.test(lastMsg);

    let queryResult = null;

    if (isDataQuery) {
      // Chama /api/query para buscar dados reais do modelo semantico
      try {
        const host = req.headers.host || 'quartzolit-api-6a8h.vercel.app';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const queryRes = await fetch(protocol + '://' + host + '/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: lastMsg })
        });
        const queryData = await queryRes.json();
        if (queryData.result && queryData.result.results && queryData.result.results[0] && queryData.result.results[0].tables) {
          const rows = queryData.result.results[0].tables[0].rows || [];
          if (rows.length > 0) {
            queryResult = 'DADOS REAIS DO MODELO (query DAX executada):' +
              '\nQuery: ' + (queryData.dax || '').substring(0, 200) +
              '\nResultado: ' + JSON.stringify(rows).substring(0, 1000);
          }
        }
      } catch(qe) {
        // Se query falhou, continua sem dados especificos
      }
    }

    // Monta contexto final
    const ctx = [
      pbiContext || '',
      queryResult || ''
    ].filter(Boolean).join('\n\n');

    const sys = 'Voce e assistente executivo da Quartzolit (Saint-Gobain Brasil). ' +
      (ctx ? ctx + '\n\n' : '') +
      'REGRAS: Responda em portugues. Use SOMENTE os dados fornecidos. NUNCA invente numeros. ' +
      'Se faltar dados diga claramente. Seja objetivo. Use **negrito** para numeros. ' +
      'Formatos: R$ para valores monetarios, % para percentuais. ' +
      'Score: verde=saudavel, vermelho=critico. T1=Preco T2=Volume T3=Rentabilidade.';

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        system: sys,
        messages: messages
      })
    });
    const data = await r.json();
    return res.status(200).json(data);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
        }

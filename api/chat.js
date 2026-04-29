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

    // Detecta perguntas que precisam consultar dados do modelo semantico
    const needsQuery = /faturamento|receita|volume|margem|custo|preco|sell.?in|price.?index|desconto|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|2024|2025|2026|mes|ano|total|quanto|historico|familia|categoria|filial|estado|uf|crescimento|queda|evolucao|ranking|top|maior|menor|melhor|pior/i.test(lastMsg);

    let queryResult = '';

    if (needsQuery) {
      try {
        const host = req.headers.host || 'quartzolit-api-6a8h.vercel.app';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const qRes = await fetch(protocol + '://' + host + '/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: lastMsg })
        });
        const qData = await qRes.json();
        if (qData.result && qData.result.results && qData.result.results[0] && qData.result.results[0].tables) {
          const rows = qData.result.results[0].tables[0].rows || [];
          if (rows.length > 0) {
            queryResult = 'RESULTADO DA CONSULTA AO MODELO SEMANTICO:\n'
              + 'Query executada: ' + (qData.dax || '').substring(0, 300) + '\n'
              + 'Dados: ' + JSON.stringify(rows).substring(0, 1500);
          } else {
            queryResult = 'Consulta executada mas nao retornou dados. Query: ' + (qData.dax || '');
          }
        } else if (qData.error) {
          queryResult = 'Erro na consulta: ' + qData.error;
        }
      } catch(qe) {
        queryResult = 'Erro ao consultar modelo: ' + qe.message;
      }
    }

    // Sistema prompt com contexto correto
    const slicer = pbiContext
      ? 'FILTRO ATUAL DOS SLICERS DO DASHBOARD:\n' + pbiContext + '\n' +
        'IMPORTANTE: Este filtro mostra apenas o PERIODO SELECIONADO no dashboard. ' +
        'O modelo semantico contem dados completos desde jan/2025 independente deste filtro.'
      : '';

    const queryCtx = queryResult
      ? '\n\n' + queryResult
      : '';

    const sys = 'Voce e assistente executivo de dados da Quartzolit (Saint-Gobain Brasil). ' +
      'Tem acesso completo ao modelo semantico Power BI com dados desde jan/2025. ' +
      (slicer ? slicer + queryCtx : queryCtx.trim()) +
      '\n\nREGRAS CRITICAS: ' +
      '1) Responda SEMPRE em portugues. ' +
      '2) O periodo mostrado no dashboard (ex: set/2025 vs abr/2025) e apenas o FILTRO ATUAL - NAO e o limite dos dados. ' +
      '3) Para perguntas sobre outros periodos ou dados historicos, use os RESULTADOS DA CONSULTA acima. ' +
      '4) Se a consulta retornou dados, use EXATAMENTE esses numeros. ' +
      '5) NUNCA diga que nao tem dados de um periodo sem tentar consultar primeiro. ' +
      '6) Use **negrito** para numeros importantes. ' +
      '7) Formatos: R$ para valores, % para percentuais. ' +
      '8) Score: verde=saudavel, vermelho=critico.';

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

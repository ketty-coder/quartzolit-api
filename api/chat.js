const SCHEMA = `MODELO SEMANTICO QUARTZOLIT - dados jan/2025 em diante.

COLUNAS d_calendario:
- d_calendario[Ano] INTEGER ex: 2025
- d_calendario[Mes Numero] INTEGER 1=jan, 2=fev... 12=dez
- d_calendario[Mes Nome] STRING ex: "Janeiro"
- d_calendario[Mes Abrev] STRING ex: "jan"
- d_calendario[Ano-Mes] STRING ex: "2025-01"

COLUNAS f_faturamento:
- f_faturamento[Agrupamento Nivel 1] STRING - familia
- f_faturamento[UF] STRING

MEDIDAS: [Faturamento Pocket], [Receita], [Volume], [Margem], [Preco Sell IN]

REGRAS DAX CRITICAS:
1. SEMPRE use EVALUATE
2. Para filtrar por ano: use FILTER(ALL(d_calendario), d_calendario[Ano]=2025) dentro de CALCULATETABLE
3. Para filtrar por mes: d_calendario[Mes Numero]=1 (janeiro)
4. SUMMARIZECOLUMNS aceita apenas: coluna, coluna, "nome", medida - NAO aceita filtros inline
5. Para filtrar em SUMMARIZECOLUMNS, use CALCULATETABLE ao redor

EXEMPLOS CORRETOS:
Pergunta: "faturamento por mes em 2025"
DAX: EVALUATE CALCULATETABLE(SUMMARIZECOLUMNS(d_calendario[Ano-Mes],d_calendario[Mes Nome],"Fat",[Faturamento Pocket]),FILTER(ALL(d_calendario),d_calendario[Ano]=2025))

Pergunta: "faturamento total de janeiro 2025"
DAX: EVALUATE CALCULATETABLE(ROW("Fat",[Faturamento Pocket]),d_calendario[Ano]=2025,d_calendario[Mes Numero]=1)

Pergunta: "top 5 familias por faturamento"
DAX: EVALUATE TOPN(5,SUMMARIZECOLUMNS(f_faturamento[Agrupamento Nivel 1],"Fat",[Faturamento Pocket]),[Fat],DESC)

Pergunta: "faturamento total 2025"
DAX: EVALUATE CALCULATETABLE(ROW("Fat",[Faturamento Pocket]),FILTER(ALL(d_calendario),d_calendario[Ano]=2025))`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, pbiContext, action, question } = req.body;

    if (action === 'gerar_dax') {
      if (!question) return res.status(400).json({ error: 'question required' });
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          system: SCHEMA + '\n\nRetorne SOMENTE o DAX puro sem espacos extras, sem markdown, sem backticks, sem explicacao.',
          messages: [{ role: 'user', content: question }]
        })
      });
      const d = await r.json();
      const dax = d.content && d.content[0] ? d.content[0].text.trim() : '';
      return res.status(200).json({ dax });
    }

    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

    const ctx = pbiContext || '';
    const sys = 'Voce e assistente executivo da Quartzolit (Saint-Gobain Brasil). '
      + 'Acesso ao modelo semantico Power BI com dados desde jan/2025. '
      + (ctx ? ctx + '\n\n' : '')
      + 'REGRAS: Portugues. Slicer = selecao atual nao restricao. '
      + 'Se recebeu DADOS REAIS use exatamente. NUNCA diga que nao tem dados. '
      + '**negrito** para numeros. R$ para valores. % para percentuais.';

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 800, system: sys, messages })
    });
    const data = await r.json();
    return res.status(200).json(data);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
          }

const SCHEMA = `MODELO SEMANTICO QUARTZOLIT - dados desde jan/2025.

COLUNAS EXATAS d_calendario (COPIAR EXATAMENTE):
- d_calendario[Ano] - inteiro ex: 2025
- d_calendario[Ano-M\u00EAs] - string ex: "2025-01", "2025-09"
- d_calendario[M\u00EAs N\u00FAmero] - inteiro 1=jan, 12=dez
- d_calendario[M\u00EAs Nome] - string ex: "Janeiro"
- d_calendario[M\u00EAs Abrev] - string ex: "jan"
- d_calendario[Trimestre] - string ex: "T1"
- d_calendario[Date] - data

COLUNAS f_faturamento:
- f_faturamento[Agrupamento N\u00EDvel 1] - familia
- f_faturamento[UF] - estado

MEDIDAS: [Faturamento Pocket], [Receita], [Volume], [Margem], [Pre\u00E7o Sell IN]

EXEMPLOS DAX CORRETOS (use estes como referencia):
Q: faturamento por mes em 2025
A: EVALUATE CALCULATETABLE(SUMMARIZECOLUMNS(d_calendario[Ano-M\u00EAs],d_calendario[M\u00EAs Nome],"Fat",[Faturamento Pocket]),FILTER(ALL(d_calendario),d_calendario[Ano]=2025))

Q: faturamento total em janeiro 2025
A: EVALUATE CALCULATETABLE(ROW("Fat",[Faturamento Pocket]),d_calendario[Ano]=2025,d_calendario[M\u00EAs N\u00FAmero]=1)

Q: top 5 familias por faturamento
A: EVALUATE TOPN(5,SUMMARIZECOLUMNS(f_faturamento[Agrupamento N\u00EDvel 1],"Fat",[Faturamento Pocket]),[Fat],DESC)

Q: faturamento total 2025
A: EVALUATE CALCULATETABLE(ROW("Fat",[Faturamento Pocket]),FILTER(ALL(d_calendario),d_calendario[Ano]=2025))

Q: faturamento por UF
A: EVALUATE SUMMARIZECOLUMNS(f_faturamento[UF],"Fat",[Faturamento Pocket])

REGRAS: EVALUATE obrigatorio. Para filtrar use d_calendario[Ano]=2025 (inteiro). Para agrupar por mes use d_calendario[Ano-M\u00EAs]. SUMMARIZECOLUMNS nao aceita filtros inline - use CALCULATETABLE ao redor.`;

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
          system: SCHEMA + '\n\nRetorne SOMENTE o DAX puro. Sem explicacoes. Sem markdown. Sem backticks.',
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
      + 'Acesso completo ao modelo semantico Power BI desde jan/2025. '
      + (ctx ? ctx + '\n\n' : '')
      + 'REGRAS: Portugues. Slicer = selecao atual nao restricao. '
      + 'Se recebeu DADOS REAIS use exatamente esses numeros. NUNCA diga que nao tem dados. '
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

const SCHEMA = `MODELO SEMANTICO QUARTZOLIT (Saint-Gobain Brasil) - dados desde jan/2025.

COLUNAS d_calendario (tabela de datas):
- d_calendario[Date] - data completa
- d_calendario[Ano] - ano inteiro ex: 2025
- d_calendario[Mes Numero] - mes inteiro 1-12
- d_calendario[Mes Nome] - nome do mes ex: "Janeiro"
- d_calendario[Mes Abrev] - abreviacao ex: "jan"
- d_calendario[Ano-Mes] - string ex: "2025-01", "2025-09"
- d_calendario[Trimestre] - ex: "T1", "T2"

COLUNAS f_faturamento (tabela fato):
- f_faturamento[Agrupamento Nivel 1] - familia de produto
- f_faturamento[Agrupamento Nivel 2] - categoria
- f_faturamento[UF] - estado
- f_faturamento[Cod Filial]

MEDIDAS (use entre colchetes):
- [Faturamento Pocket] - faturamento liquido total R$
- [Receita] - receita ajustada
- [Volume] - volume de vendas
- [Preco Sell IN] - preco medio
- [Margem] - margem percentual
- [Custo Medio] - custo medio

EXEMPLOS DAX CORRETOS:
- Faturamento por mes:
  EVALUATE SUMMARIZECOLUMNS(d_calendario[Ano-Mes], d_calendario[Mes Nome], "Faturamento", [Faturamento Pocket])

- Faturamento total 2025:
  EVALUATE CALCULATETABLE(ROW("Faturamento Total", [Faturamento Pocket]), d_calendario[Ano]=2025)

- Faturamento jan/2025:
  EVALUATE CALCULATETABLE(ROW("Faturamento", [Faturamento Pocket]), d_calendario[Ano]=2025, d_calendario[Mes Numero]=1)

- Por familia:
  EVALUATE SUMMARIZECOLUMNS(f_faturamento[Agrupamento Nivel 1], "Faturamento", [Faturamento Pocket], "Receita", [Receita])

- Top 5 familias:
  EVALUATE TOPN(5, SUMMARIZECOLUMNS(f_faturamento[Agrupamento Nivel 1], "Fat", [Faturamento Pocket]), [Fat], DESC)

REGRAS DAX:
1. Sempre comece com EVALUATE
2. Use d_calendario[Ano] (inteiro) para filtrar ano, nao string
3. Use d_calendario[Mes Numero] (inteiro 1-12) para filtrar mes
4. Para agrupar por mes use d_calendario[Ano-Mes] que tem formato "2025-01"
5. NUNCA use colunas que nao existem acima`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, pbiContext, action, question } = req.body;

    // MODO 1: Gerar DAX
    if (action === 'gerar_dax') {
      if (!question) return res.status(400).json({ error: 'question required' });
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          system: 'Voce e especialista em DAX Power BI. Use o schema abaixo para gerar DAX correto.\n' + SCHEMA + '\nRetorne APENAS o DAX puro, sem explicacoes, sem markdown, sem backticks.',
          messages: [{ role: 'user', content: question }]
        })
      });
      const d = await r.json();
      const dax = d.content && d.content[0] ? d.content[0].text.trim() : '';
      return res.status(200).json({ dax });
    }

    // MODO 2: Responder ao usuario
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

    const ctx = pbiContext || '';
    const sys = 'Voce e assistente executivo da Quartzolit (Saint-Gobain Brasil).\n'
      + 'Tem acesso ao modelo semantico Power BI com dados desde jan/2025.\n'
      + (ctx ? ctx + '\n\n' : '')
      + 'REGRAS: 1) Portugues. 2) Slicer do dashboard = selecao atual, nao restricao de dados. '
      + '3) Se recebeu DADOS REAIS, use exatamente esses numeros. '
      + '4) NUNCA diga que nao tem dados sem ter consultado. '
      + '5) **negrito** para numeros. R$ para valores, % para percentuais.';

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

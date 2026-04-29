const SCHEMA = `MODELO SEMANTICO QUARTZOLIT - dados desde jan/2025.

COLUNAS EXATAS d_calendario:
- d_calendario[Ano] INTEGER ex: 2025
- d_calendario[Mes Numero] INTEGER 1=jan...12=dez
- d_calendario[Mes Nome] STRING ex: "Janeiro"
- d_calendario[Ano-Mes] STRING ex: "2025-01"

COLUNAS f_faturamento:
- f_faturamento[Agrupamento Nivel 1] STRING - familia de produto

DIMENSOES PARA FILTRAR:
- d_uf[UF] STRING - estado ex: "SP", "RJ", "MG" (sigla 2 letras MAIUSCULAS)
- d_filial[Filial] STRING - nome da filial

MEDIDAS: [Faturamento Pocket], [Receita], [Volume], [Margem], [Preco Sell IN]

EXEMPLOS DAX CORRETOS:
Q: faturamento por mes em 2025
A: EVALUATE CALCULATETABLE(SUMMARIZECOLUMNS(d_calendario[Ano-Mes],d_calendario[Mes Nome],"Fat",[Faturamento Pocket]),FILTER(ALL(d_calendario),d_calendario[Ano]=2025))

Q: faturamento em sao paulo
A: EVALUATE CALCULATETABLE(ROW("Fat",[Faturamento Pocket]),d_uf[UF]="SP")

Q: faturamento SP por mes em 2025
A: EVALUATE CALCULATETABLE(SUMMARIZECOLUMNS(d_calendario[Ano-Mes],d_calendario[Mes Nome],"Fat",[Faturamento Pocket]),d_uf[UF]="SP",FILTER(ALL(d_calendario),d_calendario[Ano]=2025))

Q: faturamento total em janeiro 2025
A: EVALUATE CALCULATETABLE(ROW("Fat",[Faturamento Pocket]),d_calendario[Ano]=2025,d_calendario[Mes Numero]=1)

Q: top 5 familias por faturamento
A: EVALUATE TOPN(5,SUMMARIZECOLUMNS(f_faturamento[Agrupamento Nivel 1],"Fat",[Faturamento Pocket]),[Fat],DESC)

Q: faturamento total 2025
A: EVALUATE CALCULATETABLE(ROW("Fat",[Faturamento Pocket]),FILTER(ALL(d_calendario),d_calendario[Ano]=2025))

Q: faturamento por UF
A: EVALUATE SUMMARIZECOLUMNS(d_uf[UF],"Fat",[Faturamento Pocket])

Q: receita por familia em SP
A: EVALUATE CALCULATETABLE(SUMMARIZECOLUMNS(f_faturamento[Agrupamento Nivel 1],"Rec",[Receita]),d_uf[UF]="SP")

REGRAS: EVALUATE obrigatorio. Para filtrar UF use d_uf[UF]="XX" (sigla maiuscula). Para filtrar ano use d_calendario[Ano]=2025 (inteiro). SUMMARIZECOLUMNS nao aceita filtros inline - use CALCULATETABLE ao redor.`;

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
          system: SCHEMA + '\n\nIMPORTANTE: Para estados brasileiros como "Sao Paulo", "Minas Gerais", etc, converta para a sigla: SP, MG, RJ, RS, PR, SC, BA, GO, DF, ES, PE, CE, PA, MT, MS, MA, PB, RN, AL, PI, SE, AM, RO, AC, AP, RR, TO. Retorne SOMENTE o DAX puro sem espacos extras, sem markdown, sem backticks.',
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

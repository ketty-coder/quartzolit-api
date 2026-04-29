export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, pbiContext, daxResult } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

    // Schema do modelo para o Claude saber o que pode consultar
    const schema = `SCHEMA DO MODELO SEMANTICO QUARTZOLIT:
Tabelas: f_faturamento, d_calendario, d_uf, d_material, d_filial, d_periodo_atual, d_periodo_ref
Calendario: d_calendario[Ano-Mes] (formato 2025-01), d_calendario[Ano], d_calendario[Mes Numero], d_calendario[Mes Nome], d_calendario[Trimestre]
Medidas disponiveis:
- [Faturamento Pocket] - receita liquida total
- [Variacao % Receita] - variacao vs periodo referencia
- [Variacao % Volume] - variacao de volume
- [Variacao pp Margem] - variacao de margem em pp
- [Variacao % Preco Sell IN] - variacao de preco
- [Qtd Chaves Verdes], [Qtd Chaves Amarelas], [Qtd Chaves Vermelhas]
- [Alerta Chave], [Causa T1], [Causa T2], [Causa T3]
- [Qtd Tipos Disparados]
Dimensoes: f_faturamento[Agrupamento Nivel 1] (familia produto), d_uf[UF], d_filial[Filial]
Para filtrar por mes use: FILTER(ALL(d_calendario), d_calendario[Ano-Mes] = "2025-01")
Para filtrar por ano use: FILTER(ALL(d_calendario), d_calendario[Ano] = 2025)`;

    // Contexto do periodo atual (passado pelo Power BI via URL)
    const ctx = pbiContext || 'Dados do periodo atual disponiveis no modelo.';

    // Resultado de DAX executado (se houver - segunda etapa)
    const daxCtx = daxResult ? 'RESULTADO DA CONSULTA AO MODELO SEMANTICO:\n' + daxResult : '';

    const sys = `Voce e assistente executivo da Quartzolit (Saint-Gobain Brasil) com acesso ao modelo semantico Power BI.
${schema}
${ctx}
${daxCtx}
INSTRUCOES:
1. Responda SEMPRE em portugues.
2. Se o usuario perguntar dados historicos (faturamento por mes, por ano, etc.), responda com a DAX necessaria no formato JSON exato:
{"needs_dax": true, "dax": "EVALUATE TOPN(12, SUMMARIZECOLUMNS(d_calendario[Ano-Mes], \"Faturamento\", [Faturamento Pocket]), d_calendario[Ano-Mes], ASC)", "explanation": "Buscando faturamento mensal..."}
3. Se ja tiver o resultado DAX (daxResult disponivel), interprete e responda em linguagem natural com os numeros.
4. Se a pergunta nao precisar de DAX (usa contexto atual), responda diretamente.
5. Seja objetivo. Use **negrito** para numeros importantes.
6. Valores de Faturamento Pocket sao negativos no modelo (representam custos debitados). Use valor absoluto.`;

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

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}

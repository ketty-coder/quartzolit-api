export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: "question is required" });
    }

    // 1. Gerar DAX com Claude
    const daxResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 800,
        system: `
Você é especialista em Power BI e DAX.
Gere APENAS uma consulta DAX válida para ExecuteQueries.
Não explique. Não use markdown.

Modelo disponível:
Tabela: dCategorias
Colunas: dCategorias[Categoria]

Medidas disponíveis:
[Valor Financeiro Dinamico]
[Baseline]
[Forecast]
[Incorrido]

Regras:
- Sempre use EVALUATE.
- Use SUMMARIZECOLUMNS para agregações.
- Limite resultados com TOPN quando fizer sentido.
- Nunca invente tabela ou coluna.
        `,
        messages: [
          {
            role: "user",
            content: question
          }
        ]
      })
    });

    const daxData = await daxResponse.json();
    const daxQuery = daxData?.content?.[0]?.text;

    if (!daxQuery) {
      return res.status(500).json({ error: "Não foi possível gerar DAX", details: daxData });
    }

    // 2. Token Power BI
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          client_id: process.env.CLIENT_ID,
          client_secret: process.env.CLIENT_SECRET,
          grant_type: "client_credentials",
          scope: "https://analysis.windows.net/powerbi/api/.default"
        })
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      return res.status(500).json({
        error: "Erro ao gerar token Power BI",
        details: tokenData
      });
    }

    // 3. Executar DAX no modelo semântico
    const pbiResponse = await fetch(
      `https://api.powerbi.com/v1.0/myorg/groups/${process.env.WORKSPACE_ID}/datasets/${process.env.DATASET_ID}/executeQueries`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          queries: [
            {
              query: daxQuery
            }
          ],
          serializerSettings: {
            includeNulls: true
          }
        })
      }
    );

    const pbiData = await pbiResponse.json();

    if (!pbiResponse.ok) {
      return res.status(500).json({
        error: "Erro ao consultar Power BI",
        daxQuery,
        details: pbiData
      });
    }

    // 4. Claude responde com base no resultado
    const finalResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: `
Você é um assistente executivo de dados.
Responda em português.
Use SOMENTE os dados retornados pelo Power BI.
Se não houver dados suficientes, diga isso claramente.
        `,
        messages: [
          {
            role: "user",
            content: `
Pergunta do usuário:
${question}

DAX executada:
${daxQuery}

Resultado do Power BI:
${JSON.stringify(pbiData)}
            `
          }
        ]
      })
    });

    const finalData = await finalResponse.json();

    return res.status(200).json({
      answer: finalData?.content?.[0]?.text,
      daxQuery,
      powerBiResult: pbiData
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

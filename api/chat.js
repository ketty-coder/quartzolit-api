export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { question } = req.body || {};

    if (!question) {
      return res.status(400).json({
        error: "A pergunta não foi enviada. Envie o campo question."
      });
    }

    const intentResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system: `
Você interpreta perguntas sobre um modelo Power BI.
Responda SOMENTE um JSON válido.

Medidas permitidas:
[Receita]
[Volume]
[Margem]
[Custo Médio]
[Preço Sell IN]
[Price Index]
[Score Final]
[Score Receita]
[Score Volume]
[Score Margem]
[Score Custo Médio]
[Score Price Index]
[% Chaves Verdes]
[% Chaves Amarelas]
[% Chaves Vermelhas]
[Qtd Chaves Verdes]
[Qtd Chaves Amarelas]
[Qtd Chaves Vermelhas]
[Faturamento Pocket]

Dimensões permitidas:
d_uf[UF]
d_filial[Nome]
d_material[Categoria]
d_material[Família]
d_material[Produto]
d_calendario[Ano]
d_calendario[Ano-Mês]
f_faturamento[Agrupamento Clientes]
f_faturamento[Agrupamento Nível 1]
f_faturamento[Agrupamento Nível 2]
f_faturamento[Agrupamento Nível 3]

Regras:
- faturamento, vendas ou receita = [Receita]
- volume = [Volume]
- margem = [Margem]
- custo = [Custo Médio]
- preço = [Preço Sell IN]
- score/performance = [Score Final]
- estado/UF = d_uf[UF]
- categoria = d_material[Categoria]
- família = d_material[Família]
- produto = d_material[Produto]
- mês = d_calendario[Ano-Mês]
- ano = d_calendario[Ano]

Formato:
{
  "medida": "[Receita]",
  "dimensao": "d_uf[UF]",
  "ordenacao": "DESC",
  "limite": 100
}
        `,
        messages: [
          {
            role: "user",
            content: question
          }
        ]
      })
    });

    const intentData = await intentResponse.json();
    const intentText = intentData?.content?.[0]?.text;

    if (!intentText) {
      return res.status(500).json({
        error: "Erro ao interpretar pergunta com Claude.",
        details: intentData
      });
    }

    let intent;

    try {
      intent = JSON.parse(intentText);
    } catch (e) {
      return res.status(500).json({
        error: "Claude não retornou JSON válido.",
        details: intentText
      });
    }

    const medidasPermitidas = [
      "[Receita]",
      "[Volume]",
      "[Margem]",
      "[Custo Médio]",
      "[Preço Sell IN]",
      "[Price Index]",
      "[Score Final]",
      "[Score Receita]",
      "[Score Volume]",
      "[Score Margem]",
      "[Score Custo Médio]",
      "[Score Price Index]",
      "[% Chaves Verdes]",
      "[% Chaves Amarelas]",
      "[% Chaves Vermelhas]",
      "[Qtd Chaves Verdes]",
      "[Qtd Chaves Amarelas]",
      "[Qtd Chaves Vermelhas]",
      "[Faturamento Pocket]"
    ];

    const dimensoesPermitidas = [
      "d_uf[UF]",
      "d_filial[Nome]",
      "d_material[Categoria]",
      "d_material[Família]",
      "d_material[Produto]",
      "d_calendario[Ano]",
      "d_calendario[Ano-Mês]",
      "f_faturamento[Agrupamento Clientes]",
      "f_faturamento[Agrupamento Nível 1]",
      "f_faturamento[Agrupamento Nível 2]",
      "f_faturamento[Agrupamento Nível 3]"
    ];

    const medida = medidasPermitidas.includes(intent.medida)
      ? intent.medida
      : "[Receita]";

    const dimensao = dimensoesPermitidas.includes(intent.dimensao)
      ? intent.dimensao
      : null;

    const limite = Number(intent.limite) > 0 && Number(intent.limite) <= 500
      ? Number(intent.limite)
      : 100;

    const ordenacao = intent.ordenacao === "ASC" ? "ASC" : "DESC";

    const daxQuery = dimensao
      ? `
EVALUATE
TOPN(
    ${limite},
    SUMMARIZECOLUMNS(
        ${dimensao},
        "Valor", ${medida}
    ),
    [Valor],
    ${ordenacao}
)
`
      : `
EVALUATE
ROW(
    "Valor", ${medida}
)
`;

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
        error: "Erro ao gerar token do Power BI.",
        details: tokenData
      });
    }

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
        error: "Erro ao consultar o modelo semântico do Power BI.",
        daxQuery,
        details: pbiData
      });
    }

    const finalResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 900,
        system: `
Você é uma assistente executiva de dados.
Responda em português.
Use somente os dados retornados pelo Power BI.
Não invente valores.
Se houver erro ou poucos dados, explique claramente.
        `,
        messages: [
          {
            role: "user",
            content: `
Pergunta:
${question}

DAX:
${daxQuery}

Resultado Power BI:
${JSON.stringify(pbiData)}
            `
          }
        ]
      })
    });

    const finalData = await finalResponse.json();

    return res.status(200).json({
      answer: finalData?.content?.[0]?.text || "Não consegui gerar resposta.",
      intent,
      daxQuery,
      powerBiResult: pbiData
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message || "Erro interno",
      stack: error.stack || null
    });
  }
}

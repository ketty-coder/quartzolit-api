export default async function handler(req, res) {
  // CORS para Power BI
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};

    // Aceita question direto ou pega a última mensagem do chat
    const question =
      body.question ||
      body.messages?.filter((m) => m.role === "user")?.at(-1)?.content;

    if (!question) {
      return res.status(400).json({
        error: "Envie 'question' ou 'messages' com a pergunta do usuário."
      });
    }

    // 1. Claude interpreta a pergunta em JSON
    const intentResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 600,
        system: `
Você é um analista especialista em Power BI.

Sua função é interpretar a pergunta do usuário e retornar APENAS um JSON válido.

Modelo semântico disponível:

Tabelas/dimensões:
- d_uf[UF]
- d_filial[Nome]
- d_material[Categoria]
- d_material[Família]
- d_material[Produto]
- d_calendario[Ano]
- d_calendario[Ano-Mês]
- d_calendario[Data]
- f_faturamento[Agrupamento Clientes]
- f_faturamento[Agrupamento Nível 1]
- f_faturamento[Agrupamento Nível 2]
- f_faturamento[Agrupamento Nível 3]

Medidas:
- [Receita]
- [Volume]
- [Margem]
- [Custo Médio]
- [Preço Sell IN]
- [Price Index]
- [Score Final]
- [Score Receita]
- [Score Volume]
- [Score Margem]
- [Score Custo Médio]
- [Score Price Index]
- [% Chaves Verdes]
- [% Chaves Amarelas]
- [% Chaves Vermelhas]
- [Qtd Chaves Verdes]
- [Qtd Chaves Amarelas]
- [Qtd Chaves Vermelhas]
- [Faturamento Pocket]

Regras de interpretação:
- "faturamento", "vendas", "receita" => [Receita]
- "volume", "quantidade" => [Volume]
- "margem" => [Margem]
- "custo" => [Custo Médio]
- "preço" => [Preço Sell IN]
- "price index", "índice de preço" => [Price Index]
- "score", "performance", "desempenho" => [Score Final]
- "UF", "estado" => d_uf[UF]
- "filial" => d_filial[Nome]
- "categoria" => d_material[Categoria]
- "família" => d_material[Família]
- "produto" => d_material[Produto]
- "mês", "mensal", "ano mês" => d_calendario[Ano-Mês]
- "ano" => d_calendario[Ano]

Formato obrigatório:
{
  "medida": "[Receita]",
  "dimensao": "d_uf[UF]",
  "ordenacao": "DESC",
  "limite": 100,
  "tipo": "ranking"
}

Se não identificar dimensão, use null.
Se não identificar medida, use "[Receita]".
Não explique nada.
Não use markdown.
Retorne somente JSON.
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
        error: "Erro ao interpretar pergunta.",
        details: intentData
      });
    }

    let intent;

    try {
      intent = JSON.parse(intentText);
    } catch {
      return res.status(500).json({
        error: "Claude não retornou JSON válido.",
        raw: intentText
      });
    }

    // 2. Validação para evitar DAX inventado
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
      "d_calendario[Data]",
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

    // 3. Monta DAX com segurança
    let daxQuery;

    if (dimensao) {
      daxQuery = `
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
`;
    } else {
      daxQuery = `
EVALUATE
ROW(
    "Valor", ${medida}
)
`;
    }

    // 4. Token Power BI
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

    // 5. Executa DAX no modelo semântico
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

    // 6. Claude responde baseado nos dados retornados
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
Você é uma assistente executiva de dados.

Responda em português, de forma clara e objetiva.

Regras:
- Use SOMENTE os dados retornados pelo Power BI.
- Não invente números.
- Se não houver dados suficientes, diga claramente.
- Responda como análise de dashboard.
- Destaque principais valores, ranking ou insight.
        `,
        messages: [
          {
            role: "user",
            content: `
Pergunta original:
${question}

Interpretação:
${JSON.stringify(intent)}

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

    const answer = finalData?.content?.[0]?.text || "Não consegui gerar a resposta.";

    return res.status(200).json({
      answer,
      intent,
      daxQuery,
      powerBiResult: pbiData
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}

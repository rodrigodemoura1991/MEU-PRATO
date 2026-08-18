const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return json({ error: "OPENAI_API_KEY não configurada no Supabase." }, 500);

  try {
    const body = await req.json();
    const image = typeof body.image === "string" ? body.image : "";
    const weight = Number(body.weight);
    const meal = typeof body.meal === "string" ? body.meal : "normal";
    const proteinPreference = typeof body.protein === "string" ? body.protein : "mixed";

    if (!image.startsWith("data:image/")) return json({ error: "Imagem inválida." }, 400);
    if (!Number.isFinite(weight) || weight <= 0 || weight > 3000) {
      return json({ error: "Peso inválido. Informe o peso total da comida em gramas." }, 400);
    }

    const prompt = `Você é o nutricionista visual do aplicativo Meu Prato. Analise a FOTO da refeição e estime os alimentos visíveis.

Peso TOTAL informado da comida: ${weight} g.
Tipo de refeição selecionado: ${meal}.
Preferência de proteína selecionada: ${proteinPreference}.

Regras importantes:
- Identifique apenas alimentos realmente visíveis ou altamente prováveis pela imagem.
- Use o peso total informado como restrição: a soma das porções estimadas deve ficar próxima de ${weight} g.
- Considere molhos, queijos, óleo e acompanhamentos quando forem visíveis.
- Não invente precisão: são estimativas visuais.
- Para alimentos preparados, estime valores já prontos/cozidos.
- Calcule calorias a partir dos macros quando possível, mas use valores nutricionais plausíveis para cada alimento.
- Retorne SOMENTE JSON válido, sem markdown, sem texto antes ou depois.

Formato obrigatório:
{
  "total_weight_g": number,
  "calories": number,
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "confidence": "alta" | "média" | "baixa",
  "summary": "string curta em português",
  "foods": [
    {"name":"string", "estimated_weight_g": number, "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number}
  ]
}`;

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.6",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              { type: "input_image", image_url: image, detail: "high" },
            ],
          },
        ],
        max_output_tokens: 1800,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI error:", errorText.slice(0, 2000));
      return json({ error: "A IA não conseguiu analisar a imagem agora.", detail: errorText }, 502);
    }

    const data = await openaiResponse.json();
    const outputText = typeof data.output_text === "string"
      ? data.output_text
      : (data.output ?? [])
          .flatMap((item: any) => item.content ?? [])
          .filter((item: any) => item.type === "output_text")
          .map((item: any) => item.text)
          .join("\n");

    if (!outputText) return json({ error: "A IA retornou uma resposta vazia." }, 502);

    let parsed: any;
    try {
      parsed = JSON.parse(outputText.trim());
    } catch {
      const match = outputText.match(/\{[\s\S]*\}/);
      if (!match) return json({ error: "Não foi possível interpretar a análise da IA." }, 502);
      parsed = JSON.parse(match[0]);
    }

    return json({
      ...parsed,
      total_weight_g: Number(parsed.total_weight_g) || weight,
      calories: Math.round(Number(parsed.calories) || 0),
      protein_g: Number(parsed.protein_g) || 0,
      carbs_g: Number(parsed.carbs_g) || 0,
      fat_g: Number(parsed.fat_g) || 0,
      confidence: parsed.confidence || "média",
      foods: Array.isArray(parsed.foods) ? parsed.foods : [],
    });
  } catch (error) {
    console.error(error);
    return json({ error: "Erro ao processar a análise do prato." }, 500);
  }
});

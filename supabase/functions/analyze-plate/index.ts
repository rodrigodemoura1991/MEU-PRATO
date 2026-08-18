const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:corsHeaders});
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST") return json({error:"Use POST."},405);
  const apiKey=Deno.env.get("OPENAI_API_KEY");
  if(!apiKey) return json({error:"OPENAI_API_KEY não configurada no Supabase."},500);
  try{
    const body=await req.json();
    const image=typeof body.image==="string"?body.image:"";
    const weight=Number(body.weight);
    const meal=typeof body.meal==="string"?body.meal:"normal";
    const proteinPreference=typeof body.protein==="string"?body.protein:"mixed";
    if(!image.startsWith("data:image/")) return json({error:"Imagem inválida."},400);
    if(!Number.isFinite(weight)||weight<=0||weight>3000) return json({error:"Peso inválido. Informe o peso total da comida em gramas."},400);
    const prompt=`Você é o nutricionista visual do aplicativo Meu Prato. Analise a FOTO da refeição e estime os alimentos visíveis.
Peso TOTAL informado: ${weight} g.
Tipo de refeição: ${meal}.
Preferência de proteína: ${proteinPreference}.
Regras: identifique apenas alimentos visíveis ou altamente prováveis; mantenha a soma das porções próxima do peso total; considere molhos, queijos, óleo e acompanhamentos visíveis; use valores de alimentos preparados/cozidos; não invente precisão. Retorne SOMENTE JSON válido, sem markdown.
Formato: {"total_weight_g":number,"calories":number,"protein_g":number,"carbs_g":number,"fat_g":number,"confidence":"alta"|"média"|"baixa","summary":"string curta em português","foods":[{"name":"string","estimated_weight_g":number,"calories":number,"protein_g":number,"carbs_g":number,"fat_g":number}]}`;
    const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-5.6",input:[{role:"user",content:[{type:"input_text",text:prompt},{type:"input_image",image_url:image,detail:"high"}]}],max_output_tokens:1800})});
    if(!r.ok){const errorText=await r.text();console.error("OpenAI error:",errorText.slice(0,2000));return json({error:"A IA não conseguiu analisar a imagem agora.",status:r.status},502)}
    const d=await r.json();
    const out=typeof d.output_text==="string"?d.output_text:(d.output??[]).flatMap((i:any)=>i.content??[]).filter((i:any)=>i.type==="output_text").map((i:any)=>i.text).join("\n");
    if(!out) return json({error:"A IA retornou uma resposta vazia."},502);
    let p:any;
    try{p=JSON.parse(out.trim())}catch{const m=out.match(/\{[\s\S]*\}/);if(!m)return json({error:"Não foi possível interpretar a análise da IA."},502);p=JSON.parse(m[0])}
    return json({...p,total_weight_g:Number(p.total_weight_g)||weight,calories:Math.round(Number(p.calories)||0),protein_g:Number(p.protein_g)||0,carbs_g:Number(p.carbs_g)||0,fat_g:Number(p.fat_g)||0,confidence:p.confidence||"média",foods:Array.isArray(p.foods)?p.foods:[]});
  }catch(e){console.error(e);return json({error:"Erro ao processar a análise do prato."},500)}
});
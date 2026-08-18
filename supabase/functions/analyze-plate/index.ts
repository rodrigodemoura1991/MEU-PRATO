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
    const prompt=`Você é o motor de estimativa nutricional visual do aplicativo Meu Prato. Analise cuidadosamente a FOTO da refeição e produza a melhor estimativa possível usando a imagem + o peso TOTAL informado.

DADOS DA REFEIÇÃO:
- Peso TOTAL medido pelo usuário: ${weight} g. Este é o principal limitador de quantidade e deve ser respeitado.
- Tipo de refeição: ${meal}.
- Preferência de proteína: ${proteinPreference}.

MÉTODO OBRIGATÓRIO:
1. Primeiro identifique visualmente cada alimento e, quando possível, a forma de preparo. Diferencie carne grelhada/assada de fritura, arroz/massa, ovo frito/cozido, molhos, queijos, óleo aparente etc.
2. Estime a proporção visual de cada item e distribua os ${weight} g entre eles. A soma dos estimated_weight_g deve ficar muito próxima do peso informado (idealmente diferença <=5%; nunca invente uma porção incompatível com a foto).
3. Use valores nutricionais de alimentos PRONTOS/COZIDOS e porções comestíveis, não valores crus, salvo quando a imagem claramente mostrar alimento cru.
4. Considere óleo, manteiga, molhos, queijos e empanamentos quando forem visíveis ou altamente prováveis pelo preparo. Não adicione ingredientes que não tenham evidência suficiente.
5. Para cada alimento, estime calorias e macros de forma independente e depois faça uma checagem de consistência do prato inteiro.
6. Faça uma checagem matemática: calorias totais devem ser plausíveis em relação a proteína, carboidratos e gorduras (aprox. 4 kcal/g para proteína e carboidrato e 9 kcal/g para gordura), permitindo pequenas diferenças de arredondamento e fibras.
7. Se houver grande incerteza (por exemplo, molho escondido, tipo de corte ou quantidade de óleo), escolha um valor central realista e reduza a confiança. NÃO compense incerteza inventando precisão.
8. A confiança deve ser "alta" somente quando os alimentos e porções estiverem claramente visíveis e o peso ajudar bastante; "média" na maioria das fotos comuns; "baixa" quando a identificação ou quantidade for muito incerta.
9. Prefira uma estimativa nutricional realista para comida de restaurante brasileiro. Não assuma que a refeição é diet/light só por parecer pequena.
10. O resultado final deve representar o prato inteiro e as porções devem ser compatíveis com o peso total informado.

Retorne SOMENTE JSON válido, sem markdown, sem texto antes ou depois.
Formato exato: {"total_weight_g":number,"calories":number,"protein_g":number,"carbs_g":number,"fat_g":number,"confidence":"alta"|"média"|"baixa","summary":"string curta em português","foods":[{"name":"string","estimated_weight_g":number,"calories":number,"protein_g":number,"carbs_g":number,"fat_g":number}]}`;
    const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-5.6",input:[{role:"user",content:[{type:"input_text",text:prompt},{type:"input_image",image_url:image,detail:"high"}]}],max_output_tokens:2200})});
    if(!r.ok){const errorText=await r.text();console.error("OpenAI error:",errorText.slice(0,2000));return json({error:"A IA não conseguiu analisar a imagem agora.",status:r.status},502)}
    const d=await r.json();
    const out=typeof d.output_text==="string"?d.output_text:(d.output??[]).flatMap((i:any)=>i.content??[]).filter((i:any)=>i.type==="output_text").map((i:any)=>i.text).join("\n");
    if(!out) return json({error:"A IA retornou uma resposta vazia."},502);
    let p:any;
    try{p=JSON.parse(out.trim())}catch{const m=out.match(/\{[\s\S]*\}/);if(!m)return json({error:"Não foi possível interpretar a análise da IA."},502);p=JSON.parse(m[0])}
    const foods=Array.isArray(p.foods)?p.foods.map((f:any)=>({name:String(f.name||"Alimento"),estimated_weight_g:Math.max(0,Number(f.estimated_weight_g)||0),calories:Math.max(0,Math.round(Number(f.calories)||0)),protein_g:Math.max(0,Number(f.protein_g)||0),carbs_g:Math.max(0,Number(f.carbs_g)||0),fat_g:Math.max(0,Number(f.fat_g)||0)})):[];
    const foodWeight=foods.reduce((s:number,f:any)=>s+f.estimated_weight_g,0);
    const scale=foodWeight>0?weight/foodWeight:1;
    const normalizedFoods=foods.map((f:any)=>({...f,estimated_weight_g:Math.round(f.estimated_weight_g*scale)}));
    const totals=normalizedFoods.reduce((s:any,f:any)=>({calories:s.calories+f.calories*scale,protein_g:s.protein_g+f.protein_g*scale,carbs_g:s.carbs_g+f.carbs_g*scale,fat_g:s.fat_g+f.fat_g*scale}),{calories:0,protein_g:0,carbs_g:0,fat_g:0});
    return json({...p,total_weight_g:weight,calories:Math.round(Number(p.calories)||totals.calories),protein_g:Number(p.protein_g)||Math.round(totals.protein_g*10)/10,carbs_g:Number(p.carbs_g)||Math.round(totals.carbs_g*10)/10,fat_g:Number(p.fat_g)||Math.round(totals.fat_g*10)/10,confidence:p.confidence||"média",foods:normalizedFoods});
  }catch(e){console.error(e);return json({error:"Erro ao processar a análise do prato."},500)}
});
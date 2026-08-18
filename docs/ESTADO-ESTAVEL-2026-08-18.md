# Meu Prato — estado estável

Data: 18/08/2026

## Ponto de restauração

Branch: `backup-estavel-2026-08-18`

Commit de referência: `e34fb7dd7b8509102000070ea3b1824ce2227ee1`

Esse ponto deve ser preservado como versão estável antes de novas alterações.

## Backend

- Supabase Edge Function: `analyze-plate`
- Versão funcional validada: 10
- Função ativa e testada após correção do erro HTTP 500.
- O frontend chama a função pelo endpoint configurado no `index.html`.
- A chave usada pelo navegador é a chave pública/publishable do Supabase; o segredo da OpenAI permanece no secret `OPENAI_API_KEY` do Supabase.

## Recursos atuais

- Foto pela galeria
- Foto pela câmera
- Peso total da refeição em gramas
- Tipo de refeição
- Preferência de proteína
- Sobremesa: sem sobremesa, chocolate, fruta, sorvete, bolo, pudim, doce e outro
- Peso da sobremesa
- Foto opcional da sobremesa
- Estimativa de calorias
- Proteína, carboidratos e gorduras
- Faixa provável de calorias
- Percentual e nível de confiança
- Lista de alimentos identificados
- Correção manual da estimativa
- Histórico com foto
- Relatórios de hoje, 7 dias e 30 dias
- Reset automático do formulário após salvar no histórico
- Histórico local no aparelho via `localStorage`
- PWA instalado como aplicativo independente

## Identidade visual / PWA

- Nome: Meu Prato
- Tema: verde escuro / verde nutricional
- Ícone oficial: `icon.svg`
- Manifesto PWA atualizado para usar o ícone e modo standalone.

## Regra para próximas alterações

Não remover nem alterar o fluxo funcional atual sem criar primeiro outro ponto de restauração. Evoluir a partir desta versão estável.

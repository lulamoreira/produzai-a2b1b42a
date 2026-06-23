## Situação

Você testou em `produzai.lovable.app` com hard reload e os botões "WhatsApp" e "Copiar texto e-mail" continuam não aparecendo — mas confirmei no código-fonte (`RateioTabV2.tsx`, linhas 2385–2461) que eles **estão lá e corretos**, e o build de produção passou.

Isso significa que **o publish anterior não propagou o bundle atualizado** para `produzai.lovable.app`. O código está certo; só falta empurrar a versão correta para produção.

## Plano

### Passo 1 — Validar primeiro no preview (sanity check)
Antes de republicar, abrir o **preview** (`id-preview--...lovable.app`) numa janela anônima, ir até Rateio → "Enviar Recotação por Quantidade", gerar o link e confirmar visualmente se os botões aparecem.

- Se aparecerem: confirma 100% que o problema é só publish/CDN. Seguir Passo 2.
- Se NÃO aparecerem nem no preview: problema diferente (vou investigar JS/CSS escondendo o bloco). Pular para Passo 4.

### Passo 2 — Forçar republish do projeto
Republicar via `preview_ui--publish` para gerar um novo build de produção a partir do código atual e propagar para `produzai.lovable.app`.

### Passo 3 — Verificar em produção
Após o publish concluir (~1 min), abrir `produzai.lovable.app` em **janela anônima** (evita qualquer cache local/SW residual), repetir o fluxo e confirmar os dois botões.

### Passo 4 — Fallback diagnóstico (só se Passo 1 falhar)
Se nem no preview os botões aparecerem, adicionar um marcador visual temporário (ex.: texto "v2" ao lado do link) e logs no console dentro da IIFE, para identificar se:
- a IIFE está sendo executada,
- `generatedRequoteLink` está truthy no momento certo,
- algum CSS está escondendo os botões.

## Fora do escopo
- Sem mudanças de lógica.
- Sem migrations, RLS ou edge functions.
- Sem alterações no source — exceto se o Passo 4 for necessário.

## Próximo passo concreto
Aprovando este plano, eu executo o Passo 2 (republish) direto, já que é a hipótese mais provável. Se mesmo assim não aparecer, sigo para o Passo 4.

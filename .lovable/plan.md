

## Adicionar tooltip explicativo ao botão de Check-in de fotos

Adiciono um ícone de interrogação (`HelpCircle`) ao lado do botão "Clique aqui para informar Check-in de fotos para ocorrências" no card de cada loja, com um tooltip que explica resumidamente para que serve a ação ao passar o mouse.

### O que muda visualmente

No card de cada loja (módulo Instalações), ao lado do botão laranja/verde de check-in de fotos, aparecerá um pequeno ícone "?" cinza. Ao passar o mouse:

> "Confirme que você revisou as fotos desta loja e que elas estão prontas para gerar ocorrências, se necessário. Use após verificar a qualidade e completude do registro fotográfico da instalação."

O texto é em português, conciso (~2 linhas), e o tooltip aparece acima do ícone com pequeno atraso para não atrapalhar uso normal.

### Detalhes técnicos

**Arquivo único alterado:** `src/components/InstallationsTab.tsx`

1. Adicionar imports do Tooltip:
   ```ts
   import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
   ```
   (`HelpCircle` já está importado de `lucide-react`.)

2. Envolver o bloco do botão de check-in (linhas ~1314-1352) em um container `flex items-center gap-2`, mantendo o `<button>` existente intocado e adicionando ao lado:
   ```tsx
   <TooltipProvider delayDuration={200}>
     <Tooltip>
       <TooltipTrigger asChild>
         <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Ajuda sobre check-in de fotos">
           <HelpCircle className="w-4 h-4" />
         </button>
       </TooltipTrigger>
       <TooltipContent side="top" className="max-w-xs text-xs">
         Confirme que você revisou as fotos desta loja e que estão prontas para gerar ocorrências, se necessário. Use após verificar a qualidade e completude do registro fotográfico da instalação.
       </TooltipContent>
     </Tooltip>
   </TooltipProvider>
   ```

3. Aplicar a mesma adição no `OccurrenceCard.tsx` (linhas ~440-450), onde o mesmo banner é exibido em modo somente leitura, para manter consistência entre os dois locais que mostram o status.

### Não muda

- Lógica de toggle, atualização do banco (`photo_checkin` / `photo_checkin_at`), logs de atividade e permissões permanecem idênticos.
- Estados visuais (verde/laranja) do botão preservados.
- Nenhuma migração de banco ou alteração de tipos.


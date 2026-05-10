# AppDialog — Fundação de Dialogs do ProduzAI

## Quando usar

- **`AppDialog`**: todo dialog novo (informativo, formulário, detalhes, configuração).
- **`ConfirmDestructiveDialog`**: confirmações destrutivas (apagar, resetar, descartar). Força UX consistente: 2 ações, ícone de alerta, opção de digitação obrigatória.

## Regra

Todo dialog novo no ProduzAI deve usar `AppDialog`. Confirmações destrutivas devem usar `ConfirmDestructiveDialog`. **Não usar `Dialog` do shadcn diretamente em features novas.**

Por quê:
- Layout à prova de overflow (`min-w-0`, `break-words`, `max-w-[min(560px,calc(100vw-2rem))]`).
- Body com scroll interno automático — footer nunca corta no mobile.
- Header/Body/Footer padronizados — visual consistente em todo o produto.
- API força boas práticas (ex: `confirmText` obrigatório descrevendo a consequência).

## Anatomia

```tsx
<AppDialog open onOpenChange>
  <AppDialogHeader icon title description />
  <AppDialogBody>{/* conteúdo scrollável */}</AppDialogBody>
  <AppDialogFooter destructiveAction={...}>{/* ações */}</AppDialogFooter>
</AppDialog>
```

- `DialogContent` é `flex flex-col`, header e footer são fixos, **só o body scrolla**.
- Footer empilha vertical no mobile e fica horizontal no desktop (`sm:`).
- `destructiveAction` no footer fica à esquerda no desktop (`sm:mr-auto`), separada das ações primárias.
- Em dev, footer com mais de 3 ações dispara `console.warn`.

## Exemplo A — Dialog informativo

```tsx
import { AppDialog, AppDialogHeader, AppDialogBody, AppDialogFooter } from "@/components/ui/app-dialog";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";

export function AboutDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <AppDialog open={open} onOpenChange={onOpenChange}>
      <AppDialogHeader
        icon={<Info className="w-5 h-5 text-primary" />}
        title="Sobre o ProduzAI"
        description="Plataforma de gestão de campanhas visuais e logística."
      />
      <AppDialogBody>
        <p className="text-sm text-muted-foreground">
          Versão 2.0 — feito com carinho pela equipe ProduzAI.
        </p>
      </AppDialogBody>
      <AppDialogFooter>
        <Button onClick={() => onOpenChange(false)}>Fechar</Button>
      </AppDialogFooter>
    </AppDialog>
  );
}
```

## Exemplo B — Dialog de formulário

```tsx
import { useState } from "react";
import { AppDialog, AppDialogHeader, AppDialogBody, AppDialogFooter } from "@/components/ui/app-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EditClientDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [name, setName] = useState("");

  return (
    <AppDialog open={open} onOpenChange={onOpenChange}>
      <AppDialogHeader
        title="Editar cliente"
        description="Atualize as informações básicas do cliente."
      />
      <AppDialogBody>
        <form className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </form>
      </AppDialogBody>
      <AppDialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        <Button onClick={() => onOpenChange(false)}>Salvar</Button>
      </AppDialogFooter>
    </AppDialog>
  );
}
```

## Exemplo C — Confirmação destrutiva com digitação obrigatória

```tsx
import { ConfirmDestructiveDialog } from "@/components/ui/confirm-destructive-dialog";

export function DeletePhotosDialog({
  open,
  onOpenChange,
  count,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  count: number;
  onDelete: () => Promise<void>;
}) {
  return (
    <ConfirmDestructiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Apagar ${count} fotos?`}
      description="Esta ação não pode ser desfeita. As fotos serão removidas permanentemente do storage."
      confirmText={`Apagar ${count} fotos`}
      requireTyping="APAGAR"
      onConfirm={onDelete}
    />
  );
}
```

## Tipagem

- `confirmText` é `string` obrigatória — deve descrever a consequência (não usar "Confirmar"/"OK" genéricos).
- `ConfirmDestructiveDialog` não aceita `children` — impossível por construção passar dois botões destrutivos.
- `AppDialogFooter` aceita `destructiveAction` separadamente das ações primárias para reforçar a hierarquia visual.

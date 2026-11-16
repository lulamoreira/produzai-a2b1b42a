/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { resolveStore, storeNote } from "@/lib/storeNotes";
import { StoreNoteMark } from "@/components/StoreNoteMark";

/** Nome/apelido normalizado → loja (de buildStoreLookup, já em memória). */
export type StoreLookup = Map<string, any>;

export interface StoreNameLinkProps {
  /** Nome como aparece no apontamento (nome ou apelido). */
  name: string;
  lookup: StoreLookup;
  onOpen: (store: any) => void;
  /** Id da loja, quando o apontamento traz (casa antes do nome). */
  storeId?: string;
  /** Mostra o ícone âmbar da nota da loja ao lado do nome (somente leitura). */
  showNote?: boolean;
  /** Texto exibido (padrão: o próprio nome). */
  children?: ReactNode;
  className?: string;
}

/** Nome de loja que abre a ficha (somente leitura); se a loja não for encontrada, vira texto simples. */
export function StoreNameLink({ name, lookup, onOpen, storeId, showNote, children, className }: StoreNameLinkProps) {
  const store = resolveStore(lookup, { id: storeId, name });
  const label = children ?? name;
  if (!store) return <span className={className}>{label}</span>;
  const link = (
    <button
      type="button"
      onClick={() => onOpen(store)}
      title="Ver ficha da loja"
      className={cn(
        "inline text-left text-primary hover:underline cursor-pointer rounded-sm break-words focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className,
      )}
    >
      {label}
    </button>
  );
  const note = showNote ? storeNote(store) : null;
  if (!note) return link;
  return (
    <>
      {link}
      {" "}
      <StoreNoteMark note={note} storeName={store.nickname || store.name} />
    </>
  );
}

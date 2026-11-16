/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { normalizeStoreKey } from "@/lib/storeFicha";

/** Nome/apelido normalizado → loja (de buildStoreLookup, já em memória). */
export type StoreLookup = Map<string, any>;

export interface StoreNameLinkProps {
  /** Nome como aparece no apontamento (nome ou apelido). */
  name: string;
  lookup: StoreLookup;
  onOpen: (store: any) => void;
  /** Texto exibido (padrão: o próprio nome). */
  children?: ReactNode;
  className?: string;
}

/** Nome de loja que abre a ficha (somente leitura); se a loja não for encontrada, vira texto simples. */
export function StoreNameLink({ name, lookup, onOpen, children, className }: StoreNameLinkProps) {
  const store = lookup.get(normalizeStoreKey(name));
  const label = children ?? name;
  if (!store) return <span className={className}>{label}</span>;
  return (
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
}

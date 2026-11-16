/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment, useMemo } from "react";
import { normalizeStoreKey } from "@/lib/storeFicha";
import { splitByStoreNames } from "@/lib/storeNameLinks";
import { StoreNameLink, type StoreLookup } from "@/components/StoreNameLink";

export interface LinkifiedTextProps {
  text: string;
  /** Nomes de loja conhecidos do apontamento (ver findingStoreNames). */
  names: readonly string[];
  lookup: StoreLookup;
  onOpen: (store: any) => void;
  /** Loja que não deve virar link (ex.: a própria ficha aberta). */
  excludeStoreId?: string;
}

/** Texto com os nomes de loja trocados por links para a ficha; o resto do texto fica igual. */
export function LinkifiedText({ text, names, lookup, onOpen, excludeStoreId }: LinkifiedTextProps) {
  const segments = useMemo(() => {
    const usable = names.filter((n) => {
      const store = lookup.get(normalizeStoreKey(n));
      return !!store && store.id !== excludeStoreId;
    });
    return splitByStoreNames(text, usable);
  }, [text, names, lookup, excludeStoreId]);
  return (
    <>
      {segments.map((s, i) =>
        s.name ? (
          <StoreNameLink key={i} name={s.name} lookup={lookup} onOpen={onOpen}>{s.text}</StoreNameLink>
        ) : (
          <Fragment key={i}>{s.text}</Fragment>
        ),
      )}
    </>
  );
}

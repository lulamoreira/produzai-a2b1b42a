import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStoreContactsByClient, useStoreContactRoles } from "@/hooks/useStoreContacts";
import { Search, UserPlus, MapPin, Phone, Mail, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import type { ClientStore } from "@/hooks/useMultiClientData";

function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

interface Props {
  clientId: string | undefined;
  stores: ClientStore[];
  agencyName: string;
  clientName: string;
}

const StoreContactsCardView = ({ clientId, stores, agencyName, clientName }: Props) => {
  const { data: contacts = [] } = useStoreContactsByClient(clientId);
  const { data: roles = [] } = useStoreContactRoles(clientId);
  const [search, setSearch] = useState("");

  const storeMap = useMemo(() => {
    const m: Record<string, ClientStore> = {};
    stores.forEach(s => { m[s.id] = s; });
    return m;
  }, [stores]);

  const getRoleName = (roleId: string | null) => {
    if (!roleId) return null;
    return roles.find(r => r.id === roleId)?.name || null;
  };

  const filteredContacts = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(c => {
      const store = storeMap[c.store_id];
      const storeName = store?.name?.toLowerCase() || "";
      const storeNickname = store?.nickname?.toLowerCase() || "";
      return (
        c.name.toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        storeName.includes(q) ||
        storeNickname.includes(q)
      );
    });
  }, [contacts, search, storeMap]);

  // Group contacts by store
  const groupedByStore = useMemo(() => {
    const map = new Map<string, typeof contacts>();
    filteredContacts.forEach(c => {
      if (!map.has(c.store_id)) map.set(c.store_id, []);
      map.get(c.store_id)!.push(c);
    });
    // Sort by store name
    return Array.from(map.entries()).sort((a, b) => {
      const storeA = storeMap[a[0]]?.name || "";
      const storeB = storeMap[b[0]]?.name || "";
      return storeA.localeCompare(storeB);
    });
  }, [filteredContacts, storeMap]);

  const buildWhatsAppUrl = (phone: string, contactName: string) => {
    const digits = phone.replace(/\D/g, "");
    const firstName = contactName.split(" ")[0];
    const text = `Olá ${firstName}, somos da Agência ${agencyName}, estamos fazendo contato em nome do cliente ${clientName}, tudo bem?`;
    return `https://wa.me/55${digits}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar contato, loja..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {filteredContacts.length} contato(s) em {groupedByStore.length} loja(s)
      </p>

      {groupedByStore.length === 0 ? (
        <div className="text-center py-12">
          <UserPlus className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Nenhum contato encontrado.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByStore.map(([storeId, storeContacts]) => {
            const store = storeMap[storeId];
            if (!store) return null;
            return (
              <div key={storeId} className="aqua-card rounded-xl p-4 space-y-3">
                {/* Store header */}
                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                  <Building2 className="w-4 h-4 text-primary" />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm text-foreground">{store.name}</span>
                    {store.nickname && store.nickname !== store.name && (
                      <span className="text-xs text-muted-foreground ml-1.5">({store.nickname})</span>
                    )}
                  </div>
                  {(store.city || store.state) && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <MapPin className="w-3 h-3" />
                      {[store.city, store.state].filter(Boolean).join(" / ")}
                    </div>
                  )}
                </div>

                {/* Contact cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {storeContacts.map(contact => {
                    const roleName = getRoleName(contact.role_id);
                    return (
                      <div key={contact.id} className="bg-background rounded-lg border border-border p-3 space-y-1.5">
                        <div>
                          <p className="text-sm font-medium text-foreground">{contact.name}</p>
                          {roleName && (
                            <p className="text-[11px] text-primary font-medium">{roleName}</p>
                          )}
                        </div>

                        {contact.phone && (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-1 min-w-0">
                              <Phone className="w-3 h-3 shrink-0" />
                              <span className="truncate">{formatPhoneDisplay(contact.phone)}</span>
                            </div>
                            <a
                              href={buildWhatsAppUrl(contact.phone, contact.name)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted transition-colors"
                              title="Enviar WhatsApp"
                            >
                              <svg viewBox="0 0 24 24" className="w-4 h-4 text-green-600 fill-current">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                            </a>
                          </div>
                        )}

                        {contact.email && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Mail className="w-3 h-3 shrink-0" />
                            <a href={`mailto:${contact.email}`} className="truncate hover:text-primary transition-colors">
                              {contact.email}
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StoreContactsCardView;

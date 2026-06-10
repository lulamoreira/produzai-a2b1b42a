import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStoreContactsByClient, useStoreContactRoles } from "@/hooks/useStoreContacts";
import { Search, UserPlus, MapPin, Phone, Mail, Building2, Hash, FileText, Edit3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ClientStore } from "@/hooks/useMultiClientData";
import { formatPhoneByCountry, getCountryConfig } from "@/lib/countryConfig";

interface Props {
  clientId: string;
  stores: ClientStore[];
  agencyName: string;
  clientName: string;
  customFields?: { label: string; index: number }[];
  canEdit?: boolean;
  onEditStore?: (store: ClientStore) => void;
  countryCode?: string | null;
}

const StoreFullCardView = ({ clientId, stores, agencyName, clientName, customFields = [], canEdit = false, onEditStore, countryCode }: Props) => {
  const { t } = useTranslation();
  const { data: allContacts = [] } = useStoreContactsByClient(clientId);
  const { data: roles = [] } = useStoreContactRoles(clientId);
  const [search, setSearch] = useState("");
  const cc = getCountryConfig(countryCode);

  const getRoleName = (roleId: string | null) => {
    if (!roleId) return null;
    return roles.find(r => r.id === roleId)?.name || null;
  };

  const contactsByStore = useMemo(() => {
    const m: Record<string, typeof allContacts> = {};
    allContacts.forEach(c => {
      if (!m[c.store_id]) m[c.store_id] = [];
      m[c.store_id].push(c);
    });
    return m;
  }, [allContacts]);

  const filteredStores = useMemo(() => {
    if (!search.trim()) return stores;
    const q = search.toLowerCase().trim();
    return stores.filter(s => {
      const matchesSearch = Object.values(s).some(val => 
        (typeof val === 'string' || typeof val === 'number') && 
        val.toString().toLowerCase().includes(q)
      );
      if (matchesSearch) return true;
      
      // Also search in contacts
      const contacts = contactsByStore[s.id] || [];
      return contacts.some(c =>
        c.name.toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q)
      );
    });
  }, [stores, search, contactsByStore]);

  const buildWhatsAppUrl = (phone: string, contactName: string) => {
    const digits = phone.replace(/\D/g, "");
    const firstName = contactName.split(" ")[0];
    const text = `Olá ${firstName}, somos da Agência ${agencyName}, estamos fazendo contato em nome do cliente ${clientName}, tudo bem?`;
    return `https://wa.me/${cc.phonePrefix}${digits}?text=${encodeURIComponent(text)}`;
  };

  const InfoRow = ({ label, value }: { label: string; value: string | null | undefined }) => {
    if (!value) return null;
    return (
      <div className="flex gap-2 text-xs">
        <span className="text-muted-foreground shrink-0 min-w-[80px]">{label}:</span>
        <span className="text-foreground break-all">{value}</span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t("stores.searchAll")}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      <p className="text-xs text-muted-foreground">{filteredStores.length} {t("stores.storeCount")}</p>

      {filteredStores.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">{t("stores.noStoreFound")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredStores.map(store => {
            const contacts = contactsByStore[store.id] || [];
            const address = [store.street, store.number, store.complement, store.neighborhood].filter(Boolean).join(", ");
            const cityState = [store.city, store.state].filter(Boolean).join(" / ");

            return (
              <div key={store.id} className="aqua-card rounded-xl p-4 space-y-3">
                {/* Store header */}
                <div className="flex items-start gap-2 pb-2 border-b border-border/50">
                  <Building2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground flex items-center gap-2">
                      {store.name}
                      {store.tipo_entrega === "frete_apenas" && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700 border border-blue-200 uppercase">
                          Só Entrega
                        </span>
                      )}
                      {store.tipo_entrega === "frete_instalacao" && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase">
                          Instalação
                        </span>
                      )}
                      {store.tipo_entrega === "sem_logistica" && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-100 text-gray-600 border border-gray-200 uppercase">
                          Sem Logística
                        </span>
                      )}
                    </p>
                    {store.nickname && store.nickname !== store.name && (
                      <p className="text-xs text-muted-foreground">({store.nickname})</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {canEdit && onEditStore && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        onClick={() => onEditStore(store)}
                        title={t("stores.editStore")}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {store.store_model && (
                      <span className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {store.store_model}
                      </span>
                    )}
                  </div>
                </div>

                {/* Store data */}
                <div className="space-y-1">
                  <InfoRow label={t("common.code")} value={store.store_code} />
                  <InfoRow label={cc.taxIdLabel} value={store.cnpj} />
                  <InfoRow label={cc.stateRegistrationLabel} value={store.state_registration} />
                  {address && <InfoRow label={t("common.address")} value={address} />}
                  {store.zip_code && <InfoRow label={cc.zipLabel} value={store.zip_code} />}
                  {cityState && (
                    <div className="flex gap-2 text-xs">
                      <span className="text-muted-foreground shrink-0 min-w-[80px]">{t("pieces.location")}:</span>
                      <span className="text-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-muted-foreground" />
                        {cityState}
                      </span>
                    </div>
                  )}
                  <InfoRow label={t("stores.country")} value={store.country} />
                  {store.phone && (
                    <div className="flex gap-2 text-xs items-center">
                      <span className="text-muted-foreground shrink-0 min-w-[80px]">{t("common.phone")}:</span>
                      <span className="text-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {formatPhoneByCountry(store.phone, countryCode)}
                      </span>
                    </div>
                  )}
                  {store.email && (
                    <div className="flex gap-2 text-xs items-center">
                      <span className="text-muted-foreground shrink-0 min-w-[80px]">{t("common.email")}:</span>
                      <a href={`mailto:${store.email}`} className="text-foreground hover:text-primary transition-colors flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {store.email}
                      </a>
                    </div>
                  )}
                  <InfoRow label={t("common.contact")} value={store.manager_name} />
                  <InfoRow label={t("common.observations")} value={(store as any).observations} />
                  {/* Custom fields */}
                  {customFields.map(cf => {
                    const val = (store as any)[`custom_field_${cf.index}`];
                    return val ? <InfoRow key={cf.index} label={cf.label} value={val} /> : null;
                  })}
                </div>

                {/* Contacts section */}
                {contacts.length > 0 && (
                  <div className="pt-2 border-t border-border/50 space-y-2">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                      <UserPlus className="w-3.5 h-3.5" /> {t("stores.contacts")} ({contacts.length})
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      {contacts.map(contact => {
                        const roleName = getRoleName(contact.role_id);
                        return (
                          <div key={contact.id} className="bg-background rounded-lg border border-border p-2.5 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{contact.name}</p>
                              {roleName && <p className="text-[10px] text-primary font-medium">{roleName}</p>}
                              {contact.email && (
                                <a href={`mailto:${contact.email}`} className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5">
                                  <Mail className="w-3 h-3" /> {contact.email}
                                </a>
                              )}
                            </div>
                            {contact.phone && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-xs text-muted-foreground">{formatPhoneByCountry(contact.phone, countryCode)}</span>
                                <a
                                  href={buildWhatsAppUrl(contact.phone, contact.name)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors"
                                  title={t("common.sendWhatsApp")}
                                >
                                  <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 text-green-600 fill-current">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                  </svg>
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {contacts.length === 0 && (
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-[11px] text-muted-foreground text-center py-1">{t("stores.noContactRegistered")}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StoreFullCardView;

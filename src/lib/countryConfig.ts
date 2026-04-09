export interface CountryConfig {
  code: string;
  name: string;
  currency: string;
  currencyLocale: string;
  phonePrefix: string;
  zipLabel: string;
  zipPlaceholder: string;
  zipMaxLength: number;
  hasAutoCepLookup: boolean;
  taxIdLabel: string;
  stateRegistrationLabel: string;
  stateLabel: string;
}

export const COUNTRY_CONFIGS: Record<string, CountryConfig> = {
  BR: {
    code: "BR",
    name: "Brasil",
    currency: "BRL",
    currencyLocale: "pt-BR",
    phonePrefix: "55",
    zipLabel: "CEP",
    zipPlaceholder: "00000-000",
    zipMaxLength: 9,
    hasAutoCepLookup: true,
    taxIdLabel: "CNPJ",
    stateRegistrationLabel: "Inscrição Estadual",
    stateLabel: "Estado",
  },
  CL: {
    code: "CL",
    name: "Chile",
    currency: "CLP",
    currencyLocale: "es-CL",
    phonePrefix: "56",
    zipLabel: "Código Postal",
    zipPlaceholder: "",
    zipMaxLength: 10,
    hasAutoCepLookup: false,
    taxIdLabel: "RUT",
    stateRegistrationLabel: "Giro",
    stateLabel: "Región",
  },
  US: {
    code: "US",
    name: "Estados Unidos",
    currency: "USD",
    currencyLocale: "en-US",
    phonePrefix: "1",
    zipLabel: "ZIP Code",
    zipPlaceholder: "00000",
    zipMaxLength: 10,
    hasAutoCepLookup: false,
    taxIdLabel: "EIN",
    stateRegistrationLabel: "State Tax ID",
    stateLabel: "State",
  },
  MX: {
    code: "MX",
    name: "México",
    currency: "MXN",
    currencyLocale: "es-MX",
    phonePrefix: "52",
    zipLabel: "Código Postal",
    zipPlaceholder: "00000",
    zipMaxLength: 10,
    hasAutoCepLookup: false,
    taxIdLabel: "RFC",
    stateRegistrationLabel: "Registro Estatal",
    stateLabel: "Estado",
  },
  AR: {
    code: "AR",
    name: "Argentina",
    currency: "ARS",
    currencyLocale: "es-AR",
    phonePrefix: "54",
    zipLabel: "Código Postal",
    zipPlaceholder: "",
    zipMaxLength: 10,
    hasAutoCepLookup: false,
    taxIdLabel: "CUIT",
    stateRegistrationLabel: "Ingresos Brutos",
    stateLabel: "Provincia",
  },
  CO: {
    code: "CO",
    name: "Colômbia",
    currency: "COP",
    currencyLocale: "es-CO",
    phonePrefix: "57",
    zipLabel: "Código Postal",
    zipPlaceholder: "",
    zipMaxLength: 10,
    hasAutoCepLookup: false,
    taxIdLabel: "NIT",
    stateRegistrationLabel: "Registro Mercantil",
    stateLabel: "Departamento",
  },
  PE: {
    code: "PE",
    name: "Peru",
    currency: "PEN",
    currencyLocale: "es-PE",
    phonePrefix: "51",
    zipLabel: "Código Postal",
    zipPlaceholder: "",
    zipMaxLength: 10,
    hasAutoCepLookup: false,
    taxIdLabel: "RUC",
    stateRegistrationLabel: "Registro",
    stateLabel: "Departamento",
  },
};

export const SUPPORTED_COUNTRIES = Object.values(COUNTRY_CONFIGS).sort((a, b) => a.name.localeCompare(b.name));

export function getCountryConfig(countryCode?: string | null): CountryConfig {
  return COUNTRY_CONFIGS[countryCode || "BR"] || COUNTRY_CONFIGS["BR"];
}

export function formatCurrencyByCode(value: number, currencyCode?: string | null, locale?: string | null): string {
  const config = Object.values(COUNTRY_CONFIGS).find(c => c.currency === (currencyCode || "BRL")) || COUNTRY_CONFIGS["BR"];
  return value.toLocaleString(locale || config.currencyLocale, { style: "currency", currency: config.currency });
}

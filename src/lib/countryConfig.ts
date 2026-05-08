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
  return value.toLocaleString(locale || config.currencyLocale, {
    style: "currency",
    currency: config.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format a phone number according to the country's pattern */
export function formatPhoneByCountry(value: string, countryCode?: string | null): string {
  const digits = value.replace(/\D/g, "");
  const config = getCountryConfig(countryCode);
  const prefix = config.phonePrefix;

  switch (config.code) {
    case "BR": {
      const d = digits.slice(0, 11);
      if (d.length <= 2) return d;
      if (d.length <= 7) return `(${d.slice(0, 2)})${d.slice(2)}`;
      return `(${d.slice(0, 2)})${d.slice(2, 7)}-${d.slice(7)}`;
    }
    case "CL": {
      // +56 9 XXXX XXXX → store as 9XXXXXXXX
      const d = digits.slice(0, 9);
      if (d.length <= 1) return d;
      if (d.length <= 5) return `${d.slice(0, 1)} ${d.slice(1)}`;
      return `${d.slice(0, 1)} ${d.slice(1, 5)} ${d.slice(5)}`;
    }
    case "MX": {
      // 10 digits: XX XXXX XXXX
      const d = digits.slice(0, 10);
      if (d.length <= 2) return d;
      if (d.length <= 6) return `${d.slice(0, 2)} ${d.slice(2)}`;
      return `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}`;
    }
    case "AR": {
      // 10 digits: XX XXXX XXXX
      const d = digits.slice(0, 10);
      if (d.length <= 2) return d;
      if (d.length <= 6) return `${d.slice(0, 2)} ${d.slice(2)}`;
      return `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}`;
    }
    case "CO": {
      // 10 digits: XXX XXX XXXX
      const d = digits.slice(0, 10);
      if (d.length <= 3) return d;
      if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
      return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
    }
    case "PE": {
      // 9 digits: XXX XXX XXX
      const d = digits.slice(0, 9);
      if (d.length <= 3) return d;
      if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
      return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
    }
    case "US": {
      // 10 digits: (XXX) XXX-XXXX
      const d = digits.slice(0, 10);
      if (d.length <= 3) return d;
      if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
      return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    }
    default: {
      return digits;
    }
  }
}

/** Get phone placeholder by country */
export function getPhonePlaceholder(countryCode?: string | null): string {
  const config = getCountryConfig(countryCode);
  switch (config.code) {
    case "BR": return "(00)00000-0000";
    case "CL": return "9 1234 5678";
    case "MX": return "55 1234 5678";
    case "AR": return "11 1234 5678";
    case "CO": return "301 234 5678";
    case "PE": return "912 345 678";
    case "US": return "(555) 123-4567";
    default: return "";
  }
}

/** Get max length for phone input by country */
export function getPhoneMaxLength(countryCode?: string | null): number {
  const config = getCountryConfig(countryCode);
  switch (config.code) {
    case "BR": return 14;
    case "CL": return 11;
    case "US": return 14;
    case "MX": return 12;
    case "AR": return 12;
    case "CO": return 12;
    case "PE": return 11;
    default: return 15;
  }
}

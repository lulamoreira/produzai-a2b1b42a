import { useTranslation } from "react-i18next";
import { 
  format, 
  formatDistanceToNow, 
  formatRelative, 
  parseISO, 
  isValid 
} from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";

export const useFormatters = () => {
  const { i18n } = useTranslation();
  const lang = i18n.language;

  const dateFnsLocale = (() => {
    if (lang.startsWith("pt")) return ptBR;
    if (lang.startsWith("es")) return es;
    return enUS;
  })();

  const isValidDate = (value: any): value is Date | string | number => {
    if (!value) return false;
    const date = typeof value === "string" ? parseISO(value) : new Date(value);
    return isValid(date);
  };

  const toDate = (value: any): Date => {
    return typeof value === "string" ? parseISO(value) : new Date(value);
  };

  const date = (value: any) => {
    if (!isValidDate(value)) return "—";
    return format(toDate(value), "PP", { locale: dateFnsLocale });
  };

  const dateShort = (value: any) => {
    if (!isValidDate(value)) return "—";
    return format(toDate(value), "P", { locale: dateFnsLocale });
  };

  const dateTime = (value: any) => {
    if (!isValidDate(value)) return "—";
    return format(toDate(value), "PPp", { locale: dateFnsLocale });
  };

  const time = (value: any) => {
    if (!isValidDate(value)) return "—";
    return format(toDate(value), "HH:mm", { locale: dateFnsLocale });
  };

  const relative = (value: any) => {
    if (!isValidDate(value)) return "—";
    return formatDistanceToNow(toDate(value), { 
      locale: dateFnsLocale,
      addSuffix: true 
    });
  };

  const relativeCalendar = (value: any) => {
    if (!isValidDate(value)) return "—";
    return formatRelative(toDate(value), new Date(), { locale: dateFnsLocale });
  };

  const custom = (value: any, pattern: string) => {
    if (!isValidDate(value)) return "—";
    return format(toDate(value), pattern, { locale: dateFnsLocale });
  };

  const number = (value: any) => {
    if (value === null || value === undefined || isNaN(Number(value))) return "—";
    return new Intl.NumberFormat(lang).format(Number(value));
  };

  const currency = (value: any, currency = "BRL") => {
    if (value === null || value === undefined || isNaN(Number(value))) return "—";
    return new Intl.NumberFormat(lang, { 
      style: "currency", 
      currency 
    }).format(Number(value));
  };

  const decimal = (value: any, fractionDigits = 2) => {
    if (value === null || value === undefined || isNaN(Number(value))) return "—";
    return new Intl.NumberFormat(lang, { 
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(Number(value));
  };

  return {
    date,
    dateShort,
    dateTime,
    time,
    relative,
    relativeCalendar,
    custom,
    number,
    currency,
    decimal,
    dateFnsLocale,
    lang
  };
};

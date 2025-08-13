import { format, parseISO } from "date-fns";

export const fmt = (d: Date) => format(d, "yyyy-MM-dd");
export const parse = (s: string) => parseISO(s);
export const uid = () => Math.random().toString(36).slice(2, 9);

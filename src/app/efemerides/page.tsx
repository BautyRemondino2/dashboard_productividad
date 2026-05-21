import {
  getEfemerides,
  daysUntil,
  fmtEfemerideDate,
  isLongWeekend,
  type Efemeride,
} from "@/lib/efemerides";
import EfemeridesClient from "./EfemeridesClient";

export const metadata = { title: "Efemérides · Argentina · Dashboard" };

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function EfemeridesPage() {
  const today = todayISO();
  const year = Number(today.slice(0, 4));
  const thisYear = getEfemerides(year);
  const nextYear = getEfemerides(year + 1);

  const allYearList: Efemeride[] = thisYear; // for isLongWeekend lookup

  // Pre-compute days + finde-largo flag per entry, then forward to the client
  const decorate = (items: Efemeride[]) =>
    items.map(e => ({
      ...e,
      days: daysUntil(today, e.date),
      formatted: fmtEfemerideDate(e.date),
      longWeekend: isLongWeekend(e, allYearList),
    }));

  return (
    <EfemeridesClient
      today={today}
      year={year}
      thisYear={decorate(thisYear)}
      nextYear={decorate(nextYear)}
    />
  );
}

import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance();

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  if (!ticker) {
    return NextResponse.json({ error: "ticker required" }, { status: 400 });
  }

  try {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 32);

    // historical() without validateResult option — returns properly typed array
    const rows = await yf.historical(ticker, {
      period1: start,
      period2: end,
      interval: "1d",
    });

    const data = rows.map((q) => ({
      date:
        q.date instanceof Date
          ? q.date.toISOString().slice(0, 10)
          : String(q.date).slice(0, 10),
      close: q.close ?? null,
    }));

    return NextResponse.json({ ticker, data });
  } catch {
    return NextResponse.json(
      { error: `No se pudo obtener historial para ${ticker}` },
      { status: 404 }
    );
  }
}

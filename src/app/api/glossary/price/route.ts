import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance();

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  if (!ticker) {
    return NextResponse.json({ error: "ticker required" }, { status: 400 });
  }

  try {
    // Use fields param to limit payload; omit validateResult so return type is inferred correctly
    const quote = await yf.quote(ticker, {
      fields: [
        "regularMarketPrice",
        "regularMarketChange",
        "regularMarketChangePercent",
        "currency",
        "longName",
        "shortName",
      ],
    });

    return NextResponse.json({
      ticker,
      price: quote.regularMarketPrice ?? null,
      change: quote.regularMarketChange ?? null,
      changePct: quote.regularMarketChangePercent ?? null,
      currency: quote.currency ?? "USD",
      name: quote.longName ?? quote.shortName ?? ticker,
    });
  } catch {
    return NextResponse.json(
      { error: `No se pudo obtener precio para ${ticker}` },
      { status: 404 }
    );
  }
}

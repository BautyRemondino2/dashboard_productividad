/**
 * Puente entre el símbolo con que un ETF reporta una tenencia y el ticker
 * equivalente en este dashboard.
 *
 * Generado por `node scripts/generar-universo.mjs` el 2026-08-26.
 *
 * Un ETF de Brasil compra VALE3.SA en B3; la misma empresa cotiza en NYSE como
 * VALE. Sin este mapeo la tenencia no enlaza a ninguna ficha. Cada destino está
 * verificado contra el universo: no puede haber un link a un ticker que no
 * exista.
 */

export const TENENCIA_A_TICKER: Record<string, string> = {
  "000660.KQ": "SKHY",
  "055550.KQ": "SHG",
  "2303.TW": "UMC",
  "2330.TW": "TSM",
  "3711.TW": "ASX",
  "6758.T": "SONY",
  "7203.T": "TM",
  "8306.T": "MUFG",
  "8316.T": "SMFG",
  "8411.T": "MFG",
  "ABEV3.SA": "ABEV",
  "AMXB.MX": "AMX",
  "ASML.AS": "ASML",
  "AZN.L": "AZN",
  "BARC.L": "BCS",
  "BATS.L": "BTI",
  "BHP.AX": "BHP",
  "BMO.TO": "BMO",
  "BNS.TO": "BNS",
  "CM.TO": "CM",
  "DBK.DE": "DB",
  "ENB.TO": "ENB",
  "FEMSAUBD.MX": "FMX",
  "GSK.L": "GSK",
  "HDFCBANK.NS": "HDB",
  "HSBA.L": "HSBC",
  "ICICIBANK.NS": "IBN",
  "ITUB4": "ITUB",
  "PETR3.SA": "PBR",
  "PETR4": "PBR",
  "RIO.L": "RIO",
  "SAN.MC": "SAN",
  "SAP.DE": "SAP",
  "SHEL.L": "SHEL",
  "SU.TO": "SU",
  "ULVR.L": "UL",
  "VALE3.SA": "VALE",
};

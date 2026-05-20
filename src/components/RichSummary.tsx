"use client";

import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

// ─── Block types ──────────────────────────────────────────────────────────────
type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: string; id: string }
  | { kind: "paragraph"; text: string }
  | { kind: "box"; type: BoxType; title: string | null; body: string }
  | { kind: "code"; language: string; body: string }
  | { kind: "math"; latex: string }
  | { kind: "table"; headers: string[]; rows: string[][] }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "hr" };

type BoxType = "definicion" | "nota" | "warning" | "ejemplo" | "teorema" | "codigo" | "default";

const BOX_STYLE: Record<BoxType, { border: string; bg: string; label: string; labelColor: string }> = {
  definicion: { border: "border-blue-800/70",   bg: "bg-blue-950/25",   label: "Definición",  labelColor: "text-blue-400/90" },
  nota:       { border: "border-emerald-800/70", bg: "bg-emerald-950/20", label: "Nota",        labelColor: "text-emerald-400/90" },
  warning:    { border: "border-red-900/70",     bg: "bg-red-950/25",     label: "Atención",    labelColor: "text-red-400/90" },
  ejemplo:    { border: "border-amber-900/70",   bg: "bg-amber-950/20",   label: "Ejemplo",     labelColor: "text-amber-400/90" },
  teorema:    { border: "border-violet-800/70",  bg: "bg-violet-950/25",  label: "Teorema",     labelColor: "text-violet-300/90" },
  codigo:     { border: "border-fuchsia-900/70", bg: "bg-fuchsia-950/15", label: "Código",      labelColor: "text-fuchsia-400/90" },
  default:    { border: "border-slate-700",      bg: "bg-slate-900/40",   label: "",            labelColor: "text-slate-400" },
};

// ─── Inline renderer ──────────────────────────────────────────────────────────
// Handles: **bold**, *italic*, `code`, $inline math$, and plain text.
function renderInline(text: string, keyBase = ""): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  // Token regex — order matters: math first, then code, bold, italic.
  const re = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|`[^`\n]+?`|\*\*[^*\n]+?\*\*|\*[^*\n]+?\*|_[^_\n]+?_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(<span key={`${keyBase}t${i++}`}>{text.slice(last, m.index)}</span>);
    const token = m[0];
    if (token.startsWith("$$") && token.endsWith("$$")) {
      out.push(<InlineMath key={`${keyBase}m${i++}`} latex={token.slice(2, -2).trim()} display />);
    } else if (token.startsWith("$") && token.endsWith("$")) {
      out.push(<InlineMath key={`${keyBase}m${i++}`} latex={token.slice(1, -1).trim()} />);
    } else if (token.startsWith("`")) {
      out.push(<code key={`${keyBase}c${i++}`} className="px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-200 text-[12px] font-mono">{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**")) {
      out.push(<strong key={`${keyBase}b${i++}`} className="text-slate-100 font-semibold">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*") || token.startsWith("_")) {
      out.push(<em key={`${keyBase}i${i++}`} className="text-slate-200 italic">{token.slice(1, -1)}</em>);
    }
    last = m.index + token.length;
  }
  if (last < text.length) out.push(<span key={`${keyBase}t${i++}`}>{text.slice(last)}</span>);
  return out;
}

function InlineMath({ latex, display = false }: { latex: string; display?: boolean }) {
  const html = useMemo(() => {
    try { return katex.renderToString(latex, { throwOnError: false, displayMode: display }); }
    catch { return null; }
  }, [latex, display]);
  if (!html) return <code className="text-red-400">{latex}</code>;
  if (display) {
    return (
      <div
        className="my-3 px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800 overflow-x-auto text-slate-200"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return <span className="text-slate-100" dangerouslySetInnerHTML={{ __html: html }} />;
}

// ─── Parser ───────────────────────────────────────────────────────────────────
function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function parse(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  const usedIds = new Set<string>();
  const uniqueId = (base: string) => {
    let id = base || "section";
    let n = 1;
    while (usedIds.has(id)) { id = `${base}-${n++}`; }
    usedIds.add(id);
    return id;
  };

  while (i < lines.length) {
    const line = lines[i];

    // Skip blank
    if (!line.trim()) { i++; continue; }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      blocks.push({ kind: "hr" });
      i++;
      continue;
    }

    // Heading
    const hMatch = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
    if (hMatch) {
      const level = hMatch[1].length as 1 | 2 | 3;
      const text = hMatch[2].replace(/\s+#*\s*$/, "");
      blocks.push({ kind: "heading", level, text, id: uniqueId(slugify(text)) });
      i++;
      continue;
    }

    // Display math: $$...$$ over one or more lines
    if (line.trim().startsWith("$$")) {
      const rest = line.trim().slice(2);
      if (rest.endsWith("$$") && rest.length > 2) {
        blocks.push({ kind: "math", latex: rest.slice(0, -2).trim() });
        i++;
        continue;
      }
      let body = rest ? rest + "\n" : "";
      i++;
      while (i < lines.length && !lines[i].trim().endsWith("$$")) {
        body += lines[i] + "\n";
        i++;
      }
      if (i < lines.length) {
        const tail = lines[i].trim().slice(0, -2);
        if (tail) body += tail;
        i++;
      }
      blocks.push({ kind: "math", latex: body.trim() });
      continue;
    }

    // Semantic box ::: tipo [titulo opcional]
    const boxOpen = /^:::\s*(\w+)(?:\s+(.*))?$/.exec(line.trim());
    if (boxOpen) {
      const type = (BOX_STYLE[boxOpen[1] as BoxType] ? boxOpen[1] : "default") as BoxType;
      const title = boxOpen[2]?.trim() || null;
      const bodyLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== ":::") {
        bodyLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing :::
      blocks.push({ kind: "box", type, title, body: bodyLines.join("\n").trim() });
      continue;
    }

    // Fenced code block ```lang
    const fenceOpen = /^```(\w*)\s*$/.exec(line.trim());
    if (fenceOpen) {
      const language = fenceOpen[1] || "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```
      blocks.push({ kind: "code", language, body: codeLines.join("\n") });
      continue;
    }

    // Markdown table: header row | --- row | data rows
    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?(\s*:?-+:?\s*\|)+/.test(lines[i + 1])) {
      const splitRow = (s: string) =>
        s.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map(c => c.trim());
      const headers = splitRow(line);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({ kind: "table", headers, rows });
      continue;
    }

    // Lists (ordered or unordered)
    const ulMatch = /^\s*[-*+]\s+(.+)/.exec(line);
    const olMatch = /^\s*\d+\.\s+(.+)/.exec(line);
    if (ulMatch || olMatch) {
      const ordered = !!olMatch;
      const items: string[] = [];
      while (i < lines.length) {
        const m1 = /^\s*[-*+]\s+(.+)/.exec(lines[i]);
        const m2 = /^\s*\d+\.\s+(.+)/.exec(lines[i]);
        if (ordered && m2) { items.push(m2[1]); i++; }
        else if (!ordered && m1) { items.push(m1[1]); i++; }
        else if (lines[i].trim() === "") break;
        else if ((ordered && m1) || (!ordered && m2)) break;
        else if (/^\s+\S/.test(lines[i]) && items.length > 0) {
          // Continuation line — append to previous item
          items[items.length - 1] += " " + lines[i].trim();
          i++;
        } else break;
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    // Paragraph — accumulate consecutive non-blank lines
    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^:::\s*\w+/.test(lines[i].trim()) &&
      !/^```/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith("$$") &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^---+$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ kind: "paragraph", text: paraLines.join(" ") });
  }

  return blocks;
}

// ─── Renderers per block ──────────────────────────────────────────────────────
function renderBlock(b: Block, key: number): React.ReactNode {
  switch (b.kind) {
    case "heading": {
      const Tag = (b.level === 1 ? "h2" : b.level === 2 ? "h3" : "h4") as keyof React.JSX.IntrinsicElements;
      const cls = b.level === 1
        ? "text-2xl font-semibold text-slate-100 mt-8 mb-3 tracking-tight pb-2 border-b border-slate-800"
        : b.level === 2
        ? "text-[18px] font-semibold text-slate-100 mt-6 mb-2 tracking-tight"
        : "text-[14px] font-semibold text-slate-200 mt-4 mb-1.5 uppercase tracking-widest";
      return (
        <Tag key={key} id={b.id} className={cls}>
          {renderInline(b.text, `h${key}-`)}
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p key={key} className="text-[13.5px] text-slate-300 leading-relaxed my-3 text-pretty">
          {renderInline(b.text, `p${key}-`)}
        </p>
      );
    case "box": {
      const s = BOX_STYLE[b.type];
      return (
        <div key={key} className={`rounded-lg border ${s.border} ${s.bg} px-4 py-3 my-3`}>
          {(s.label || b.title) && (
            <p className={`text-[10px] uppercase tracking-widest font-semibold mb-1.5 ${s.labelColor}`}>
              {b.title ?? s.label}
            </p>
          )}
          <div className="text-[13.5px] text-slate-200 leading-relaxed text-pretty">
            <NestedMarkdown text={b.body} keyBase={`box${key}-`} />
          </div>
        </div>
      );
    }
    case "code":
      return (
        <pre key={key} className="my-3 rounded-lg border border-fuchsia-900/40 bg-slate-950 px-4 py-3 overflow-x-auto">
          {b.language && (
            <div className="text-[9px] uppercase tracking-widest text-fuchsia-400/60 mb-1.5">{b.language}</div>
          )}
          <code className="text-[12px] text-slate-200 font-mono whitespace-pre leading-relaxed">{b.body}</code>
        </pre>
      );
    case "math":
      return <InlineMath key={key} latex={b.latex} display />;
    case "table":
      return (
        <div key={key} className="my-4 overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-[13px] text-slate-300">
            <thead className="bg-slate-900/70 border-b border-slate-800">
              <tr>
                {b.headers.map((h, j) => (
                  <th key={j} className="text-left font-semibold text-slate-200 px-3 py-2 text-pretty">
                    {renderInline(h, `th${key}-${j}-`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-slate-900 last:border-0 align-top">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-pretty">{renderInline(cell, `td${key}-${ri}-${ci}-`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "list":
      return b.ordered ? (
        <ol key={key} className="list-decimal pl-6 my-3 space-y-1 text-[13.5px] text-slate-300 leading-relaxed marker:text-slate-600">
          {b.items.map((it, idx) => <li key={idx} className="pl-1">{renderInline(it, `li${key}-${idx}-`)}</li>)}
        </ol>
      ) : (
        <ul key={key} className="list-disc pl-6 my-3 space-y-1 text-[13.5px] text-slate-300 leading-relaxed marker:text-slate-600">
          {b.items.map((it, idx) => <li key={idx} className="pl-1">{renderInline(it, `li${key}-${idx}-`)}</li>)}
        </ul>
      );
    case "hr":
      return <hr key={key} className="my-6 border-slate-800" />;
  }
}

// Nested markdown for inside boxes (no recursive boxes — keep it simple)
function NestedMarkdown({ text, keyBase }: { text: string; keyBase: string }) {
  const blocks = useMemo(() => parse(text), [text]);
  return <>{blocks.map((b, i) => <span key={`${keyBase}${i}`}>{renderBlock(b, i)}</span>)}</>;
}

// ─── Table of Contents ────────────────────────────────────────────────────────
function TableOfContents({ blocks }: { blocks: Block[] }) {
  const headings = blocks.filter((b): b is Extract<Block, { kind: "heading" }> => b.kind === "heading");
  if (headings.length < 3) return null;
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/30 px-4 py-3 my-4 not-print:print:hidden">
      <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Tabla de contenidos</p>
      <ul className="space-y-0.5">
        {headings.map((h, i) => (
          <li
            key={i}
            className="text-[12.5px] leading-tight"
            style={{ paddingLeft: `${(h.level - 1) * 12}px` }}
          >
            <a
              href={`#${h.id}`}
              className="text-slate-400 hover:text-slate-100 transition-colors"
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Concept chips (extracted from **bold** anywhere) ─────────────────────────
function ConceptChips({ markdown }: { markdown: string }) {
  const concepts = useMemo(() => {
    const set = new Set<string>();
    const re = /\*\*([^*\n]+?)\*\*/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(markdown))) {
      const c = m[1].trim();
      if (c.length >= 2 && c.length <= 60) set.add(c);
    }
    return Array.from(set).slice(0, 40);
  }, [markdown]);

  if (concepts.length === 0) return null;
  return (
    <div className="mt-6 pt-4 border-t border-slate-800">
      <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Conceptos clave</p>
      <div className="flex flex-wrap gap-1.5">
        {concepts.map((c, i) => (
          <span
            key={i}
            className="text-[11px] px-2 py-1 rounded-md bg-slate-900/60 border border-slate-800 text-slate-300"
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function RichSummary({
  markdown,
  title,
  meta,
  onPrint,
}: {
  markdown: string;
  title?: string;
  meta?: string;
  onPrint?: () => void;
}) {
  const blocks = useMemo(() => parse(markdown), [markdown]);

  return (
    <article className="rich-summary text-slate-300 leading-relaxed" data-rich-summary>
      {/* Print-only header */}
      {(title || meta) && (
        <header className="hidden print:block mb-6 pb-3 border-b-2 border-slate-300">
          {title && <h1 className="text-2xl font-bold text-slate-900">{title}</h1>}
          {meta && <p className="text-[12px] text-slate-600 mt-1">{meta}</p>}
        </header>
      )}

      {/* Action bar — hidden in print */}
      {onPrint && (
        <div className="flex items-center justify-end mb-2 print:hidden">
          <button
            onClick={onPrint}
            className="text-[11px] text-slate-500 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-900 transition-colors inline-flex items-center gap-1.5"
            title="Imprimir o exportar como PDF (Cmd+P)"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" />
            </svg>
            Imprimir / PDF
          </button>
        </div>
      )}

      <TableOfContents blocks={blocks} />

      {blocks.map(renderBlock)}

      <ConceptChips markdown={markdown} />
    </article>
  );
}

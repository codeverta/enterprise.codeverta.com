import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Maximize2, Minimize2 } from "lucide-react";

function ImageRenderer({ src, alt }) {
  const [expanded, setExpanded] = useState(false);
  if (!src) return <span className="text-red-400 italic">[gambar: URL tidak tersedia]</span>;
  return (
    <span className="relative inline-block group my-2">
      <img
        src={src}
        alt={alt || ""}
        className={`rounded-md cursor-pointer transition-all ${
          expanded
            ? "max-w-full w-auto max-h-none"
            : "max-w-full max-h-72"
        }`}
        onClick={() => setExpanded(!expanded)}
        onError={(e) => {
          e.currentTarget.style.display = "none";
          e.currentTarget.parentElement!.innerHTML = `<span class="text-red-400 italic text-xs">[gagal memuat: ${alt || src}]</span>`;
        }}
      />
      <button
        className="absolute top-1 right-1 bg-black/60 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        title={expanded ? "Kecilkan" : "Besarkan"}
      >
        {expanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
      </button>
    </span>
  );
}

export const tableComponents = {
  table: ({ node, ...props }) => (
    <div className="my-4 w-full overflow-x-auto rounded-lg border border-zinc-200 shadow-sm">
      <table className="w-full text-sm text-left border-collapse" {...props} />
    </div>
  ),
  thead: ({ node, ...props }) => (
    <thead className="bg-zinc-50 border-b border-zinc-200 text-xs font-bold uppercase text-zinc-600 tracking-wider" {...props} />
  ),
  tbody: ({ node, ...props }) => (
    <tbody className="divide-y divide-zinc-200 bg-white" {...props} />
  ),
  tr: ({ node, ...props }) => (
    <tr className="hover:bg-zinc-50/50 transition-colors" {...props} />
  ),
  th: ({ node, ...props }) => (
    <th className="px-4 py-2.5 font-bold text-zinc-800 border-r border-zinc-150 last:border-r-0" {...props} />
  ),
  td: ({ node, ...props }) => (
    <td className="px-4 py-2.5 text-zinc-700 font-normal border-r border-zinc-150 last:border-r-0" {...props} />
  ),
};

// ============================================================
// Markdown render helper — dipakai di mana-mana biar konsisten
// ============================================================
export function MarkdownView({
  content,
  inline = false,
  plainTruncate = false,
}) {
  if (!content?.trim()) {
    return <span className="text-zinc-400 italic">Tidak ada konten</span>;
  }

  // Konteks sempit (mis. baris di sidebar): render sebagai teks polos
  // satu baris saja, tanpa markup/gambar, biar truncate rapi.
  if (plainTruncate) {
    const plain = content
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "[gambar]")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[#>*_`~]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return <span>{plain}</span>;
  }

  const Wrapper = inline ? "span" : "div";
  return (
    <Wrapper className="prose prose-slate prose-sm max-w-none leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          img: ImageRenderer,
          ...tableComponents,
        }}
      >
        {content}
      </ReactMarkdown>
    </Wrapper>
  );
}

export default MarkdownView;

import Link from "next/link";
import { coachingReference } from "@/lib/coachingReference";

// Admin view of the coaching reference the AI reviews are judged against.
export default function CoachingReferencePage() {
  const text = coachingReference();
  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/admin" className="text-sm text-accent2 hover:underline">
        ← Back to admin
      </Link>
      <div className="card">
        {text ? <Markdown text={text} /> : <p className="text-slate-400">The coaching reference hasn&apos;t been added yet.</p>}
      </div>
      <p className="text-xs text-slate-500">
        This is the only benchmark source the player reviews use. It lives in src/content/coaching-reference.md in the
        repository.
      </p>
    </div>
  );
}

// Just enough Markdown for this document: headings, bullets, tables, links,
// bold and paragraphs.
function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const size = ["text-2xl", "text-xl", "text-lg", "text-base"][h[1].length - 1];
      out.push(
        <p key={i} className={`${size} font-bold mt-6 first:mt-0 mb-2`}>
          {inline(h[2])}
        </p>,
      );
      i++;
      continue;
    }
    if (line.trim().startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      out.push(
        <div key={i} className="overflow-x-auto my-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-border">
                {head.map((c, j) => (
                  <th key={j} className="py-1.5 pr-3 font-medium">
                    {inline(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, k) => (
                <tr key={k} className="border-b border-border/50">
                  {r.map((c, j) => (
                    <td key={j} className="py-1.5 pr-3 text-slate-300">
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ""));
        i++;
      }
      out.push(
        <ul key={i} className="list-disc pl-5 space-y-1 my-2 text-sm text-slate-300">
          {items.map((it, j) => (
            <li key={j}>{inline(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#|\||\s*([-*]|\d+\.)\s)/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    out.push(
      <p key={i} className="text-sm text-slate-300 my-2">
        {inline(para.join(" "))}
      </p>,
    );
  }
  return <div>{out}</div>;
}

function inline(s: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*|(https?:\/\/[^\s)]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    if (m[1]) {
      parts.push(
        <a key={m.index} href={m[2]} target="_blank" rel="noreferrer" className="text-accent2 hover:underline">
          {m[1]}
        </a>,
      );
    } else if (m[3]) {
      parts.push(<strong key={m.index}>{m[3]}</strong>);
    } else if (m[4]) {
      parts.push(
        <a key={m.index} href={m[4]} target="_blank" rel="noreferrer" className="text-accent2 hover:underline break-all">
          {m[4]}
        </a>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts;
}

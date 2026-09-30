import Link from "next/link";
import type { DataScope } from "@/lib/scouting";

// Tryouts / Practice toggle for the admin scouting pages. The two never mix.
export default function ScopeSwitch({ scope, path }: { scope: DataScope; path: string }) {
  const tab = (value: DataScope, label: string) => (
    <Link
      href={value === "tryout" ? path : `${path}?data=practice`}
      className={`px-3 py-1 rounded-full text-sm border ${
        scope === value ? "border-accent2 text-white bg-accent2/15" : "border-border text-slate-400 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {tab("tryout", "Tryout data")}
      {tab("practice", "Practice data")}
      <span className="text-xs text-slate-500">
        {scope === "tryout"
          ? "Only tryout events and the Tryout games page. Practice games don't count here."
          : "Practices, scrims and matches only. None of this counts toward tryouts."}
      </span>
    </div>
  );
}

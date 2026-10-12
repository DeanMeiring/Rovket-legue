import { redirect } from "next/navigation";

// The captain's dashboard moved into Teams.
export default function CaptainPage({ searchParams }: { searchParams: { team?: string } }) {
  redirect(searchParams.team ? `/teams?team=${encodeURIComponent(searchParams.team)}` : "/teams");
}

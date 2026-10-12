import { redirect } from "next/navigation";

// The roster moved into Teams (the "Everyone" tab lists every player).
export default function PlayersPage() {
  redirect("/teams?team=all");
}

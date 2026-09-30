"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export type CaptainTeam = { id: string; name: string };

// The team the signed-in user captains (null when they don't captain one).
export function useCaptainTeam() {
  const { data: session } = useSession();
  const [team, setTeam] = useState<CaptainTeam | null>(null);
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    fetch("/api/captain")
      .then((r) => (r.ok ? r.json() : { team: null }))
      .then((d) => setTeam(d.team))
      .catch(() => setTeam(null));
  }, [userId]);

  return team;
}

// Captains manage the events they scheduled for their own team; admins manage all.
export function canManageEvent(
  ev: { createdById: string; forEveryone: boolean; audienceTeams: { id: string }[] },
  opts: { isAdmin: boolean; myId?: string; team: CaptainTeam | null },
) {
  if (opts.isAdmin) return true;
  return (
    !!opts.team &&
    ev.createdById === opts.myId &&
    !ev.forEveryone &&
    ev.audienceTeams.length === 1 &&
    ev.audienceTeams[0].id === opts.team.id
  );
}

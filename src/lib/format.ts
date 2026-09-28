export const EVENT_TYPE_LABEL: Record<string, string> = {
  TRYOUT: "Tryout",
  SCRIM: "Scrim",
  MATCH: "Match",
  TOURNAMENT: "Tournament",
  PRACTICE: "Practice",
  MEETING: "Meeting",
  OTHER: "Other",
};

export const EVENT_TYPE_COLOR: Record<string, string> = {
  TRYOUT: "bg-purple-500/20 text-purple-300",
  SCRIM: "bg-accent2/20 text-accent2",
  MATCH: "bg-accent/20 text-accent",
  TOURNAMENT: "bg-yellow-500/20 text-yellow-300",
  PRACTICE: "bg-green-500/20 text-green-300",
  MEETING: "bg-slate-500/20 text-slate-300",
  OTHER: "bg-slate-500/20 text-slate-300",
};

export const RSVP_LABEL: Record<string, string> = {
  PENDING: "No response",
  GOING: "Going",
  MAYBE: "Maybe",
  DECLINED: "Declined",
};

export const RSVP_COLOR: Record<string, string> = {
  PENDING: "bg-slate-500/20 text-slate-300",
  GOING: "bg-green-500/20 text-green-300",
  MAYBE: "bg-yellow-500/20 text-yellow-300",
  DECLINED: "bg-red-500/20 text-red-300",
};

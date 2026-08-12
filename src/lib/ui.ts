export const PAPER = "#F0EEE9", INK = "#2A251F", MUTED = "#7A736B", HAIR = "#DCD7CD";
export const FORZA = "#C96442", LIFT = "#E0764F", BODY = "#4A443C";

/* The completion date as every report writes it — "6 August 2026". Shared by the
   two web views and the two PDFs so the four cannot drift apart. */
export const fmtReportDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

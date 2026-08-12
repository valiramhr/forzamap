export const PAPER = "#F0EEE9", INK = "#2A251F", MUTED = "#7A736B", HAIR = "#DCD7CD";
export const FORZA = "#C96442", LIFT = "#E0764F", BODY = "#4A443C";

/* Completion date as the reports print it — day precision, no clock. A report
   is read long after the sitting, where the minute of submission is noise; the
   admin list keeps the timestamp for the cases where it matters. Shared so both
   instruments date themselves the same way on screen and on the page. */
export const fmtCompleted = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

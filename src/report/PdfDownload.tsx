import { useEffect, useRef, useState } from "react";
import { usePDF } from "@react-pdf/renderer";
import { registerPdfFonts } from "./ReportPDF";
import { FORZA } from "../lib/ui";

/* The one download button every report PDF is offered behind.
   ─────────────────────────────────────────────────────────────────────
   react-pdf's own PDFDownloadLink fails silently. Its hook records the error
   and leaves `url` null; the link renders <a href={null}>, which React emits
   as an anchor with no href at all — so the label goes back to "Download PDF",
   the button looks ready, and clicking it does nothing at all, for ever. The
   only trace is a console.error nobody has open. That is the worst shape a
   failure can take: indistinguishable from a click that did not register.

   Building a PDF really can fail — a font asset that 404s after a bad deploy,
   a browser out of memory on a forty-row grid — and when it does the person is
   owed the reason and a way to try again. So this renders the anchor only when
   there is something to download, and otherwise says what went wrong beside a
   button that retries.

   RETRY IS A REMOUNT, PLUS A FRESH FONT REGISTRY. usePDF builds its renderer
   once, in a mount effect, and caches the outcome, so bumping the key is what
   starts a genuinely new attempt. That alone is not enough: react-pdf also
   caches each font source's load promise on the source object in a global
   store, so the commonest cause of failure — a font that would not load —
   stays failed for the life of the page unless the registry is rebuilt too. */

/* usePDF's own types call this a string, but what it stores is whatever the
   render threw — an Error, in every case we have seen. Read both, so a change
   of shape upstream degrades to a serviceable message rather than "[object
   Object]". */
function reason(err: unknown): string {
  if (typeof err === "string") return err;
  const m = (err as { message?: unknown } | null)?.message;
  return typeof m === "string" && m ? m : String(err);
}

interface Props {
  /** The <Document> to render. */
  document: React.ReactElement;
  fileName: string;
  /** Applied to the link and to the retry button alike, so a failure sits
      where the button sat rather than reflowing the bar around it. */
  className?: string;
  style?: React.CSSProperties;
  /** What the button says when the file is ready. */
  label?: string;
}

export default function PdfDownload(props: Props) {
  const [attempt, setAttempt] = useState(0);
  const retry = () => {
    /* Safe here and only here: this runs from a click, after the render that
       failed, so no document is in flight to pull the registry out from
       under. */
    registerPdfFonts();
    setAttempt((n) => n + 1);
  };
  return <Attempt key={attempt} {...props} onRetry={retry} />;
}

function Attempt({
  document: doc, fileName, className, style, label = "Download PDF", onRetry,
}: Props & { onRetry(): void }) {
  /* Seeded with the document so the first paint is already "preparing" — read
     without one, the hook reports neither loading nor ready for a frame and
     the button flashes as though the file were in hand. */
  const [instance, update] = usePDF({ document: doc });

  /* The mount effect above has already taken this document; re-taking it here
     would render it twice. Later documents — a report whose result arrived
     after the button did — do need to be picked up. */
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    update(doc);
  }, [doc, update]);

  if (instance.error) {
    return (
      <span className="pdf-dl-fail" role="alert">
        <button type="button" onClick={onRetry} className={className} style={style}>
          Try again
        </button>
        <span className="pdf-dl-msg">
          The PDF could not be built — {reason(instance.error)}
        </span>
        <style>{`
          .pdf-dl-fail{display:inline-flex;align-items:center;gap:10px;flex-wrap:wrap}
          .pdf-dl-msg{font-size:12px;line-height:1.45;color:${FORZA};max-width:44ch}
        `}</style>
      </span>
    );
  }

  /* href only once there is a blob: an anchor whose href is pending is a
     button that looks ready and is not. */
  return instance.url ? (
    <a href={instance.url} download={fileName} className={className} style={style}>
      {label}
    </a>
  ) : (
    /* The caller's own button, dimmed — not restyled. A "preparing" state that
       changes colour reads as a different control rather than the same one
       waiting. */
    <span className={className} style={{ ...style, opacity: 0.55 }} aria-live="polite">
      Preparing PDF…
    </span>
  );
}

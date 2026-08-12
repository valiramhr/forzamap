import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { INK, MUTED, HAIR, PAPER } from "../../lib/ui";

export default function AdminNav() {
  const { signOut } = useAuth();
  const { pathname } = useLocation();
  const link = (to: string, label: string) => (
    <Link to={to} className="font-label" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".07em", textDecoration: "none", color: pathname === to ? INK : MUTED, borderBottom: pathname === to ? `2px solid ${INK}` : "2px solid transparent", paddingBottom: 4 }}>{label}</Link>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, padding: "16px 24px", borderBottom: `1px solid ${HAIR}`, background: PAPER, position: "sticky", top: 0, zIndex: 5 }}>
      {/* 88px is the brand minimum width for the lockup — never render it narrower. */}
      <img src="/brand/forzamap-lockup.svg" alt="ForzaMap" style={{ width: 88, height: "auto", display: "block" }} />
      {link("/admin", "Invite")}
      {link("/admin/candidates", "Candidates")}
      {link("/admin/team", "Team")}
      <button onClick={signOut} className="font-label" style={{ marginLeft: "auto", fontSize: 12, textTransform: "uppercase", letterSpacing: ".07em", color: MUTED, background: "none", border: "none", cursor: "pointer" }}>Sign out</button>
    </div>
  );
}

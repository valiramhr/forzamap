import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { INK, MUTED, HAIR, PAPER } from "../../lib/ui";

export default function AdminNav() {
  const { signOut } = useAuth();
  const { pathname } = useLocation();
  const link = (to: string, label: string) => (
    <Link to={to} className="font-mono" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".05em", textDecoration: "none", color: pathname === to ? INK : MUTED, borderBottom: pathname === to ? `2px solid ${INK}` : "2px solid transparent", paddingBottom: 4 }}>{label}</Link>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, padding: "16px 24px", borderBottom: `1px solid ${HAIR}`, background: PAPER, position: "sticky", top: 0, zIndex: 5 }}>
      {link("/admin", "Invite")}
      {link("/admin/candidates", "Candidates")}
      <button onClick={signOut} className="font-mono" style={{ marginLeft: "auto", fontSize: 12, textTransform: "uppercase", color: MUTED, background: "none", border: "none", cursor: "pointer" }}>Sign out</button>
    </div>
  );
}

import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

function Splash() {
  return <div style={{ padding: 48, fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif", color: "#7A736B" }}>Loading…</div>;
}
export function RequireAuth({ children }: { children: JSX.Element }) {
  const { session, loading } = useAuth();
  if (loading) return <Splash />;
  return session ? children : <Navigate to="/login" replace />;
}
export function RequireAdmin({ children }: { children: JSX.Element }) {
  const { session, isAdmin, loading } = useAuth();
  if (loading) return <Splash />;
  if (!session) return <Navigate to="/login" replace />;
  return isAdmin ? children : <Navigate to="/assessment" replace />;
}

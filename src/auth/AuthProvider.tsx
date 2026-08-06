import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

interface AuthState {
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}
const Ctx = createContext<AuthState>({
  session: null, isAdmin: false, loading: true, signOut: async () => {},
});
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [adminReady, setAdminReady] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setAuthReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession((prev) => prev ?? data.session);
      setAuthReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    let alive = true;
    setAdminReady(false);
    (async () => {
      if (!session) { if (alive) { setIsAdmin(false); setAdminReady(true); } return; }
      const { data } = await supabase
        .from("admins").select("user_id").eq("user_id", session.user.id).maybeSingle();
      if (alive) { setIsAdmin(!!data); setAdminReady(true); }
    })();
    return () => { alive = false; };
  }, [session, authReady]);

  const loading = !authReady || !adminReady;
  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <Ctx.Provider value={{ session, isAdmin, loading, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

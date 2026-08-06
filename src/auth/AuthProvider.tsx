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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!session) { setIsAdmin(false); setLoading(false); return; }
      const { data } = await supabase
        .from("admins").select("user_id").eq("user_id", session.user.id).maybeSingle();
      if (alive) { setIsAdmin(!!data); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [session]);

  const signOut = async () => { await supabase.auth.signOut(); };
  return <Ctx.Provider value={{ session, isAdmin, loading, signOut }}>{children}</Ctx.Provider>;
}

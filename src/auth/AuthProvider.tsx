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

// `resolvedForUserId` is the user id `isAdmin` was looked up for; `undefined` until
// the first lookup settles. Readiness is derived from it rather than stored as its own
// flag, so a session change makes the state not-ready in the very same render.
interface AdminState {
  resolvedForUserId: string | null | undefined;
  isAdmin: boolean;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [admin, setAdmin] = useState<AdminState>({ resolvedForUserId: undefined, isAdmin: false });
  const [authReady, setAuthReady] = useState(false);

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

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!authReady) return;
    if (!userId) { setAdmin({ resolvedForUserId: null, isAdmin: false }); return; }
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("admins").select("user_id").eq("user_id", userId).maybeSingle();
      if (alive) setAdmin({ resolvedForUserId: userId, isAdmin: !!data });
    })();
    return () => { alive = false; };
  }, [userId, authReady]);

  const adminReady = admin.resolvedForUserId === userId;
  const isAdmin = adminReady && admin.isAdmin;
  const loading = !authReady || !adminReady;
  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <Ctx.Provider value={{ session, isAdmin, loading, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

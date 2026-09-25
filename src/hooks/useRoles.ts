import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useRoles() {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<string[] | null>(null);

  useEffect(() => {
    if (!user) {
      if (!authLoading) setRoles([]);
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => setRoles((data ?? []).map((r: any) => r.role)));
  }, [user, authLoading]);

  const has = (...r: string[]) => !!roles?.some((x) => r.includes(x));
  return {
    user,
    loading: authLoading || roles === null,
    roles: roles ?? [],
    isAdmin: has("admin"),
    isOperador: has("admin", "operador"),
    isLogistica: has("admin", "operador", "logistica"),
    isStaff: has("admin", "operador", "logistica", "consulta"),
  };
}

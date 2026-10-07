import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useRoles() {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<string[] | null>(null);
  const [lotacaoUnidadeId, setLotacaoUnidadeId] = useState<string | null>(null);
  const [unidadesAdicionais, setUnidadesAdicionais] = useState<string[]>([]);

  useEffect(() => {
    if (!user) {
      if (!authLoading) {
        setRoles([]);
        setLotacaoUnidadeId(null);
        setUnidadesAdicionais([]);
      }
      return;
    }
    if (!supabase) {
      setRoles([]);
      return;
    }

    // Load roles and lotacao in parallel
    Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("profiles").select("lotacao_unidade_id,unidades_adicionais").eq("id", user.id).single(),
    ]).then(([rolesResult, profileResult]) => {
      setRoles((rolesResult.data ?? []).map((r: any) => r.role));
      if (profileResult.data) {
        setLotacaoUnidadeId(profileResult.data.lotacao_unidade_id ?? null);
        setUnidadesAdicionais(profileResult.data.unidades_adicionais ?? []);
      }
    });
  }, [user, authLoading]);

  const has = (...r: string[]) => !!roles?.some((x) => r.includes(x));
  const isInstituicao = has("instituicao");
  const isPendingUser = isInstituicao && !has("admin", "operador", "logistica", "consulta");
  const isAdmin = has("admin");
  const isOperador = has("admin", "operador");
  const isLogistica = has("admin", "operador", "logistica");
  const isStaff = has("admin", "operador", "logistica", "consulta");

  // All unidades this user can access (for staff: lotacao + adicionais; for admin: all)
  const minhasUnidades: string[] = isAdmin
    ? [] // admin: empty = all (will be resolved as "all" in components)
    : lotacaoUnidadeId
      ? [lotacaoUnidadeId, ...unidadesAdicionais]
      : unidadesAdicionais;

  return {
    user,
    loading: authLoading || roles === null,
    roles: roles ?? [],
    isAdmin,
    isOperador,
    isLogistica,
    isStaff,
    isInstituicao,
    isPendingUser,
    lotacaoUnidadeId,
    unidadesAdicionais,
    minhasUnidades,        // string[] of UUIDs
    isAdminGlobal: isAdmin, // alias
  };
}

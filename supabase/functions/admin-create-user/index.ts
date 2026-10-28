import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Auth check — only admins can create users
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the caller is an admin
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: adminCheck } = await supabase
      .from("user_roles")
      .select("*")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminCheck) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Parse request body
    const body = await req.json();
    const { email, nome, senha, telefone, whatsapp, perfis, lotacao_unidade_id, unidades_adicionais } = body;

    // Validation
    if (!email || !nome || !senha) {
      return new Response(JSON.stringify({ error: "email, nome and senha are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof email !== "string" || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof senha !== "string" || senha.length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Valid perfis
    const VALID_ROLES = ["admin", "operador", "logistica", "consulta"];
    const rolesToAssign: string[] = [];
    if (Array.isArray(perfis)) {
      for (const p of perfis) {
        if (VALID_ROLES.includes(p)) rolesToAssign.push(p);
      }
    }

    // 3. Create the user via Admin API
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true, // Auto-confirm so they can login immediately
      user_metadata: { nome },
    });

    if (createError) {
      // Handle duplicate user
      if (createError.message?.includes("already") || createError.status === 422) {
        return new Response(
          JSON.stringify({
            error: "Usuário já existe com este e-mail",
            code: "USER_EXISTS",
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: createError.message, status: createError.status }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!newUser?.user?.id) {
      return new Response(
        JSON.stringify({ error: "Failed to create user — no ID returned" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = newUser.user.id;

    // 4. Update profile
    const profileData: Record<string, any> = { nome };
    if (telefone) profileData.telefone = telefone;
    if (whatsapp) profileData.whatsapp = whatsapp;
    if (lotacao_unidade_id) profileData.lotacao_unidade_id = lotacao_unidade_id;
    if (unidades_adicionais && unidades_adicionais.length > 0) {
      profileData.unidades_adicionais = unidades_adicionais;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({ id: userId, ...profileData })
      .select();

    if (profileError) {
      // Best effort — log but don't fail
      console.error("Profile upsert failed:", profileError.message);
    }

    // 5. Assign roles
    if (rolesToAssign.length > 0) {
      const roleInserts = rolesToAssign.map((role) => ({
        user_id: userId,
        role,
      }));

      const { error: roleError } = await supabase
        .from("user_roles")
        .upsert(roleInserts, { onConflict: "user_id,role" });

      if (roleError) {
        console.error("Role assignment failed:", roleError.message);
      }
    }

    // 6. Log the action
    try {
      await supabase.from("logs_sistema").insert({
        usuario_id: user.id,
        usuario_nome: user.user_metadata?.nome || "Admin",
        acao: "criou_usuario",
        tabela: "users",
        registro_id: userId,
        detalhes: {
          novo_usuario_email: email,
          novo_usuario_nome: nome,
          perfis_atribuidos: rolesToAssign,
          lotacao_unidade_id: lotacao_unidade_id || null,
        },
      }).catch(() => {});
    } catch {}

    // 7. Return success
    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: userId,
          email: newUser.user.email,
          nome,
          perfis: rolesToAssign,
          lotacao_unidade_id: lotacao_unidade_id || null,
        },
        message: `Usuário ${nome} criado com sucesso. Ele pode fazer login agora.`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("admin-create-user error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

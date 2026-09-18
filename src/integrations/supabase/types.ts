export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agendamentos: {
        Row: {
          created_at: string | null
          data: string
          faixa_etaria: Database["public"]["Enums"]["faixa_etaria"]
          id: string
          instituicao_id: string
          observacoes: string | null
          quantidade_alunos: number
          quantidade_professores: number
          status: Database["public"]["Enums"]["status_agendamento"] | null
          transporte_status:
            | Database["public"]["Enums"]["transporte_status"]
            | null
          turno: Database["public"]["Enums"]["turno"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data: string
          faixa_etaria: Database["public"]["Enums"]["faixa_etaria"]
          id?: string
          instituicao_id: string
          observacoes?: string | null
          quantidade_alunos: number
          quantidade_professores: number
          status?: Database["public"]["Enums"]["status_agendamento"] | null
          transporte_status?:
            | Database["public"]["Enums"]["transporte_status"]
            | null
          turno: Database["public"]["Enums"]["turno"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data?: string
          faixa_etaria?: Database["public"]["Enums"]["faixa_etaria"]
          id?: string
          instituicao_id?: string
          observacoes?: string | null
          quantidade_alunos?: number
          quantidade_professores?: number
          status?: Database["public"]["Enums"]["status_agendamento"] | null
          transporte_status?:
            | Database["public"]["Enums"]["transporte_status"]
            | null
          turno?: Database["public"]["Enums"]["turno"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: false
            referencedRelation: "instituicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      certificados: {
        Row: {
          created_at: string | null
          enviado_para: string | null
          id: string
          instituicao_id: string
          lista_alunos: string | null
          status: Database["public"]["Enums"]["status_certificado"] | null
          tipo: Database["public"]["Enums"]["tipo_certificado"]
          updated_at: string | null
          visita_id: string | null
        }
        Insert: {
          created_at?: string | null
          enviado_para?: string | null
          id?: string
          instituicao_id: string
          lista_alunos?: string | null
          status?: Database["public"]["Enums"]["status_certificado"] | null
          tipo: Database["public"]["Enums"]["tipo_certificado"]
          updated_at?: string | null
          visita_id?: string | null
        }
        Update: {
          created_at?: string | null
          enviado_para?: string | null
          id?: string
          instituicao_id?: string
          lista_alunos?: string | null
          status?: Database["public"]["Enums"]["status_certificado"] | null
          tipo?: Database["public"]["Enums"]["tipo_certificado"]
          updated_at?: string | null
          visita_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificados_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: false
            referencedRelation: "instituicoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificados_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visitas"
            referencedColumns: ["id"]
          },
        ]
      }
      instituicoes: {
        Row: {
          bairro: string | null
          cidade: string
          created_at: string | null
          email: string | null
          endereco: string | null
          id: string
          nome: string
          responsavel: string | null
          telefone: string | null
          tipo: Database["public"]["Enums"]["tipo_instituicao"]
        }
        Insert: {
          bairro?: string | null
          cidade: string
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          responsavel?: string | null
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_instituicao"]
        }
        Update: {
          bairro?: string | null
          cidade?: string
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          responsavel?: string | null
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_instituicao"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          id: string
          instituicao_id: string | null
          nome: string
          telefone: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          instituicao_id?: string | null
          nome: string
          telefone?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          instituicao_id?: string | null
          nome?: string
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: false
            referencedRelation: "instituicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      satisfacao: {
        Row: {
          avaliacao_agendamento: number | null
          avaliacao_educadores: number | null
          avaliacao_evento: number | null
          avaliacao_instalacoes: number | null
          avaliacao_recepcao: number | null
          avaliacao_transporte: number | null
          comentarios: string | null
          created_at: string | null
          id: string
          visita_id: string
        }
        Insert: {
          avaliacao_agendamento?: number | null
          avaliacao_educadores?: number | null
          avaliacao_evento?: number | null
          avaliacao_instalacoes?: number | null
          avaliacao_recepcao?: number | null
          avaliacao_transporte?: number | null
          comentarios?: string | null
          created_at?: string | null
          id?: string
          visita_id: string
        }
        Update: {
          avaliacao_agendamento?: number | null
          avaliacao_educadores?: number | null
          avaliacao_evento?: number | null
          avaliacao_instalacoes?: number | null
          avaliacao_recepcao?: number | null
          avaliacao_transporte?: number | null
          comentarios?: string | null
          created_at?: string | null
          id?: string
          visita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "satisfacao_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visitas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visitas: {
        Row: {
          acompanhantes: number | null
          agendamento_id: string
          confirmado_por_admin: boolean | null
          created_at: string | null
          id: string
          pcds: number | null
          rede: Database["public"]["Enums"]["rede"] | null
          total: number | null
          updated_at: string | null
          visitantes: number | null
        }
        Insert: {
          acompanhantes?: number | null
          agendamento_id: string
          confirmado_por_admin?: boolean | null
          created_at?: string | null
          id?: string
          pcds?: number | null
          rede?: Database["public"]["Enums"]["rede"] | null
          total?: number | null
          updated_at?: string | null
          visitantes?: number | null
        }
        Update: {
          acompanhantes?: number | null
          agendamento_id?: string
          confirmado_por_admin?: boolean | null
          created_at?: string | null
          id?: string
          pcds?: number | null
          rede?: Database["public"]["Enums"]["rede"] | null
          total?: number | null
          updated_at?: string | null
          visitantes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "visitas_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_instituicao_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "instituicao"
      faixa_etaria: "criancas" | "adolescentes" | "adultos" | "idosos"
      rede: "publica" | "privada" | "outra"
      status_agendamento: "pendente" | "confirmado" | "cancelado" | "realizado"
      status_certificado: "pendente" | "enviado"
      tipo_certificado: "escola_amiga" | "carteirinhas"
      tipo_instituicao: "escola" | "empresa" | "orgao_publico" | "outros"
      transporte_status: "onibus_detran" | "proprio"
      turno: "manha" | "tarde"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "instituicao"],
      faixa_etaria: ["criancas", "adolescentes", "adultos", "idosos"],
      rede: ["publica", "privada", "outra"],
      status_agendamento: ["pendente", "confirmado", "cancelado", "realizado"],
      status_certificado: ["pendente", "enviado"],
      tipo_certificado: ["escola_amiga", "carteirinhas"],
      tipo_instituicao: ["escola", "empresa", "orgao_publico", "outros"],
      transporte_status: ["onibus_detran", "proprio"],
      turno: ["manha", "tarde"],
    },
  },
} as const

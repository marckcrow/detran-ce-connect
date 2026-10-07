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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agendamentos: {
        Row: {
          created_at: string | null
          data: string
          faixa_etaria: Database["public"]["Enums"]["faixa_etaria"]
          horario: string | null
          id: string
          instituicao_id: string
          necessidades_especiais: string | null
          observacoes: string | null
          pcd_outros: string | null
          pcd_quantidade: number
          pcd_tipos: string[]
          possui_pcd: boolean
          quantidade_acompanhantes: number
          quantidade_alunos: number
          quantidade_professores: number
          responsavel_nome: string | null
          responsavel_whatsapp: string | null
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
          horario?: string | null
          id?: string
          instituicao_id: string
          necessidades_especiais?: string | null
          observacoes?: string | null
          pcd_outros?: string | null
          pcd_quantidade?: number
          pcd_tipos?: string[]
          possui_pcd?: boolean
          quantidade_acompanhantes?: number
          quantidade_alunos: number
          quantidade_professores: number
          responsavel_nome?: string | null
          responsavel_whatsapp?: string | null
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
          horario?: string | null
          id?: string
          instituicao_id?: string
          necessidades_especiais?: string | null
          observacoes?: string | null
          pcd_outros?: string | null
          pcd_quantidade?: number
          pcd_tipos?: string[]
          possui_pcd?: boolean
          quantidade_acompanhantes?: number
          quantidade_alunos?: number
          quantidade_professores?: number
          responsavel_nome?: string | null
          responsavel_whatsapp?: string | null
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
      atendimentos: {
        Row: {
          acompanhantes: number
          agendamento_id: string
          alunos_atendidos: number
          alunos_previstos: number
          created_at: string
          data_efetiva: string
          faixa_etaria: string | null
          hora_efetiva: string | null
          id: string
          instituicao_id: string
          lanche_entregue: boolean
          lanche_motivo: string | null
          lanches_previstos: number
          lanches_qtd: number
          lanches_restantes: number
          observacoes: string | null
          os_id: string
          pcd_quantidade: number
          pcd_tipos: string[]
          professores_atendidos: number
          professores_previstos: number
          registrado_por: string | null
          registrado_por_nome: string | null
          revistas_devolvidas: number
          revistas_entregues: boolean
          revistas_previstas: number
          revistas_qtd: number
          total_visitantes: number
        }
        Insert: {
          acompanhantes?: number
          agendamento_id: string
          alunos_atendidos: number
          alunos_previstos: number
          created_at?: string
          data_efetiva: string
          faixa_etaria?: string | null
          hora_efetiva?: string | null
          id?: string
          instituicao_id: string
          lanche_entregue?: boolean
          lanche_motivo?: string | null
          lanches_previstos?: number
          lanches_qtd?: number
          lanches_restantes?: number
          observacoes?: string | null
          os_id: string
          pcd_quantidade?: number
          pcd_tipos?: string[]
          professores_atendidos: number
          professores_previstos: number
          registrado_por?: string | null
          registrado_por_nome?: string | null
          revistas_devolvidas?: number
          revistas_entregues?: boolean
          revistas_previstas?: number
          revistas_qtd?: number
          total_visitantes: number
        }
        Update: {
          acompanhantes?: number
          agendamento_id?: string
          alunos_atendidos?: number
          alunos_previstos?: number
          created_at?: string
          data_efetiva?: string
          faixa_etaria?: string | null
          hora_efetiva?: string | null
          id?: string
          instituicao_id?: string
          lanche_entregue?: boolean
          lanche_motivo?: string | null
          lanches_previstos?: number
          lanches_qtd?: number
          lanches_restantes?: number
          observacoes?: string | null
          os_id?: string
          pcd_quantidade?: number
          pcd_tipos?: string[]
          professores_atendidos?: number
          professores_previstos?: number
          registrado_por?: string | null
          registrado_por_nome?: string | null
          revistas_devolvidas?: number
          revistas_entregues?: boolean
          revistas_previstas?: number
          revistas_qtd?: number
          total_visitantes?: number
        }
        Relationships: [
          {
            foreignKeyName: "atendimentos_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: false
            referencedRelation: "instituicoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: true
            referencedRelation: "ordens_servico"
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
      config_sistema: {
        Row: {
          id: number
          limite_km: number
          ponto_saida: string
          updated_at: string
        }
        Insert: {
          id?: number
          limite_km?: number
          ponto_saida?: string
          updated_at?: string
        }
        Update: {
          id?: number
          limite_km?: number
          ponto_saida?: string
          updated_at?: string
        }
        Relationships: []
      }
      estoque_itens: {
        Row: {
          id: string
          nome: string
          quantidade: number
        }
        Insert: {
          id: string
          nome: string
          quantidade?: number
        }
        Update: {
          id?: string
          nome?: string
          quantidade?: number
        }
        Relationships: []
      }
      estoque_movimentos: {
        Row: {
          atendimento_id: string | null
          created_at: string
          id: string
          item_id: string
          motivo: string
          quantidade: number
          saldo_apos: number | null
          tipo: string
          usuario_id: string | null
        }
        Insert: {
          atendimento_id?: string | null
          created_at?: string
          id?: string
          item_id: string
          motivo: string
          quantidade: number
          saldo_apos?: number | null
          tipo: string
          usuario_id?: string | null
        }
        Update: {
          atendimento_id?: string | null
          created_at?: string
          id?: string
          item_id?: string
          motivo?: string
          quantidade?: number
          saldo_apos?: number | null
          tipo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_movimentos_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      importacoes_escolas: {
        Row: {
          arquivo: string
          com_erro: number
          created_at: string
          duplicadas: number
          id: string
          importadas: number
          total_linhas: number
          usuario_id: string
        }
        Insert: {
          arquivo: string
          com_erro?: number
          created_at?: string
          duplicadas?: number
          id?: string
          importadas?: number
          total_linhas?: number
          usuario_id?: string
        }
        Update: {
          arquivo?: string
          com_erro?: number
          created_at?: string
          duplicadas?: number
          id?: string
          importadas?: number
          total_linhas?: number
          usuario_id?: string
        }
        Relationships: []
      }
      instituicoes: {
        Row: {
          alunos_estimados: number | null
          ativa: boolean
          bairro: string | null
          cep: string | null
          cidade: string
          cnpj: string | null
          codigo: string | null
          created_at: string | null
          distancia_km: number | null
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          importacao_id: string | null
          nome: string
          observacoes: string | null
          rede: Database["public"]["Enums"]["rede"] | null
          responsavel: string | null
          responsavel_telefone: string | null
          telefone: string | null
          tipo: Database["public"]["Enums"]["tipo_instituicao"]
        }
        Insert: {
          alunos_estimados?: number | null
          ativa?: boolean
          bairro?: string | null
          cep?: string | null
          cidade: string
          cnpj?: string | null
          codigo?: string | null
          created_at?: string | null
          distancia_km?: number | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          importacao_id?: string | null
          nome: string
          observacoes?: string | null
          rede?: Database["public"]["Enums"]["rede"] | null
          responsavel?: string | null
          responsavel_telefone?: string | null
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_instituicao"]
        }
        Update: {
          alunos_estimados?: number | null
          ativa?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string
          cnpj?: string | null
          codigo?: string | null
          created_at?: string | null
          distancia_km?: number | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          importacao_id?: string | null
          nome?: string
          observacoes?: string | null
          rede?: Database["public"]["Enums"]["rede"] | null
          responsavel?: string | null
          responsavel_telefone?: string | null
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_instituicao"]
        }
        Relationships: []
      }
      ordens_servico: {
        Row: {
          agendamento_id: string
          ano: number
          created_at: string
          created_by: string | null
          destino: string | null
          distancia_km: number | null
          excede_limite: boolean
          id: string
          logistica_status: string
          motorista: string | null
          numero: number | null
          observacoes: string | null
          origem: string | null
          status: Database["public"]["Enums"]["os_status"]
          ultimo_motivo: string | null
          updated_at: string
          unidade_id: string | null
          veiculo: string | null
          whatsapp_envios: number
          whatsapp_ultimo_envio: string | null
        }
        Insert: {
          agendamento_id: string
          ano?: number
          created_at?: string
          created_by?: string | null
          destino?: string | null
          distancia_km?: number | null
          excede_limite?: boolean
          id?: string
          logistica_status?: string
          motorista?: string | null
          numero?: number | null
          observacoes?: string | null
          origem?: string | null
          status?: Database["public"]["Enums"]["os_status"]
          ultimo_motivo?: string | null
          updated_at?: string
          unidade_id?: string | null
          veiculo?: string | null
          whatsapp_envios?: number
          whatsapp_ultimo_envio?: string | null
        }
        Update: {
          agendamento_id?: string
          ano?: number
          created_at?: string
          created_by?: string | null
          destino?: string | null
          distancia_km?: number | null
          excede_limite?: boolean
          id?: string
          logistica_status?: string
          motorista?: string | null
          numero?: number | null
          observacoes?: string | null
          origem?: string | null
          status?: Database["public"]["Enums"]["os_status"]
          ultimo_motivo?: string | null
          updated_at?: string
          unidade_id?: string | null
          veiculo?: string | null
          whatsapp_envios?: number
          whatsapp_ultimo_envio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: true
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      os_historico: {
        Row: {
          campo: string
          created_at: string
          id: string
          motivo: string | null
          os_id: string
          usuario_id: string | null
          usuario_nome: string | null
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          campo: string
          created_at?: string
          id?: string
          motivo?: string | null
          os_id: string
          usuario_id?: string | null
          usuario_nome?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          campo?: string
          created_at?: string
          id?: string
          motivo?: string | null
          os_id?: string
          usuario_id?: string | null
          usuario_nome?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "os_historico_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_transporte: {
        Row: {
          ano: number
          created_at: string
          created_by: string | null
          data_fim: string
          data_inicio: string
          empresa_email: string | null
          empresa_whatsapp: string | null
          id: string
          motivo: string | null
          numero: string
          revisao: number
          rotas: Json
          status: string
          unidade: string
          updated_at: string
        }
        Insert: {
          ano: number
          created_at?: string
          created_by?: string | null
          data_fim: string
          data_inicio: string
          empresa_email?: string | null
          empresa_whatsapp?: string | null
          id?: string
          motivo?: string | null
          numero: string
          revisao?: number
          rotas?: Json
          status?: string
          unidade: string
          updated_at?: string
        }
        Update: {
          ano?: number
          created_at?: string
          created_by?: string | null
          data_fim?: string
          data_inicio?: string
          empresa_email?: string | null
          empresa_whatsapp?: string | null
          id?: string
          motivo?: string | null
          numero?: string
          revisao?: number
          rotas?: Json
          status?: string
          unidade?: string
          updated_at?: string
        }
        Relationships: []
      }
      os_transporte_eventos: {
        Row: {
          acao: string
          created_at: string
          detalhe: string | null
          id: string
          os_transporte_id: string
          revisao: number
          usuario_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhe?: string | null
          id?: string
          os_transporte_id: string
          revisao: number
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhe?: string | null
          id?: string
          os_transporte_id?: string
          revisao?: number
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "os_transporte_eventos_os_transporte_id_fkey"
            columns: ["os_transporte_id"]
            isOneToOne: false
            referencedRelation: "os_transporte"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          id: string
          instituicao_id: string | null
          nome: string
          telefone: string | null
          lotacao_unidade_id: string | null
          unidades_adicionais: string[]
        }
        Insert: {
          created_at?: string | null
          id: string
          instituicao_id?: string | null
          nome: string
          telefone?: string | null
          lotacao_unidade_id?: string | null
          unidades_adicionais?: string[]
        }
        Update: {
          created_at?: string | null
          id?: string
          instituicao_id?: string | null
          nome?: string
          telefone?: string | null
          lotacao_unidade_id?: string | null
          unidades_adicionais?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_instituicao_id_fkey"
            columns: ["instituicao_id"]
            isOneToOne: false
            referencedRelation: "instituicoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_lotacao_unidade_id_fkey"
            columns: ["lotacao_unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
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
      unidades: {
        Row: {
          ativo: boolean
          cidade: string
          created_at: string
          id: string
          macrorregiao: string | null
          nome: string
          sigla: string
        }
        Insert: {
          ativo?: boolean
          cidade: string
          created_at?: string
          id?: string
          macrorregiao?: string | null
          nome: string
          sigla: string
        }
        Update: {
          ativo?: boolean
          cidade?: string
          created_at?: string
          id?: string
          macrorregiao?: string | null
          nome?: string
          sigla?: string
        }
        Relationships: []
      }
      lotacao_audit: {
        Row: {
          alterado_por: string | null
          alterado_por_nome: string | null
          campo: string
          created_at: string
          id: string
          motivo: string | null
          profile_id: string
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          alterado_por?: string | null
          alterado_por_nome?: string | null
          campo: string
          created_at?: string
          id?: string
          motivo?: string | null
          profile_id: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          alterado_por?: string | null
          alterado_por_nome?: string | null
          campo?: string
          created_at?: string
          id?: string
          motivo?: string | null
          profile_id?: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lotacao_audit_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_envios: {
        Row: {
          created_at: string
          id: string
          mensagem: string
          os_id: string
          telefone: string | null
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          mensagem: string
          os_id: string
          telefone?: string | null
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          mensagem?: string
          os_id?: string
          telefone?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_envios_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
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
      is_logistica: { Args: { _uid: string }; Returns: boolean }
      is_operador: { Args: { _uid: string }; Returns: boolean }
      is_staff: { Args: { _uid: string }; Returns: boolean }
      registrar_atendimento: { Args: { p: Json }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "instituicao" | "operador" | "logistica" | "consulta"
      faixa_etaria: "criancas" | "adolescentes" | "adultos" | "idosos"
      os_status:
        | "rascunho"
        | "solicitado"
        | "confirmado"
        | "programado"
        | "em_andamento"
        | "realizado"
        | "cancelado"
        | "nao_realizado"
      rede: "publica" | "privada" | "outra"
      status_agendamento: "pendente" | "confirmado" | "cancelado" | "realizado"
      status_certificado: "pendente" | "enviado"
      tipo_certificado: "escola_amiga" | "carteirinhas"
      tipo_instituicao:
        | "escola"
        | "empresa"
        | "orgao_publico"
        | "outros"
        | "universidade"
        | "ong"
        | "igreja"
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
      app_role: ["admin", "instituicao", "operador", "logistica", "consulta"],
      faixa_etaria: ["criancas", "adolescentes", "adultos", "idosos"],
      os_status: [
        "rascunho",
        "solicitado",
        "confirmado",
        "programado",
        "em_andamento",
        "realizado",
        "cancelado",
        "nao_realizado",
      ],
      rede: ["publica", "privada", "outra"],
      status_agendamento: ["pendente", "confirmado", "cancelado", "realizado"],
      status_certificado: ["pendente", "enviado"],
      tipo_certificado: ["escola_amiga", "carteirinhas"],
      tipo_instituicao: [
        "escola",
        "empresa",
        "orgao_publico",
        "outros",
        "universidade",
        "ong",
        "igreja",
      ],
      transporte_status: ["onibus_detran", "proprio"],
      turno: ["manha", "tarde"],
    },
  },
} as const

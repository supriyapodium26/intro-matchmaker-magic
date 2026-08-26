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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      members: {
        Row: {
          child_status: string | null
          company_size: string | null
          company_size_band: number | null
          company_type: string | null
          countries: string[]
          created_at: string
          dob: string | null
          email: string | null
          expertise: string | null
          icp: string
          icp_flagged: boolean
          icp_source: string | null
          id: string
          interests: string[]
          life_context: string[]
          linkedin: string | null
          name: string
          phone: string | null
          relationship_status: string | null
          role_label: string | null
          role_level: number | null
        }
        Insert: {
          child_status?: string | null
          company_size?: string | null
          company_size_band?: number | null
          company_type?: string | null
          countries?: string[]
          created_at?: string
          dob?: string | null
          email?: string | null
          expertise?: string | null
          icp: string
          icp_flagged?: boolean
          icp_source?: string | null
          id?: string
          interests?: string[]
          life_context?: string[]
          linkedin?: string | null
          name: string
          phone?: string | null
          relationship_status?: string | null
          role_label?: string | null
          role_level?: number | null
        }
        Update: {
          child_status?: string | null
          company_size?: string | null
          company_size_band?: number | null
          company_type?: string | null
          countries?: string[]
          created_at?: string
          dob?: string | null
          email?: string | null
          expertise?: string | null
          icp?: string
          icp_flagged?: boolean
          icp_source?: string | null
          id?: string
          interests?: string[]
          life_context?: string[]
          linkedin?: string | null
          name?: string
          phone?: string | null
          relationship_status?: string | null
          role_label?: string | null
          role_level?: number | null
        }
        Relationships: []
      }
      respondents: {
        Row: {
          birth_year: number | null
          business_type: string | null
          child_status: string | null
          company_size: string | null
          company_size_band: number | null
          company_type: string | null
          completed: boolean
          countries: string[]
          created_at: string
          email: string | null
          expertise: string | null
          founder_tenure: string | null
          gate_answer: string | null
          icp: string | null
          id: string
          interests: string[]
          last_step: string | null
          life_context: string[]
          match_count: number | null
          name: string | null
          open_text: string | null
          phone: string | null
          reroute_answer: string | null
          role_label: string | null
          role_level: number | null
          stage_index: number | null
          stage_label: string | null
          transcript: Json | null
          updated_at: string
          visitor_id: string
        }
        Insert: {
          birth_year?: number | null
          business_type?: string | null
          child_status?: string | null
          company_size?: string | null
          company_size_band?: number | null
          company_type?: string | null
          completed?: boolean
          countries?: string[]
          created_at?: string
          email?: string | null
          expertise?: string | null
          founder_tenure?: string | null
          gate_answer?: string | null
          icp?: string | null
          id?: string
          interests?: string[]
          last_step?: string | null
          life_context?: string[]
          match_count?: number | null
          name?: string | null
          open_text?: string | null
          phone?: string | null
          reroute_answer?: string | null
          role_label?: string | null
          role_level?: number | null
          stage_index?: number | null
          stage_label?: string | null
          transcript?: Json | null
          updated_at?: string
          visitor_id: string
        }
        Update: {
          birth_year?: number | null
          business_type?: string | null
          child_status?: string | null
          company_size?: string | null
          company_size_band?: number | null
          company_type?: string | null
          completed?: boolean
          countries?: string[]
          created_at?: string
          email?: string | null
          expertise?: string | null
          founder_tenure?: string | null
          gate_answer?: string | null
          icp?: string | null
          id?: string
          interests?: string[]
          last_step?: string | null
          life_context?: string[]
          match_count?: number | null
          name?: string | null
          open_text?: string | null
          phone?: string | null
          reroute_answer?: string | null
          role_label?: string | null
          role_level?: number | null
          stage_index?: number | null
          stage_label?: string | null
          transcript?: Json | null
          updated_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

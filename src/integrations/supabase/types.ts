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
      startup_diaries: {
        Row: {
          content: string | null
          created_at: string | null
          diary_date: string
          id: string
          image_paths: string[]
          mood: string | null
          tags: string[]
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          diary_date: string
          id?: string
          image_paths?: string[]
          mood?: string | null
          title: string
          tags?: string[]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          diary_date?: string
          id?: string
          image_paths?: string[]
          mood?: string | null
          tags?: string[]
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      onboarding_profiles: {
        Row: {
          user_id: string
          birth_date: string
          business_name: string | null
          founding_stage: string
          residence_region: string
          business_region: string | null
          industries: string[]
          personal_statuses: string[]
          support_interests: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          birth_date: string
          business_name?: string | null
          founding_stage: string
          residence_region: string
          business_region?: string | null
          industries: string[]
          personal_statuses: string[]
          support_interests?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          birth_date?: string
          business_name?: string | null
          founding_stage?: string
          residence_region?: string
          business_region?: string | null
          industries?: string[]
          personal_statuses?: string[]
          support_interests?: string[]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      onboarding_regions: {
        Row: {
          region_code: string
          region_name: string
          province_name: string
          district_name: string
        }
        Insert: {
          region_code: string
          region_name: string
          province_name: string
          district_name: string
        }
        Update: {
          region_code?: string
          region_name?: string
          province_name?: string
          district_name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          birth_date: string | null
          business_fields: string[]
          business_location: string | null
          created_at: string
          id: string
          is_onboarded: boolean
          residence: string | null
          startup_stage: string | null
          support_categories: string[]
          updated_at: string
          username: string | null
        }
        Insert: {
          birth_date?: string | null
          business_fields?: string[]
          business_location?: string | null
          created_at?: string
          id: string
          is_onboarded?: boolean
          residence?: string | null
          startup_stage?: string | null
          support_categories?: string[]
          updated_at?: string
          username?: string | null
        }
        Update: {
          birth_date?: string | null
          business_fields?: string[]
          business_location?: string | null
          created_at?: string
          id?: string
          is_onboarded?: boolean
          residence?: string | null
          startup_stage?: string | null
          support_categories?: string[]
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_onboarding: {
        Args: {
          p_birth_date: string | null
          p_founding_stage: string | null
          p_residence_region: string | null
          p_business_region: string | null
          p_industries: string[]
          p_personal_statuses: string[]
          p_support_interests?: string[]
          p_business_name?: string | null
        }
        Returns: undefined
      }
      get_my_notice_matches_v1: {
        Args: {
          p_limit: number
          p_offset: number
          p_field: string | null
          p_include_closed: boolean
        }
        Returns: {
          items: Array<{
            notice_id: string
            title: string
            organization: string
            url: string | null
            field: string | null
            region: string | null
            deadline: string | null
            deadline_label: string | null
            recruitment_status: string | null
            status_label: string | null
            days_until_deadline: number | null
            is_closed: boolean
            recommendation_only: boolean
            report_available: boolean
          }>
          total_count: number
          closed_count: number
          limit: number
          offset: number
          has_more: boolean
          matching_job_status: string
          support_filter_ready: boolean
          support_filter: { mode: string; values: string[] }
          default_support_interests: string[]
          evaluated_at: string
        }
      }
      get_my_profile_matching_status_v1: {
        Args: Record<string, never>
        Returns: {
          user_id: string
          status: string
          profile_matches: boolean
          revision: string | number | null
        }
      }
      get_my_excluded_notice_matches_v1: {
        Args: {
          p_limit: number
          p_offset: number
          p_field: string | null
        }
        Returns: {
          items: Array<{
            notice_id: string
            title: string
            organization: string
            url: string | null
            field: string | null
            region: string | null
            deadline: string | null
            deadline_label: string | null
            recruitment_status: string | null
            status_label: string | null
            days_until_deadline: number | null
            is_closed: boolean
            recommendation_only: boolean
            report_available: boolean
          }>
          total_count: number
          excluded_count: number
          limit: number
          offset: number
          has_more: boolean
          matching_job_status: string
          support_filter_ready: boolean
          support_filter: { mode: string; values: string[] }
          default_support_interests: string[]
          evaluated_at: string
        }
      }
      get_my_saved_notice_ids_v1: {
        Args: Record<string, never>
        Returns: {
          items: Array<{
            notice_id: string
          }>
        }
      }
      set_my_notice_saved_v1: {
        Args: {
          p_notice_id: string
          p_saved: boolean
        }
        Returns: {
          notice_id: string
          is_saved: boolean
        }
      }
      get_my_saved_notices_v1: {
        Args: Record<string, never>
        Returns: {
          items: Array<{
            notice_id: string
            title: string
            organization: string
            url: string | null
            field: string | null
            region: string | null
            deadline: string | null
            deadline_label: string | null
            recruitment_status: string | null
            status_label: string | null
            days_until_deadline: number | null
            is_closed: boolean
            is_saved: boolean
          }>
          total_count: number
        }
      }
      get_my_saved_notice_progress_v1: {
        Args: Record<string, never>
        Returns: {
          items: Array<{
            notice_id: string
            status: string
          }>
        }
      }
      set_my_saved_notice_progress_v1: {
        Args: {
          p_notice_id: string
          p_status: string
        }
        Returns: {
          notice_id: string
          status: string
        }
      }
      get_my_notice_report_v1: {
        Args: {
          p_notice_id: string
        }
        Returns: Json
      }
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
    Enums: {},
  },
} as const

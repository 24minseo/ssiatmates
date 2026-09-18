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
      calendar_events: {
        Row: {
          all_day: boolean | null
          color: string | null
          created_at: string | null
          diary_id: string | null
          end_date: string | null
          event_type: string
          id: string
          metadata: Json | null
          program_id: string | null
          start_date: string
          title: string
          updated_at: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          all_day?: boolean | null
          color?: string | null
          created_at?: string | null
          diary_id?: string | null
          end_date?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          program_id?: string | null
          start_date: string
          title: string
          updated_at?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          all_day?: boolean | null
          color?: string | null
          created_at?: string | null
          diary_id?: string | null
          end_date?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          program_id?: string | null
          start_date?: string
          title?: string
          updated_at?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "my_support_programs"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "calendar_events_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_progress: {
        Row: {
          collector_key: string
          last_success_at: string | null
          next_page: number
          page_size: number
          pages_per_run: number
        }
        Insert: {
          collector_key: string
          last_success_at?: string | null
          next_page?: number
          page_size?: number
          pages_per_run?: number
        }
        Update: {
          collector_key?: string
          last_success_at?: string | null
          next_page?: number
          page_size?: number
          pages_per_run?: number
        }
        Relationships: []
      }
      notice_collection_checkpoints: {
        Row: {
          collector_key: string
          completed_at: string | null
          created_at: string
          payload: Json
          run_id: string
        }
        Insert: {
          collector_key: string
          completed_at?: string | null
          created_at?: string
          payload: Json
          run_id: string
        }
        Update: {
          collector_key?: string
          completed_at?: string | null
          created_at?: string
          payload?: Json
          run_id?: string
        }
        Relationships: []
      }
      notice_sources: {
        Row: {
          application_method: string | null
          application_url: string | null
          base_title_key: string | null
          base_title_text: string | null
          content_hash: string | null
          deadline: string | null
          deadline_at: string | null
          excluded_target: string | null
          field: string | null
          first_seen_at: string
          id: string
          last_seen_at: string
          notice_id: string
          notice_route: string | null
          organization: string | null
          published_at: string | null
          raw_content: string | null
          region: string | null
          region_requirements: Json | null
          source: string | null
          source_key: string
          source_modified_at: string | null
          start_at: string | null
          start_date: string | null
          target: string | null
          title: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          application_method?: string | null
          application_url?: string | null
          base_title_key?: string | null
          base_title_text?: string | null
          content_hash?: string | null
          deadline?: string | null
          deadline_at?: string | null
          excluded_target?: string | null
          field?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          notice_id: string
          notice_route?: string | null
          organization?: string | null
          published_at?: string | null
          raw_content?: string | null
          region?: string | null
          region_requirements?: Json | null
          source?: string | null
          source_key: string
          source_modified_at?: string | null
          start_at?: string | null
          start_date?: string | null
          target?: string | null
          title?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          application_method?: string | null
          application_url?: string | null
          base_title_key?: string | null
          base_title_text?: string | null
          content_hash?: string | null
          deadline?: string | null
          deadline_at?: string | null
          excluded_target?: string | null
          field?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          notice_id?: string
          notice_route?: string | null
          organization?: string | null
          published_at?: string | null
          raw_content?: string | null
          region?: string | null
          region_requirements?: Json | null
          source?: string | null
          source_key?: string
          source_modified_at?: string | null
          start_at?: string | null
          start_date?: string | null
          target?: string | null
          title?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notice_sources_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "notices"
            referencedColumns: ["id"]
          },
        ]
      }
      notices: {
        Row: {
          application_method: string | null
          application_url: string | null
          application_urls: Json | null
          canonical_key: string
          content_hash: string | null
          days_until_deadline: number | null
          days_until_start: number | null
          deadline: string | null
          deadline_at: string | null
          deadline_has_time: boolean | null
          deadline_raw: string | null
          dedupe_key: string | null
          duplicate_count: number | null
          excluded_target: string | null
          field: string | null
          first_seen_at: string
          id: string
          is_deadline_soon: boolean | null
          is_duplicate: boolean | null
          is_today_deadline: boolean | null
          last_seen_at: string | null
          notice_id: string | null
          notice_urls: Json | null
          organization: string | null
          published_at: string | null
          raw_content: string | null
          recruitment_status: string | null
          region: string | null
          region_requirements: Json | null
          source: string | null
          source_key: string | null
          source_keys: Json | null
          source_list: Json | null
          start_at: string | null
          start_date: string | null
          start_has_time: boolean | null
          start_raw: string | null
          status_label: string | null
          target: string | null
          timezone: string | null
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          application_method?: string | null
          application_url?: string | null
          application_urls?: Json | null
          canonical_key: string
          content_hash?: string | null
          days_until_deadline?: number | null
          days_until_start?: number | null
          deadline?: string | null
          deadline_at?: string | null
          deadline_has_time?: boolean | null
          deadline_raw?: string | null
          dedupe_key?: string | null
          duplicate_count?: number | null
          excluded_target?: string | null
          field?: string | null
          first_seen_at?: string
          id?: string
          is_deadline_soon?: boolean | null
          is_duplicate?: boolean | null
          is_today_deadline?: boolean | null
          last_seen_at?: string | null
          notice_id?: string | null
          notice_urls?: Json | null
          organization?: string | null
          published_at?: string | null
          raw_content?: string | null
          recruitment_status?: string | null
          region?: string | null
          region_requirements?: Json | null
          source?: string | null
          source_key?: string | null
          source_keys?: Json | null
          source_list?: Json | null
          start_at?: string | null
          start_date?: string | null
          start_has_time?: boolean | null
          start_raw?: string | null
          status_label?: string | null
          target?: string | null
          timezone?: string | null
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          application_method?: string | null
          application_url?: string | null
          application_urls?: Json | null
          canonical_key?: string
          content_hash?: string | null
          days_until_deadline?: number | null
          days_until_start?: number | null
          deadline?: string | null
          deadline_at?: string | null
          deadline_has_time?: boolean | null
          deadline_raw?: string | null
          dedupe_key?: string | null
          duplicate_count?: number | null
          excluded_target?: string | null
          field?: string | null
          first_seen_at?: string
          id?: string
          is_deadline_soon?: boolean | null
          is_duplicate?: boolean | null
          is_today_deadline?: boolean | null
          last_seen_at?: string | null
          notice_id?: string | null
          notice_urls?: Json | null
          organization?: string | null
          published_at?: string | null
          raw_content?: string | null
          recruitment_status?: string | null
          region?: string | null
          region_requirements?: Json | null
          source?: string | null
          source_key?: string | null
          source_keys?: Json | null
          source_list?: Json | null
          start_at?: string | null
          start_date?: string | null
          start_has_time?: boolean | null
          start_raw?: string | null
          status_label?: string | null
          target?: string | null
          timezone?: string | null
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          calendar_event_id: string | null
          created_at: string | null
          id: string
          message: string
          notify_at: string
          program_id: string | null
          sent_at: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          calendar_event_id?: string | null
          created_at?: string | null
          id?: string
          message: string
          notify_at: string
          program_id?: string | null
          sent_at?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          calendar_event_id?: string | null
          created_at?: string | null
          id?: string
          message?: string
          notify_at?: string
          program_id?: string | null
          sent_at?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "my_support_programs"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "notifications_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_profiles: {
        Row: {
          birth_date: string
          business_region: string | null
          created_at: string
          founding_stage: string
          industries: string[]
          personal_statuses: string[]
          residence_region: string
          support_interests: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          birth_date: string
          business_region?: string | null
          created_at?: string
          founding_stage: string
          industries: string[]
          personal_statuses: string[]
          residence_region: string
          support_interests?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          birth_date?: string
          business_region?: string | null
          created_at?: string
          founding_stage?: string
          industries?: string[]
          personal_statuses?: string[]
          residence_region?: string
          support_interests?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_region_exists"
            columns: ["business_region"]
            isOneToOne: false
            referencedRelation: "onboarding_regions"
            referencedColumns: ["region_code"]
          },
          {
            foreignKeyName: "onboarding_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residence_region_exists"
            columns: ["residence_region"]
            isOneToOne: false
            referencedRelation: "onboarding_regions"
            referencedColumns: ["region_code"]
          },
        ]
      }
      onboarding_regions: {
        Row: {
          district_name: string
          province_name: string
          region_code: string
          region_name: string
        }
        Insert: {
          district_name: string
          province_name: string
          region_code: string
          region_name: string
        }
        Update: {
          district_name?: string
          province_name?: string
          region_code?: string
          region_name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          is_onboarded: boolean | null
          username: string | null
        }
        Insert: {
          created_at?: string
          id: string
          is_onboarded?: boolean | null
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_onboarded?: boolean | null
          username?: string | null
        }
        Relationships: []
      }
      program_search_profiles: {
        Row: {
          analysis_status: string
          analyzed_at: string | null
          application_method: string | null
          business_plan_required: boolean | null
          created_at: string
          evidence: Json
          individual_applicable: boolean | null
          pre_startup_applicable: boolean | null
          presentation_required: boolean | null
          program_id: string
          required_document_count: number | null
          team_requirement: boolean | null
          updated_at: string
        }
        Insert: {
          analysis_status?: string
          analyzed_at?: string | null
          application_method?: string | null
          business_plan_required?: boolean | null
          created_at?: string
          evidence?: Json
          individual_applicable?: boolean | null
          pre_startup_applicable?: boolean | null
          presentation_required?: boolean | null
          program_id: string
          required_document_count?: number | null
          team_requirement?: boolean | null
          updated_at?: string
        }
        Update: {
          analysis_status?: string
          analyzed_at?: string | null
          application_method?: string | null
          business_plan_required?: boolean | null
          created_at?: string
          evidence?: Json
          individual_applicable?: boolean | null
          pre_startup_applicable?: boolean | null
          presentation_required?: boolean | null
          program_id?: string
          required_document_count?: number | null
          team_requirement?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_search_profiles_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: true
            referencedRelation: "my_support_programs"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_search_profiles_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: true
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          apply_end_date: string | null
          apply_start_date: string | null
          created_at: string | null
          current_version: number
          description: string | null
          external_id: string | null
          id: string
          organization: string | null
          owner_user_id: string | null
          raw: Json | null
          region: string | null
          source: string
          support_type: string | null
          target: string | null
          title: string
          updated_at: string | null
          url: string | null
        }
        Insert: {
          apply_end_date?: string | null
          apply_start_date?: string | null
          created_at?: string | null
          current_version?: number
          description?: string | null
          external_id?: string | null
          id?: string
          organization?: string | null
          owner_user_id?: string | null
          raw?: Json | null
          region?: string | null
          source: string
          support_type?: string | null
          target?: string | null
          title: string
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          apply_end_date?: string | null
          apply_start_date?: string | null
          created_at?: string | null
          current_version?: number
          description?: string | null
          external_id?: string | null
          id?: string
          organization?: string | null
          owner_user_id?: string | null
          raw?: Json | null
          region?: string | null
          source?: string
          support_type?: string | null
          target?: string | null
          title?: string
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
      saved_programs: {
        Row: {
          created_at: string | null
          id: string
          last_seen_version: number
          program_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_seen_version?: number
          program_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_seen_version?: number
          program_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "my_support_programs"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "saved_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_diaries: {
        Row: {
          content: string | null
          created_at: string | null
          diary_date: string
          id: string
          mood: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          diary_date: string
          id?: string
          mood?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          diary_date?: string
          id?: string
          mood?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      my_support_programs: {
        Row: {
          apply_end_date: string | null
          apply_start_date: string | null
          current_version: number | null
          description: string | null
          organization: string | null
          program_id: string | null
          region: string | null
          source: string | null
          support_type: string | null
          target: string | null
          title: string | null
          url: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      complete_notice_collection: { Args: { p_updates: Json }; Returns: Json }
      complete_onboarding:
        | {
            Args: {
              p_birth_date: string
              p_business_region: string
              p_founding_stage: string
              p_industries: string[]
              p_personal_statuses: string[]
              p_residence_region: string
              p_support_interests?: string[]
            }
            Returns: undefined
          }
        | {
            Args: {
              p_birth_date: string
              p_business_region: string
              p_founding_stage: string
              p_industries: string[]
              p_personal_statuses: string[]
              p_residence_region: string
              p_support_interests: string[]
            }
            Returns: undefined
          }
      find_notice_title_candidates: {
        Args: {
          p_max_results?: number
          p_min_similarity?: number
          p_search_title: string
        }
        Returns: {
          candidate: Json
          title_similarity: number
        }[]
      }
      finish_notice_collection_run: {
        Args: { p_run_id: string }
        Returns: Json
      }
      make_notice_base_title: { Args: { input_title: string }; Returns: string }
      make_notice_base_title_key: {
        Args: { input_title: string }
        Returns: string
      }
      stage_notice_collection: {
        Args: { p_run_id: string; p_update: Json }
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

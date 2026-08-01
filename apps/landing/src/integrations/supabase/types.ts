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
      community_posts: {
        Row: {
          author_avatar_url: string | null
          author_name: string
          body_en: string
          body_id: string
          category: string
          comments: number
          created_at: string
          id: string
          likes: number
          published: boolean
          title_en: string
          title_id: string
          updated_at: string
        }
        Insert: {
          author_avatar_url?: string | null
          author_name?: string
          body_en?: string
          body_id?: string
          category: string
          comments?: number
          created_at?: string
          id?: string
          likes?: number
          published?: boolean
          title_en: string
          title_id: string
          updated_at?: string
        }
        Update: {
          author_avatar_url?: string | null
          author_name?: string
          body_en?: string
          body_id?: string
          category?: string
          comments?: number
          created_at?: string
          id?: string
          likes?: number
          published?: boolean
          title_en?: string
          title_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          access: string
          created_at: string
          description_en: string
          description_id: string
          duration_minutes: number
          id: string
          lessons_count: number
          level: string
          pillar: string
          published: boolean
          slug: string
          sort_order: number
          thumbnail_url: string | null
          title_en: string
          title_id: string
          updated_at: string
        }
        Insert: {
          access?: string
          created_at?: string
          description_en?: string
          description_id?: string
          duration_minutes?: number
          id?: string
          lessons_count?: number
          level: string
          pillar: string
          published?: boolean
          slug: string
          sort_order?: number
          thumbnail_url?: string | null
          title_en: string
          title_id: string
          updated_at?: string
        }
        Update: {
          access?: string
          created_at?: string
          description_en?: string
          description_id?: string
          duration_minutes?: number
          id?: string
          lessons_count?: number
          level?: string
          pillar?: string
          published?: boolean
          slug?: string
          sort_order?: number
          thumbnail_url?: string | null
          title_en?: string
          title_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer_en: string
          answer_id: string
          created_at: string
          id: string
          published: boolean
          question_en: string
          question_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer_en: string
          answer_id: string
          created_at?: string
          id?: string
          published?: boolean
          question_en: string
          question_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer_en?: string
          answer_id?: string
          created_at?: string
          id?: string
          published?: boolean
          question_en?: string
          question_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      learning_assets: {
        Row: {
          access_type: string
          asset_type: string
          audio_url: string | null
          course_id: string | null
          created_at: string
          description_en: string
          description_id: string
          difficulty: string
          duration_minutes: number
          file_url: string | null
          format: string
          id: string
          is_required_for_level_completion: boolean
          lesson_id: string | null
          level: string
          module_id: string | null
          pillar: string
          preview_order: number
          status: string
          tags: Json
          thumbnail_url: string | null
          title_en: string
          title_id: string
          updated_at: string
          video_url: string | null
          worksheet_url: string | null
        }
        Insert: {
          access_type?: string
          asset_type: string
          audio_url?: string | null
          course_id?: string | null
          created_at?: string
          description_en?: string
          description_id?: string
          difficulty?: string
          duration_minutes?: number
          file_url?: string | null
          format?: string
          id?: string
          is_required_for_level_completion?: boolean
          lesson_id?: string | null
          level: string
          module_id?: string | null
          pillar: string
          preview_order?: number
          status?: string
          tags?: Json
          thumbnail_url?: string | null
          title_en: string
          title_id: string
          updated_at?: string
          video_url?: string | null
          worksheet_url?: string | null
        }
        Update: {
          access_type?: string
          asset_type?: string
          audio_url?: string | null
          course_id?: string | null
          created_at?: string
          description_en?: string
          description_id?: string
          difficulty?: string
          duration_minutes?: number
          file_url?: string | null
          format?: string
          id?: string
          is_required_for_level_completion?: boolean
          lesson_id?: string | null
          level?: string
          module_id?: string | null
          pillar?: string
          preview_order?: number
          status?: string
          tags?: Json
          thumbnail_url?: string | null
          title_en?: string
          title_id?: string
          updated_at?: string
          video_url?: string | null
          worksheet_url?: string | null
        }
        Relationships: []
      }
      lessons: {
        Row: {
          course_id: string
          created_at: string
          description_en: string
          description_id: string
          duration_minutes: number
          id: string
          is_required: boolean
          module_id: string
          published: boolean
          slug: string
          sort_order: number
          title_en: string
          title_id: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description_en?: string
          description_id?: string
          duration_minutes?: number
          id?: string
          is_required?: boolean
          module_id: string
          published?: boolean
          slug: string
          sort_order?: number
          title_en: string
          title_id: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description_en?: string
          description_id?: string
          duration_minutes?: number
          id?: string
          is_required?: boolean
          module_id?: string
          published?: boolean
          slug?: string
          sort_order?: number
          title_en?: string
          title_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      level_unlocks: {
        Row: {
          created_at: string
          id: string
          level: string
          parent_id: string
          payment_id: string | null
          status: string
          student_id: string
          unlock_fee_idr: number
          unlocked_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          level: string
          parent_id: string
          payment_id?: string | null
          status?: string
          student_id: string
          unlock_fee_idr?: number
          unlocked_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          parent_id?: string
          payment_id?: string | null
          status?: string
          student_id?: string
          unlock_fee_idr?: number
          unlocked_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      library_items: {
        Row: {
          audience: string
          created_at: string
          description_en: string
          description_id: string
          format: string
          id: string
          language: string
          premium: boolean
          price_addon_idr: number
          published: boolean
          reading_time_minutes: number
          resource_url: string | null
          sort_order: number
          tags: Json
          thumbnail_url: string | null
          title_en: string
          title_id: string
          type: string
          updated_at: string
        }
        Insert: {
          audience: string
          created_at?: string
          description_en?: string
          description_id?: string
          format?: string
          id?: string
          language?: string
          premium?: boolean
          price_addon_idr?: number
          published?: boolean
          reading_time_minutes?: number
          resource_url?: string | null
          sort_order?: number
          tags?: Json
          thumbnail_url?: string | null
          title_en: string
          title_id: string
          type: string
          updated_at?: string
        }
        Update: {
          audience?: string
          created_at?: string
          description_en?: string
          description_id?: string
          format?: string
          id?: string
          language?: string
          premium?: boolean
          price_addon_idr?: number
          published?: boolean
          reading_time_minutes?: number
          resource_url?: string | null
          sort_order?: number
          tags?: Json
          thumbnail_url?: string | null
          title_en?: string
          title_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      memberships: {
        Row: {
          benefits_en: Json
          benefits_id: Json
          created_at: string
          featured: boolean
          id: string
          name_en: string
          name_id: string
          period: string
          price_idr: number
          published: boolean
          slug: string
          sort_order: number
          tagline_en: string
          tagline_id: string
          updated_at: string
        }
        Insert: {
          benefits_en?: Json
          benefits_id?: Json
          created_at?: string
          featured?: boolean
          id?: string
          name_en: string
          name_id: string
          period?: string
          price_idr?: number
          published?: boolean
          slug: string
          sort_order?: number
          tagline_en?: string
          tagline_id?: string
          updated_at?: string
        }
        Update: {
          benefits_en?: Json
          benefits_id?: Json
          created_at?: string
          featured?: boolean
          id?: string
          name_en?: string
          name_id?: string
          period?: string
          price_idr?: number
          published?: boolean
          slug?: string
          sort_order?: number
          tagline_en?: string
          tagline_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      mentors: {
        Row: {
          avatar_url: string | null
          bio_en: string
          bio_id: string
          created_at: string
          expertise: Json
          id: string
          name: string
          published: boolean
          rating: number
          role_en: string
          role_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio_en?: string
          bio_id?: string
          created_at?: string
          expertise?: Json
          id?: string
          name: string
          published?: boolean
          rating?: number
          role_en?: string
          role_id?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio_en?: string
          bio_id?: string
          created_at?: string
          expertise?: Json
          id?: string
          name?: string
          published?: boolean
          rating?: number
          role_en?: string
          role_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      modules: {
        Row: {
          course_id: string
          created_at: string
          description_en: string
          description_id: string
          id: string
          published: boolean
          slug: string
          sort_order: number
          title_en: string
          title_id: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description_en?: string
          description_id?: string
          id?: string
          published?: boolean
          slug: string
          sort_order?: number
          title_en: string
          title_id: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description_en?: string
          description_id?: string
          id?: string
          published?: boolean
          slug?: string
          sort_order?: number
          title_en?: string
          title_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      parent_guides: {
        Row: {
          body_en: string
          body_id: string
          created_at: string
          id: string
          lesson_id: string | null
          level: string
          pillar: string | null
          published: boolean
          reading_time_minutes: number
          sort_order: number
          title_en: string
          title_id: string
          updated_at: string
        }
        Insert: {
          body_en?: string
          body_id?: string
          created_at?: string
          id?: string
          lesson_id?: string | null
          level: string
          pillar?: string | null
          published?: boolean
          reading_time_minutes?: number
          sort_order?: number
          title_en: string
          title_id: string
          updated_at?: string
        }
        Update: {
          body_en?: string
          body_id?: string
          created_at?: string
          id?: string
          lesson_id?: string | null
          level?: string
          pillar?: string | null
          published?: boolean
          reading_time_minutes?: number
          sort_order?: number
          title_en?: string
          title_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_idr: number
          created_at: string
          id: string
          method: string | null
          paid_at: string | null
          parent_id: string
          provider: string | null
          provider_reference: string | null
          purpose: string
          status: string
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          amount_idr?: number
          created_at?: string
          id?: string
          method?: string | null
          paid_at?: string | null
          parent_id: string
          provider?: string | null
          provider_reference?: string | null
          purpose?: string
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_idr?: number
          created_at?: string
          id?: string
          method?: string | null
          paid_at?: string | null
          parent_id?: string
          provider?: string | null
          provider_reference?: string | null
          purpose?: string
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pricing_settings: {
        Row: {
          annual_dev_fee_idr: number
          benefits_en: Json
          benefits_id: Json
          id: string
          monthly_price_idr: number
          payment_notes_en: string | null
          payment_notes_id: string | null
          updated_at: string
        }
        Insert: {
          annual_dev_fee_idr?: number
          benefits_en?: Json
          benefits_id?: Json
          id?: string
          monthly_price_idr?: number
          payment_notes_en?: string | null
          payment_notes_id?: string | null
          updated_at?: string
        }
        Update: {
          annual_dev_fee_idr?: number
          benefits_en?: Json
          benefits_id?: Json
          id?: string
          monthly_price_idr?: number
          payment_notes_en?: string | null
          payment_notes_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          city: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      site_content: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      student_progress: {
        Row: {
          asset_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          lesson_id: string | null
          level: string
          parent_id: string
          progress: number
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          lesson_id?: string | null
          level: string
          parent_id: string
          progress?: number
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          lesson_id?: string | null
          level?: string
          parent_id?: string
          progress?: number
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          active_level: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          parent_id: string
          plan: string
          price_idr: number
          provider: string | null
          provider_subscription_id: string | null
          seats: number
          status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          active_level?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          parent_id: string
          plan?: string
          price_idr?: number
          provider?: string | null
          provider_subscription_id?: string | null
          seats?: number
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          active_level?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          parent_id?: string
          plan?: string
          price_idr?: number
          provider?: string | null
          provider_subscription_id?: string | null
          seats?: number
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          location: string | null
          name: string
          published: boolean
          quote_en: string
          quote_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          location?: string | null
          name: string
          published?: boolean
          quote_en: string
          quote_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          published?: boolean
          quote_en?: string
          quote_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "parent" | "student"
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
    Enums: {
      app_role: ["admin", "parent", "student"],
    },
  },
} as const

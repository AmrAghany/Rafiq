export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      ai_usage: {
        Row: {
          feature: Database['public']['Enums']['ai_feature'];
          request_count: number;
          usage_date: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          feature: Database['public']['Enums']['ai_feature'];
          request_count?: number;
          usage_date?: string;
          user_id: string;
        };
        Update: {
          feature?: Database['public']['Enums']['ai_feature'];
          request_count?: number;
          usage_date?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      body_scans: {
        Row: {
          ai_extracted: Json | null;
          bmr_kcal: number | null;
          body_fat_pct: number | null;
          confirmed_at: string | null;
          created_at: string;
          id: string;
          photo_path: string | null;
          scanned_on: string;
          skeletal_muscle_kg: number | null;
          source: Database['public']['Enums']['scan_source'];
          user_id: string;
          weight_kg: number | null;
        };
        ComputedFields: never;
        Insert: {
          ai_extracted?: Json | null;
          bmr_kcal?: number | null;
          body_fat_pct?: number | null;
          confirmed_at?: string | null;
          created_at?: string;
          id?: string;
          photo_path?: string | null;
          scanned_on?: string;
          skeletal_muscle_kg?: number | null;
          source: Database['public']['Enums']['scan_source'];
          user_id: string;
          weight_kg?: number | null;
        };
        Update: {
          ai_extracted?: Json | null;
          bmr_kcal?: number | null;
          body_fat_pct?: number | null;
          confirmed_at?: string | null;
          created_at?: string;
          id?: string;
          photo_path?: string | null;
          scanned_on?: string;
          skeletal_muscle_kg?: number | null;
          source?: Database['public']['Enums']['scan_source'];
          user_id?: string;
          weight_kg?: number | null;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          input_tokens: number | null;
          model: string | null;
          output_tokens: number | null;
          role: Database['public']['Enums']['chat_role'];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          input_tokens?: number | null;
          model?: string | null;
          output_tokens?: number | null;
          role: Database['public']['Enums']['chat_role'];
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          input_tokens?: number | null;
          model?: string | null;
          output_tokens?: number | null;
          role?: Database['public']['Enums']['chat_role'];
          user_id?: string;
        };
        Relationships: [];
      };
      daily_logs: {
        Row: {
          checkin: Json | null;
          completed_items: string[];
          created_at: string;
          id: string;
          log_date: string;
          readiness_score: number | null;
          updated_at: string;
          user_id: string;
          water_glasses: number;
        };
        ComputedFields: never;
        Insert: {
          checkin?: Json | null;
          completed_items?: string[];
          created_at?: string;
          id?: string;
          log_date: string;
          readiness_score?: number | null;
          updated_at?: string;
          user_id: string;
          water_glasses?: number;
        };
        Update: {
          checkin?: Json | null;
          completed_items?: string[];
          created_at?: string;
          id?: string;
          log_date?: string;
          readiness_score?: number | null;
          updated_at?: string;
          user_id?: string;
          water_glasses?: number;
        };
        Relationships: [];
      };
      exercises: {
        Row: {
          alternative_key: string | null;
          bodyweight_ratio: number;
          created_at: string;
          is_compound: boolean;
          is_per_hand: boolean;
          key: string;
          name_ar: string;
          name_en: string;
          progression_kg: number;
          smart_station: string | null;
          timed_seconds: number | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          alternative_key?: string | null;
          bodyweight_ratio?: number;
          created_at?: string;
          is_compound?: boolean;
          is_per_hand?: boolean;
          key: string;
          name_ar: string;
          name_en: string;
          progression_kg?: number;
          smart_station?: string | null;
          timed_seconds?: number | null;
          updated_at?: string;
        };
        Update: {
          alternative_key?: string | null;
          bodyweight_ratio?: number;
          created_at?: string;
          is_compound?: boolean;
          is_per_hand?: boolean;
          key?: string;
          name_ar?: string;
          name_en?: string;
          progression_kg?: number;
          smart_station?: string | null;
          timed_seconds?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'exercises_alternative_key_fkey';
            columns: ['alternative_key'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['key'];
          },
        ];
      };
      meal_logs: {
        Row: {
          ai_estimate: Json | null;
          carbs_g: number | null;
          created_at: string;
          eaten_at: string;
          fat_g: number | null;
          id: string;
          kcal: number | null;
          log_date: string;
          name: string;
          photo_path: string | null;
          protein_g: number | null;
          slot: string | null;
          source: Database['public']['Enums']['meal_source'];
          template_key: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          ai_estimate?: Json | null;
          carbs_g?: number | null;
          created_at?: string;
          eaten_at?: string;
          fat_g?: number | null;
          id?: string;
          kcal?: number | null;
          log_date: string;
          name: string;
          photo_path?: string | null;
          protein_g?: number | null;
          slot?: string | null;
          source: Database['public']['Enums']['meal_source'];
          template_key?: string | null;
          user_id: string;
        };
        Update: {
          ai_estimate?: Json | null;
          carbs_g?: number | null;
          created_at?: string;
          eaten_at?: string;
          fat_g?: number | null;
          id?: string;
          kcal?: number | null;
          log_date?: string;
          name?: string;
          photo_path?: string | null;
          protein_g?: number | null;
          slot?: string | null;
          source?: Database['public']['Enums']['meal_source'];
          template_key?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'meal_logs_template_key_fkey';
            columns: ['template_key'];
            isOneToOne: false;
            referencedRelation: 'meal_templates';
            referencedColumns: ['key'];
          },
        ];
      };
      meal_templates: {
        Row: {
          carbs_g: number | null;
          created_at: string;
          day_type: Database['public']['Enums']['day_type'];
          description_ar: string | null;
          description_en: string | null;
          fat_g: number | null;
          id: string;
          is_ramadan: boolean;
          kcal: number | null;
          key: string | null;
          name_ar: string;
          name_en: string;
          protein_g: number | null;
          ramadan_slot: string | null;
          region: string | null;
          share: number | null;
          slot: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          carbs_g?: number | null;
          created_at?: string;
          day_type: Database['public']['Enums']['day_type'];
          description_ar?: string | null;
          description_en?: string | null;
          fat_g?: number | null;
          id?: string;
          is_ramadan?: boolean;
          kcal?: number | null;
          key?: string | null;
          name_ar: string;
          name_en: string;
          protein_g?: number | null;
          ramadan_slot?: string | null;
          region?: string | null;
          share?: number | null;
          slot: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          carbs_g?: number | null;
          created_at?: string;
          day_type?: Database['public']['Enums']['day_type'];
          description_ar?: string | null;
          description_en?: string | null;
          fat_g?: number | null;
          id?: string;
          is_ramadan?: boolean;
          kcal?: number | null;
          key?: string | null;
          name_ar?: string;
          name_en?: string;
          protein_g?: number | null;
          ramadan_slot?: string | null;
          region?: string | null;
          share?: number | null;
          slot?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      plans: {
        Row: {
          body_scan_id: string | null;
          created_at: string;
          engine_version: string;
          id: string;
          inputs: NonNullable<Json>;
          is_active: boolean;
          plan: NonNullable<Json>;
          user_id: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          body_scan_id?: string | null;
          created_at?: string;
          engine_version: string;
          id?: string;
          inputs: NonNullable<Json>;
          is_active?: boolean;
          plan: NonNullable<Json>;
          user_id: string;
          version: number;
        };
        Update: {
          body_scan_id?: string | null;
          created_at?: string;
          engine_version?: string;
          id?: string;
          inputs?: NonNullable<Json>;
          is_active?: boolean;
          plan?: NonNullable<Json>;
          user_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'plans_body_scan_id_fkey';
            columns: ['body_scan_id'];
            isOneToOne: false;
            referencedRelation: 'body_scans';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          date_of_birth: string | null;
          display_name: string | null;
          experience: Database['public']['Enums']['experience'] | null;
          goal: Database['public']['Enums']['goal'] | null;
          health_flags: Database['public']['Enums']['health_flag'][];
          height_cm: number | null;
          id: string;
          locale: string;
          medical_notice_accepted_at: string | null;
          onboarding_completed_at: string | null;
          ramadan_mode: boolean;
          sex: Database['public']['Enums']['sex'] | null;
          timezone: string;
          training_days: number | null;
          units: string;
          updated_at: string;
          wake_time: string;
          weight_kg: number | null;
          workout_time: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          date_of_birth?: string | null;
          display_name?: string | null;
          experience?: Database['public']['Enums']['experience'] | null;
          goal?: Database['public']['Enums']['goal'] | null;
          health_flags?: Database['public']['Enums']['health_flag'][];
          height_cm?: number | null;
          id: string;
          locale?: string;
          medical_notice_accepted_at?: string | null;
          onboarding_completed_at?: string | null;
          ramadan_mode?: boolean;
          sex?: Database['public']['Enums']['sex'] | null;
          timezone?: string;
          training_days?: number | null;
          units?: string;
          updated_at?: string;
          wake_time?: string;
          weight_kg?: number | null;
          workout_time?: string;
        };
        Update: {
          created_at?: string;
          date_of_birth?: string | null;
          display_name?: string | null;
          experience?: Database['public']['Enums']['experience'] | null;
          goal?: Database['public']['Enums']['goal'] | null;
          health_flags?: Database['public']['Enums']['health_flag'][];
          height_cm?: number | null;
          id?: string;
          locale?: string;
          medical_notice_accepted_at?: string | null;
          onboarding_completed_at?: string | null;
          ramadan_mode?: boolean;
          sex?: Database['public']['Enums']['sex'] | null;
          timezone?: string;
          training_days?: number | null;
          units?: string;
          updated_at?: string;
          wake_time?: string;
          weight_kg?: number | null;
          workout_time?: string;
        };
        Relationships: [];
      };
      set_logs: {
        Row: {
          actual_reps: number | null;
          actual_weight_kg: number | null;
          completed: boolean;
          completed_at: string | null;
          created_at: string;
          exercise_key: string;
          id: string;
          session_id: string;
          set_number: number;
          swapped_from_key: string | null;
          target_reps: number | null;
          target_weight_kg: number | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          actual_reps?: number | null;
          actual_weight_kg?: number | null;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          exercise_key: string;
          id?: string;
          session_id: string;
          set_number: number;
          swapped_from_key?: string | null;
          target_reps?: number | null;
          target_weight_kg?: number | null;
          user_id: string;
        };
        Update: {
          actual_reps?: number | null;
          actual_weight_kg?: number | null;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          exercise_key?: string;
          id?: string;
          session_id?: string;
          set_number?: number;
          swapped_from_key?: string | null;
          target_reps?: number | null;
          target_weight_kg?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'set_logs_exercise_key_fkey';
            columns: ['exercise_key'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'set_logs_session_id_user_id_fkey';
            columns: ['session_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'workout_sessions';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'set_logs_swapped_from_key_fkey';
            columns: ['swapped_from_key'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['key'];
          },
        ];
      };
      subscriptions: {
        Row: {
          current_period_ends_at: string | null;
          is_trial: boolean;
          product_id: string | null;
          raw_event: Json | null;
          revenuecat_app_user_id: string | null;
          status: string;
          store: string | null;
          tier: Database['public']['Enums']['subscription_tier'];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          current_period_ends_at?: string | null;
          is_trial?: boolean;
          product_id?: string | null;
          raw_event?: Json | null;
          revenuecat_app_user_id?: string | null;
          status?: string;
          store?: string | null;
          tier?: Database['public']['Enums']['subscription_tier'];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          current_period_ends_at?: string | null;
          is_trial?: boolean;
          product_id?: string | null;
          raw_event?: Json | null;
          revenuecat_app_user_id?: string | null;
          status?: string;
          store?: string | null;
          tier?: Database['public']['Enums']['subscription_tier'];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      workout_sessions: {
        Row: {
          completed_at: string | null;
          created_at: string;
          id: string;
          log_date: string;
          notes: string | null;
          plan_id: string | null;
          readiness_score: number | null;
          started_at: string;
          swaps: NonNullable<Json>;
          user_id: string;
          workout_key: string;
        };
        ComputedFields: never;
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          log_date: string;
          notes?: string | null;
          plan_id?: string | null;
          readiness_score?: number | null;
          started_at?: string;
          swaps?: NonNullable<Json>;
          user_id: string;
          workout_key: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          log_date?: string;
          notes?: string | null;
          plan_id?: string | null;
          readiness_score?: number | null;
          started_at?: string;
          swaps?: NonNullable<Json>;
          user_id?: string;
          workout_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_sessions_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plans';
            referencedColumns: ['id'];
          },
        ];
      };
      workout_templates: {
        Row: {
          created_at: string;
          exercise_keys: string[];
          key: string;
          name_ar: string;
          name_en: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          exercise_keys: string[];
          key: string;
          name_ar: string;
          name_en: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          exercise_keys?: string[];
          key?: string;
          name_ar?: string;
          name_en?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      complete_onboarding: {
        Args: {
          p_engine_version: string;
          p_plan: Json;
          p_plan_inputs: Json;
          p_profile: Json;
          p_scan: Json;
        };
        Returns: string;
      };
      current_tier: {
        Args: { p_user_id: string };
        Returns: Database['public']['Enums']['subscription_tier'];
      };
    };
    Enums: {
      ai_feature: 'coach_chat' | 'meal_estimate' | 'scan_read';
      chat_role: 'user' | 'assistant';
      day_type: 'high' | 'medium' | 'low';
      experience: 'beginner' | 'intermediate' | 'advanced';
      goal: 'lose' | 'build' | 'recomp';
      health_flag: 'injury' | 'heart' | 'diabetes' | 'pregnancy' | 'eating_disorder';
      meal_source: 'plan' | 'text' | 'photo' | 'manual';
      scan_source: 'manual' | 'photo';
      sex: 'male' | 'female';
      subscription_tier: 'free' | 'pro' | 'elite';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      ai_feature: ['coach_chat', 'meal_estimate', 'scan_read'],
      chat_role: ['user', 'assistant'],
      day_type: ['high', 'medium', 'low'],
      experience: ['beginner', 'intermediate', 'advanced'],
      goal: ['lose', 'build', 'recomp'],
      health_flag: ['injury', 'heart', 'diabetes', 'pregnancy', 'eating_disorder'],
      meal_source: ['plan', 'text', 'photo', 'manual'],
      scan_source: ['manual', 'photo'],
      sex: ['male', 'female'],
      subscription_tier: ['free', 'pro', 'elite'],
    },
  },
} as const;

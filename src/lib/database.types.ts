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
      coach_reviews: {
        Row: {
          claimed_at: string | null;
          coach_id: string | null;
          coach_name: string | null;
          delivered_at: string | null;
          focus: string | null;
          id: string;
          member_id: string;
          member_note: string | null;
          nutrition: string | null;
          period: string;
          read_at: string | null;
          requested_at: string;
          status: Database['public']['Enums']['review_status'];
          summary: string | null;
          training: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          claimed_at?: string | null;
          coach_id?: string | null;
          coach_name?: string | null;
          delivered_at?: string | null;
          focus?: string | null;
          id?: string;
          member_id: string;
          member_note?: string | null;
          nutrition?: string | null;
          period: string;
          read_at?: string | null;
          requested_at?: string;
          status?: Database['public']['Enums']['review_status'];
          summary?: string | null;
          training?: string | null;
          updated_at?: string;
        };
        Update: {
          claimed_at?: string | null;
          coach_id?: string | null;
          coach_name?: string | null;
          delivered_at?: string | null;
          focus?: string | null;
          id?: string;
          member_id?: string;
          member_note?: string | null;
          nutrition?: string | null;
          period?: string;
          read_at?: string | null;
          requested_at?: string;
          status?: Database['public']['Enums']['review_status'];
          summary?: string | null;
          training?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'coach_reviews_coach_id_fkey';
            columns: ['coach_id'];
            isOneToOne: false;
            referencedRelation: 'staff';
            referencedColumns: ['user_id'];
          },
        ];
      };
      daily_logs: {
        Row: {
          checkin: Json | null;
          completed_items: string[];
          created_at: string;
          health_source: string | null;
          health_synced_at: string | null;
          id: string;
          log_date: string;
          readiness_score: number | null;
          sleep_minutes: number | null;
          steps: number | null;
          updated_at: string;
          user_id: string;
          water_glasses: number;
        };
        ComputedFields: never;
        Insert: {
          checkin?: Json | null;
          completed_items?: string[];
          created_at?: string;
          health_source?: string | null;
          health_synced_at?: string | null;
          id?: string;
          log_date: string;
          readiness_score?: number | null;
          sleep_minutes?: number | null;
          steps?: number | null;
          updated_at?: string;
          user_id: string;
          water_glasses?: number;
        };
        Update: {
          checkin?: Json | null;
          completed_items?: string[];
          created_at?: string;
          health_source?: string | null;
          health_synced_at?: string | null;
          id?: string;
          log_date?: string;
          readiness_score?: number | null;
          sleep_minutes?: number | null;
          steps?: number | null;
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
          iftar_time: string;
          locale: string;
          medical_notice_accepted_at: string | null;
          onboarding_completed_at: string | null;
          ramadan_mode: boolean;
          sex: Database['public']['Enums']['sex'] | null;
          suhoor_time: string;
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
          iftar_time?: string;
          locale?: string;
          medical_notice_accepted_at?: string | null;
          onboarding_completed_at?: string | null;
          ramadan_mode?: boolean;
          sex?: Database['public']['Enums']['sex'] | null;
          suhoor_time?: string;
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
          iftar_time?: string;
          locale?: string;
          medical_notice_accepted_at?: string | null;
          onboarding_completed_at?: string | null;
          ramadan_mode?: boolean;
          sex?: Database['public']['Enums']['sex'] | null;
          suhoor_time?: string;
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
          source: string;
          station_id: string | null;
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
          source?: string;
          station_id?: string | null;
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
          source?: string;
          station_id?: string | null;
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
            foreignKeyName: 'set_logs_station_id_fkey';
            columns: ['station_id'];
            isOneToOne: false;
            referencedRelation: 'stations';
            referencedColumns: ['id'];
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
      staff: {
        Row: {
          created_at: string;
          display_name: string;
          role: Database['public']['Enums']['staff_role'];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          display_name: string;
          role?: Database['public']['Enums']['staff_role'];
          user_id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          role?: Database['public']['Enums']['staff_role'];
          user_id?: string;
        };
        Relationships: [];
      };
      station_events: {
        Row: {
          event_id: string;
          received_at: string;
          set_log_id: string | null;
          station_id: string;
        };
        ComputedFields: never;
        Insert: {
          event_id: string;
          received_at?: string;
          set_log_id?: string | null;
          station_id: string;
        };
        Update: {
          event_id?: string;
          received_at?: string;
          set_log_id?: string | null;
          station_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'station_events_set_log_id_fkey';
            columns: ['set_log_id'];
            isOneToOne: false;
            referencedRelation: 'set_logs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'station_events_station_id_fkey';
            columns: ['station_id'];
            isOneToOne: false;
            referencedRelation: 'stations';
            referencedColumns: ['id'];
          },
        ];
      };
      station_pairings: {
        Row: {
          code: string;
          code_expires_at: string;
          created_at: string;
          ended_at: string | null;
          ends_at: string | null;
          id: string;
          paired_at: string | null;
          station_id: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          code_expires_at: string;
          created_at?: string;
          ended_at?: string | null;
          ends_at?: string | null;
          id?: string;
          paired_at?: string | null;
          station_id: string;
          user_id?: string | null;
        };
        Update: {
          code?: string;
          code_expires_at?: string;
          created_at?: string;
          ended_at?: string | null;
          ends_at?: string | null;
          id?: string;
          paired_at?: string | null;
          station_id?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'station_pairings_station_id_fkey';
            columns: ['station_id'];
            isOneToOne: false;
            referencedRelation: 'stations';
            referencedColumns: ['id'];
          },
        ];
      };
      stations: {
        Row: {
          active: boolean;
          created_at: string;
          exercise_keys: string[];
          gym_name: string;
          id: string;
          label: string;
          secret: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          exercise_keys: string[];
          gym_name: string;
          id: string;
          label: string;
          secret: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          exercise_keys?: string[];
          gym_name?: string;
          id?: string;
          label?: string;
          secret?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          current_period_ends_at: string | null;
          is_trial: boolean;
          management_url: string | null;
          product_id: string | null;
          raw_event: Json | null;
          revenuecat_app_user_id: string | null;
          status: string;
          store: string | null;
          synced_at: string | null;
          tier: Database['public']['Enums']['subscription_tier'];
          updated_at: string;
          user_id: string;
          will_renew: boolean;
        };
        ComputedFields: never;
        Insert: {
          current_period_ends_at?: string | null;
          is_trial?: boolean;
          management_url?: string | null;
          product_id?: string | null;
          raw_event?: Json | null;
          revenuecat_app_user_id?: string | null;
          status?: string;
          store?: string | null;
          synced_at?: string | null;
          tier?: Database['public']['Enums']['subscription_tier'];
          updated_at?: string;
          user_id: string;
          will_renew?: boolean;
        };
        Update: {
          current_period_ends_at?: string | null;
          is_trial?: boolean;
          management_url?: string | null;
          product_id?: string | null;
          raw_event?: Json | null;
          revenuecat_app_user_id?: string | null;
          status?: string;
          store?: string | null;
          synced_at?: string | null;
          tier?: Database['public']['Enums']['subscription_tier'];
          updated_at?: string;
          user_id?: string;
          will_renew?: boolean;
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
      claim_coach_review: { Args: { p_id: string }; Returns: undefined };
      coach_review_bundle: { Args: { p_id: string }; Returns: Json };
      coach_review_queue: {
        Args: Record<PropertyKey, never>;
        Returns: {
          claimed_at: string;
          delivered_at: string;
          id: string;
          is_mine: boolean;
          member_first_name: string;
          member_note: string;
          period: string;
          requested_at: string;
          status: Database['public']['Enums']['review_status'];
        }[];
      };
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
      consume_ai_quota: {
        Args: {
          p_feature: Database['public']['Enums']['ai_feature'];
          p_limit: number;
          p_user_id: string;
        };
        Returns: number;
      };
      current_tier: {
        Args: { p_user_id: string };
        Returns: Database['public']['Enums']['subscription_tier'];
      };
      end_station_pairing: { Args: Record<PropertyKey, never>; Returns: undefined };
      is_coach: { Args: Record<PropertyKey, never>; Returns: boolean };
      mark_coach_review_read: { Args: { p_id: string }; Returns: undefined };
      my_coach_reviews: {
        Args: Record<PropertyKey, never>;
        Returns: {
          coach_name: string;
          delivered_at: string;
          focus: string;
          id: string;
          member_note: string;
          nutrition: string;
          period: string;
          read_at: string;
          requested_at: string;
          status: Database['public']['Enums']['review_status'];
          summary: string;
          training: string;
        }[];
      };
      my_station_pairing: { Args: Record<PropertyKey, never>; Returns: Json };
      pair_station: { Args: { p_code: string }; Returns: Json };
      record_scan: {
        Args: { p_engine_version: string; p_plan: Json; p_plan_inputs: Json; p_scan: Json };
        Returns: string;
      };
      refund_ai_quota: {
        Args: { p_feature: Database['public']['Enums']['ai_feature']; p_user_id: string };
        Returns: undefined;
      };
      release_coach_review: { Args: { p_id: string }; Returns: undefined };
      request_coach_review: { Args: { p_note: string }; Returns: string };
      save_coach_review: {
        Args: {
          p_deliver: boolean;
          p_focus: string;
          p_id: string;
          p_nutrition: string;
          p_summary: string;
          p_training: string;
        };
        Returns: undefined;
      };
      station_end_pairing: { Args: { p_station_id: string }; Returns: undefined };
      station_log_set: {
        Args: {
          p_event_id: string;
          p_exercise_key: string;
          p_performed_at: string;
          p_reps: number;
          p_station_id: string;
          p_weight_kg: number;
        };
        Returns: Json;
      };
      station_pairing_code: { Args: { p_station_id: string }; Returns: Json };
    };
    Enums: {
      ai_feature: 'coach_chat' | 'meal_estimate' | 'scan_read';
      chat_role: 'user' | 'assistant';
      day_type: 'high' | 'medium' | 'low';
      experience: 'beginner' | 'intermediate' | 'advanced';
      goal: 'lose' | 'build' | 'recomp';
      health_flag: 'injury' | 'heart' | 'diabetes' | 'pregnancy' | 'eating_disorder';
      meal_source: 'plan' | 'text' | 'photo' | 'manual';
      review_status: 'requested' | 'in_review' | 'delivered';
      scan_source: 'manual' | 'photo';
      sex: 'male' | 'female';
      staff_role: 'coach' | 'admin';
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
      review_status: ['requested', 'in_review', 'delivered'],
      scan_source: ['manual', 'photo'],
      sex: ['male', 'female'],
      staff_role: ['coach', 'admin'],
      subscription_tier: ['free', 'pro', 'elite'],
    },
  },
} as const;

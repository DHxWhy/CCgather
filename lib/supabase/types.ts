// =====================================================
// CCgather Database Types
// Auto-generated types for Supabase
// =====================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          clerk_id: string;
          github_id: string | null;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          email: string | null;
          country_code: string | null;
          timezone: string;
          total_tokens: number;
          total_cost: number;
          current_level: number;
          global_rank: number | null;
          country_rank: number | null;
          primary_model: string | null;
          primary_model_updated_at: string | null;
          created_at: string;
          updated_at: string;
          last_submission_at: string | null;
          auto_sync_enabled: boolean;
          profile_visible: boolean;
          onboarding_completed: boolean;
          api_key: string | null;
        };
        Insert: {
          id?: string;
          clerk_id: string;
          github_id?: string | null;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          email?: string | null;
          country_code?: string | null;
          timezone?: string;
          total_tokens?: number;
          total_cost?: number;
          current_level?: number;
          global_rank?: number | null;
          country_rank?: number | null;
          primary_model?: string | null;
          primary_model_updated_at?: string | null;
          created_at?: string;
          updated_at?: string;
          last_submission_at?: string | null;
          auto_sync_enabled?: boolean;
          profile_visible?: boolean;
          onboarding_completed?: boolean;
          api_key?: string | null;
        };
        Update: {
          id?: string;
          clerk_id?: string;
          github_id?: string | null;
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          email?: string | null;
          country_code?: string | null;
          timezone?: string;
          total_tokens?: number;
          total_cost?: number;
          current_level?: number;
          global_rank?: number | null;
          country_rank?: number | null;
          primary_model?: string | null;
          primary_model_updated_at?: string | null;
          created_at?: string;
          updated_at?: string;
          last_submission_at?: string | null;
          auto_sync_enabled?: boolean;
          profile_visible?: boolean;
          onboarding_completed?: boolean;
          api_key?: string | null;
        };
      };
      usage_stats: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          input_tokens: number;
          output_tokens: number;
          cache_read_tokens: number;
          cache_write_tokens: number;
          total_tokens: number;
          cost_usd: number;
          primary_model: string | null;
          submitted_at: string;
          submission_source: string | null;
          validation_status: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          input_tokens?: number;
          output_tokens?: number;
          cache_read_tokens?: number;
          cache_write_tokens?: number;
          total_tokens?: number;
          cost_usd?: number;
          primary_model?: string | null;
          submitted_at?: string;
          submission_source?: string | null;
          validation_status?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          input_tokens?: number;
          output_tokens?: number;
          cache_read_tokens?: number;
          cache_write_tokens?: number;
          total_tokens?: number;
          cost_usd?: number;
          primary_model?: string | null;
          submitted_at?: string;
          submission_source?: string | null;
          validation_status?: string;
        };
      };
      user_badges: {
        Row: {
          id: string;
          user_id: string;
          badge_type: string;
          earned_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          badge_type: string;
          earned_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          badge_type?: string;
          earned_at?: string;
        };
      };
      badge_display: {
        Row: {
          user_id: string;
          displayed_badges: string[];
          updated_at: string;
        };
        Insert: {
          user_id: string;
          displayed_badges?: string[];
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          displayed_badges?: string[];
          updated_at?: string;
        };
      };
      country_stats: {
        Row: {
          country_code: string;
          country_name: string;
          total_users: number;
          total_tokens: number;
          total_cost: number;
          global_rank: number | null;
          updated_at: string;
        };
        Insert: {
          country_code: string;
          country_name: string;
          total_users?: number;
          total_tokens?: number;
          total_cost?: number;
          global_rank?: number | null;
          updated_at?: string;
        };
        Update: {
          country_code?: string;
          country_name?: string;
          total_users?: number;
          total_tokens?: number;
          total_cost?: number;
          global_rank?: number | null;
          updated_at?: string;
        };
      };
      news_items: {
        Row: {
          id: string;
          source_url: string;
          source_name: string;
          source_type: string | null;
          original_title: string;
          original_content: string | null;
          summary_md: string | null;
          key_points: string[] | null;
          category: string | null;
          relevance_score: number | null;
          published_at: string | null;
          crawled_at: string;
          summarized_at: string | null;
          is_featured: boolean;
          is_visible: boolean;
        };
        Insert: {
          id?: string;
          source_url: string;
          source_name: string;
          source_type?: string | null;
          original_title: string;
          original_content?: string | null;
          summary_md?: string | null;
          key_points?: string[] | null;
          category?: string | null;
          relevance_score?: number | null;
          published_at?: string | null;
          crawled_at?: string;
          summarized_at?: string | null;
          is_featured?: boolean;
          is_visible?: boolean;
        };
        Update: {
          id?: string;
          source_url?: string;
          source_name?: string;
          source_type?: string | null;
          original_title?: string;
          original_content?: string | null;
          summary_md?: string | null;
          key_points?: string[] | null;
          category?: string | null;
          relevance_score?: number | null;
          published_at?: string | null;
          crawled_at?: string;
          summarized_at?: string | null;
          is_featured?: boolean;
          is_visible?: boolean;
        };
      };
      daily_snapshots: {
        Row: {
          id: string;
          snapshot_date: string;
          user_id: string;
          global_rank: number | null;
          country_rank: number | null;
          total_tokens: number | null;
          total_cost: number | null;
          level: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          snapshot_date: string;
          user_id: string;
          global_rank?: number | null;
          country_rank?: number | null;
          total_tokens?: number | null;
          total_cost?: number | null;
          level?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          snapshot_date?: string;
          user_id?: string;
          global_rank?: number | null;
          country_rank?: number | null;
          total_tokens?: number | null;
          total_cost?: number | null;
          level?: number | null;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      calculate_level: {
        Args: { tokens: number };
        Returns: number;
      };
      calculate_global_ranks: {
        Args: Record<string, never>;
        Returns: void;
      };
      calculate_country_ranks: {
        Args: Record<string, never>;
        Returns: void;
      };
      update_country_stats: {
        Args: Record<string, never>;
        Returns: void;
      };
    };
    Enums: Record<string, never>;
  };
}

// Convenience types
export type User = Database['public']['Tables']['users']['Row'];
export type UserInsert = Database['public']['Tables']['users']['Insert'];
export type UserUpdate = Database['public']['Tables']['users']['Update'];

export type UsageStats = Database['public']['Tables']['usage_stats']['Row'];
export type UsageStatsInsert = Database['public']['Tables']['usage_stats']['Insert'];
export type UsageStatsUpdate = Database['public']['Tables']['usage_stats']['Update'];

export type UserBadge = Database['public']['Tables']['user_badges']['Row'];
export type BadgeDisplay = Database['public']['Tables']['badge_display']['Row'];
export type CountryStats = Database['public']['Tables']['country_stats']['Row'];
export type NewsItem = Database['public']['Tables']['news_items']['Row'];
export type DailySnapshot = Database['public']['Tables']['daily_snapshots']['Row'];

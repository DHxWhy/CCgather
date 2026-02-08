// =====================================================
// CCgather Database Types
// Auto-generated from Supabase schema
// Last updated: 2025-01-21
// =====================================================

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      admin_alerts: {
        Row: {
          created_at: string | null;
          id: string;
          is_read: boolean | null;
          message: string;
          metadata: Json | null;
          type: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          is_read?: boolean | null;
          message: string;
          metadata?: Json | null;
          type: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          is_read?: boolean | null;
          message?: string;
          metadata?: Json | null;
          type?: string;
        };
        Relationships: [];
      };
      admin_settings: {
        Row: {
          created_at: string | null;
          id: string;
          last_news_crawl_at: string | null;
          last_youtube_crawl_at: string | null;
          news_crawl_interval: number;
          news_mode: string;
          news_sources: string[] | null;
          total_ai_cost: number | null;
          total_ai_requests: number | null;
          total_ai_tokens: number | null;
          updated_at: string | null;
          youtube_crawl_interval: number;
          youtube_keywords: string[] | null;
          youtube_mode: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          last_news_crawl_at?: string | null;
          last_youtube_crawl_at?: string | null;
          news_crawl_interval?: number;
          news_mode?: string;
          news_sources?: string[] | null;
          total_ai_cost?: number | null;
          total_ai_requests?: number | null;
          total_ai_tokens?: number | null;
          updated_at?: string | null;
          youtube_crawl_interval?: number;
          youtube_keywords?: string[] | null;
          youtube_mode?: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          last_news_crawl_at?: string | null;
          last_youtube_crawl_at?: string | null;
          news_crawl_interval?: number;
          news_mode?: string;
          news_sources?: string[] | null;
          total_ai_cost?: number | null;
          total_ai_requests?: number | null;
          total_ai_tokens?: number | null;
          updated_at?: string | null;
          youtube_crawl_interval?: number;
          youtube_keywords?: string[] | null;
          youtube_mode?: string;
        };
        Relationships: [];
      };
      ai_usage_log: {
        Row: {
          cost_usd: number | null;
          created_at: string | null;
          id: string;
          input_tokens: number;
          metadata: Json | null;
          model: string;
          operation: string | null;
          output_tokens: number;
          request_type: string;
          total_tokens: number;
        };
        Insert: {
          cost_usd?: number | null;
          created_at?: string | null;
          id?: string;
          input_tokens?: number;
          metadata?: Json | null;
          model: string;
          operation?: string | null;
          output_tokens?: number;
          request_type: string;
          total_tokens?: number;
        };
        Update: {
          cost_usd?: number | null;
          created_at?: string | null;
          id?: string;
          input_tokens?: number;
          metadata?: Json | null;
          model?: string;
          operation?: string | null;
          output_tokens?: number;
          request_type?: string;
          total_tokens?: number;
        };
        Relationships: [];
      };
      badge_display: {
        Row: {
          displayed_badges: string[] | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          displayed_badges?: string[] | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          displayed_badges?: string[] | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "badge_display_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      cli_device_codes: {
        Row: {
          api_token: string | null;
          created_at: string | null;
          device_code: string;
          expires_at: string | null;
          id: string;
          status: string | null;
          user_code: string;
          user_id: string | null;
        };
        Insert: {
          api_token?: string | null;
          created_at?: string | null;
          device_code: string;
          expires_at?: string | null;
          id?: string;
          status?: string | null;
          user_code: string;
          user_id?: string | null;
        };
        Update: {
          api_token?: string | null;
          created_at?: string | null;
          device_code?: string;
          expires_at?: string | null;
          id?: string;
          status?: string | null;
          user_code?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cli_device_codes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      contents: {
        Row: {
          ai_article_type: string | null;
          ai_article_type_secondary: string | null;
          ai_classification_confidence: number | null;
          ai_classification_signals: string[] | null;
          ai_cost_usd: number | null;
          ai_model_used: string | null;
          ai_model_version: string | null;
          ai_processed_at: string | null;
          ai_tokens_used: number | null;
          analogy: string | null;
          body_html: string | null;
          category: string | null;
          channel_id: string | null;
          channel_name: string | null;
          content_type: string | null;
          crawled_at: string | null;
          created_at: string | null;
          difficulty: string | null;
          duration: string | null;
          fact_check_reason: string | null;
          fact_check_score: number | null;
          favicon_url: string | null;
          id: string;
          insight_html: string | null;
          key_points: string[] | null;
          key_takeaways: Json | null;
          language: string | null;
          news_tags: string[] | null;
          one_liner: string | null;
          original_content: string | null;
          published_at: string | null;
          related_articles: string[] | null;
          relevance_score: number | null;
          rich_content: Json | null;
          slug: string | null;
          source_name: string | null;
          source_url: string;
          status: string;
          summarized_at: string | null;
          summary_md: string | null;
          tags: string[] | null;
          thumbnail_generated_at: string | null;
          thumbnail_source: string | null;
          thumbnail_url: string | null;
          title: string;
          transcript: string | null;
          type: string;
          updated_at: string | null;
          video_id: string | null;
          view_count: number | null;
        };
        Insert: {
          ai_article_type?: string | null;
          ai_article_type_secondary?: string | null;
          ai_classification_confidence?: number | null;
          ai_classification_signals?: string[] | null;
          ai_cost_usd?: number | null;
          ai_model_used?: string | null;
          ai_model_version?: string | null;
          ai_processed_at?: string | null;
          ai_tokens_used?: number | null;
          analogy?: string | null;
          body_html?: string | null;
          category?: string | null;
          channel_id?: string | null;
          channel_name?: string | null;
          content_type?: string | null;
          crawled_at?: string | null;
          created_at?: string | null;
          difficulty?: string | null;
          duration?: string | null;
          fact_check_reason?: string | null;
          fact_check_score?: number | null;
          favicon_url?: string | null;
          id?: string;
          insight_html?: string | null;
          key_points?: string[] | null;
          key_takeaways?: Json | null;
          language?: string | null;
          news_tags?: string[] | null;
          one_liner?: string | null;
          original_content?: string | null;
          published_at?: string | null;
          related_articles?: string[] | null;
          relevance_score?: number | null;
          rich_content?: Json | null;
          slug?: string | null;
          source_name?: string | null;
          source_url: string;
          status?: string;
          summarized_at?: string | null;
          summary_md?: string | null;
          tags?: string[] | null;
          thumbnail_generated_at?: string | null;
          thumbnail_source?: string | null;
          thumbnail_url?: string | null;
          title: string;
          transcript?: string | null;
          type: string;
          updated_at?: string | null;
          video_id?: string | null;
          view_count?: number | null;
        };
        Update: {
          ai_article_type?: string | null;
          ai_article_type_secondary?: string | null;
          ai_classification_confidence?: number | null;
          ai_classification_signals?: string[] | null;
          ai_cost_usd?: number | null;
          ai_model_used?: string | null;
          ai_model_version?: string | null;
          ai_processed_at?: string | null;
          ai_tokens_used?: number | null;
          analogy?: string | null;
          body_html?: string | null;
          category?: string | null;
          channel_id?: string | null;
          channel_name?: string | null;
          content_type?: string | null;
          crawled_at?: string | null;
          created_at?: string | null;
          difficulty?: string | null;
          duration?: string | null;
          fact_check_reason?: string | null;
          fact_check_score?: number | null;
          favicon_url?: string | null;
          id?: string;
          insight_html?: string | null;
          key_points?: string[] | null;
          key_takeaways?: Json | null;
          language?: string | null;
          news_tags?: string[] | null;
          one_liner?: string | null;
          original_content?: string | null;
          published_at?: string | null;
          related_articles?: string[] | null;
          relevance_score?: number | null;
          rich_content?: Json | null;
          slug?: string | null;
          source_name?: string | null;
          source_url?: string;
          status?: string;
          summarized_at?: string | null;
          summary_md?: string | null;
          tags?: string[] | null;
          thumbnail_generated_at?: string | null;
          thumbnail_source?: string | null;
          thumbnail_url?: string | null;
          title?: string;
          transcript?: string | null;
          type?: string;
          updated_at?: string | null;
          video_id?: string | null;
          view_count?: number | null;
        };
        Relationships: [];
      };
      country_stats: {
        Row: {
          country_code: string;
          country_name: string;
          global_rank: number | null;
          total_cost: number | null;
          total_tokens: number | null;
          total_users: number | null;
          updated_at: string | null;
        };
        Insert: {
          country_code: string;
          country_name: string;
          global_rank?: number | null;
          total_cost?: number | null;
          total_tokens?: number | null;
          total_users?: number | null;
          updated_at?: string | null;
        };
        Update: {
          country_code?: string;
          country_name?: string;
          global_rank?: number | null;
          total_cost?: number | null;
          total_tokens?: number | null;
          total_users?: number | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      daily_snapshots: {
        Row: {
          country_rank: number | null;
          created_at: string | null;
          global_rank: number | null;
          id: string;
          level: number | null;
          snapshot_date: string;
          total_cost: number | null;
          total_tokens: number | null;
          user_id: string | null;
        };
        Insert: {
          country_rank?: number | null;
          created_at?: string | null;
          global_rank?: number | null;
          id?: string;
          level?: number | null;
          snapshot_date: string;
          total_cost?: number | null;
          total_tokens?: number | null;
          user_id?: string | null;
        };
        Update: {
          country_rank?: number | null;
          created_at?: string | null;
          global_rank?: number | null;
          id?: string;
          level?: number | null;
          snapshot_date?: string;
          total_cost?: number | null;
          total_tokens?: number | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "daily_snapshots_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      news_items: {
        Row: {
          category: string | null;
          crawled_at: string | null;
          id: string;
          is_featured: boolean | null;
          is_visible: boolean | null;
          key_points: string[] | null;
          original_content: string | null;
          original_title: string;
          published_at: string | null;
          relevance_score: number | null;
          source_name: string;
          source_type: string | null;
          source_url: string;
          summarized_at: string | null;
          summary_md: string | null;
        };
        Insert: {
          category?: string | null;
          crawled_at?: string | null;
          id?: string;
          is_featured?: boolean | null;
          is_visible?: boolean | null;
          key_points?: string[] | null;
          original_content?: string | null;
          original_title: string;
          published_at?: string | null;
          relevance_score?: number | null;
          source_name: string;
          source_type?: string | null;
          source_url: string;
          summarized_at?: string | null;
          summary_md?: string | null;
        };
        Update: {
          category?: string | null;
          crawled_at?: string | null;
          id?: string;
          is_featured?: boolean | null;
          is_visible?: boolean | null;
          key_points?: string[] | null;
          original_content?: string | null;
          original_title?: string;
          published_at?: string | null;
          relevance_score?: number | null;
          source_name?: string;
          source_type?: string | null;
          source_url?: string;
          summarized_at?: string | null;
          summary_md?: string | null;
        };
        Relationships: [];
      };
      submitted_sessions: {
        Row: {
          device_id: string | null;
          id: string;
          project_hash: string | null;
          session_hash: string;
          submitted_at: string;
          user_id: string;
        };
        Insert: {
          device_id?: string | null;
          id?: string;
          project_hash?: string | null;
          session_hash: string;
          submitted_at?: string;
          user_id: string;
        };
        Update: {
          device_id?: string | null;
          id?: string;
          project_hash?: string | null;
          session_hash?: string;
          submitted_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "submitted_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      tools: {
        Row: {
          approved_at: string | null;
          bookmark_count: number | null;
          category: string;
          created_at: string | null;
          description: string | null;
          id: string;
          logo_url: string | null;
          name: string;
          pricing_type: string | null;
          slug: string;
          source: string | null;
          status: string | null;
          submitted_by: string | null;
          tagline: string;
          tags: string[] | null;
          updated_at: string | null;
          upvote_count: number | null;
          website_url: string;
          weighted_score: number | null;
        };
        Insert: {
          approved_at?: string | null;
          bookmark_count?: number | null;
          category: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          logo_url?: string | null;
          name: string;
          pricing_type?: string | null;
          slug: string;
          source?: string | null;
          status?: string | null;
          submitted_by?: string | null;
          tagline: string;
          tags?: string[] | null;
          updated_at?: string | null;
          upvote_count?: number | null;
          website_url: string;
          weighted_score?: number | null;
        };
        Update: {
          approved_at?: string | null;
          bookmark_count?: number | null;
          category?: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          logo_url?: string | null;
          name?: string;
          pricing_type?: string | null;
          slug?: string;
          source?: string | null;
          status?: string | null;
          submitted_by?: string | null;
          tagline?: string;
          tags?: string[] | null;
          updated_at?: string | null;
          upvote_count?: number | null;
          website_url?: string;
          weighted_score?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "tools_submitted_by_fkey";
            columns: ["submitted_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      usage_stats: {
        Row: {
          cache_read_tokens: number | null;
          cache_write_tokens: number | null;
          ccplan_at_submission: string | null;
          cost_usd: number | null;
          date: string;
          device_id: string;
          id: string;
          input_tokens: number | null;
          league_reason: string | null;
          league_reason_details: string | null;
          output_tokens: number | null;
          primary_model: string | null;
          sessions: number | null;
          submission_source: string | null;
          submitted_at: string | null;
          total_tokens: number | null;
          user_id: string | null;
          validation_status: string | null;
        };
        Insert: {
          cache_read_tokens?: number | null;
          cache_write_tokens?: number | null;
          ccplan_at_submission?: string | null;
          cost_usd?: number | null;
          date: string;
          device_id?: string;
          id?: string;
          input_tokens?: number | null;
          league_reason?: string | null;
          league_reason_details?: string | null;
          output_tokens?: number | null;
          primary_model?: string | null;
          sessions?: number | null;
          submission_source?: string | null;
          submitted_at?: string | null;
          total_tokens?: number | null;
          user_id?: string | null;
          validation_status?: string | null;
        };
        Update: {
          cache_read_tokens?: number | null;
          cache_write_tokens?: number | null;
          ccplan_at_submission?: string | null;
          cost_usd?: number | null;
          date?: string;
          device_id?: string;
          id?: string;
          input_tokens?: number | null;
          league_reason?: string | null;
          league_reason_details?: string | null;
          output_tokens?: number | null;
          primary_model?: string | null;
          sessions?: number | null;
          submission_source?: string | null;
          submitted_at?: string | null;
          total_tokens?: number | null;
          user_id?: string | null;
          validation_status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "usage_stats_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      user_badges: {
        Row: {
          badge_type: string;
          earned_at: string | null;
          id: string;
          user_id: string | null;
        };
        Insert: {
          badge_type: string;
          earned_at?: string | null;
          id?: string;
          user_id?: string | null;
        };
        Update: {
          badge_type?: string;
          earned_at?: string | null;
          id?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_badges_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          api_key: string | null;
          auto_sync_enabled: boolean | null;
          avatar_url: string | null;
          ccplan: string | null;
          ccplan_rank: number | null;
          ccplan_updated_at: string | null;
          clerk_id: string;
          community_updates_consent: boolean | null;
          community_updates_consent_at: string | null;
          country_code: string | null;
          country_rank: number | null;
          created_at: string | null;
          current_level: number | null;
          deleted_at: string | null;
          display_name: string | null;
          email: string | null;
          github_id: string | null;
          global_rank: number | null;
          has_opus_usage: boolean | null;
          hide_profile_on_invite: boolean | null;
          id: string;
          integrity_agreed: boolean | null;
          integrity_agreed_at: string | null;
          is_admin: boolean | null;
          last_submission_at: string | null;
          marketing_consent: boolean | null;
          marketing_consent_at: string | null;
          onboarding_completed: boolean | null;
          opus_models: string[] | null;
          primary_model: string | null;
          primary_model_updated_at: string | null;
          profile_visibility_consent: boolean | null;
          profile_visibility_consent_at: string | null;
          profile_visible: boolean | null;
          referral_code: string | null;
          referred_by: string | null;
          social_links: Json | null;
          timezone: string | null;
          total_cost: number | null;
          total_tokens: number | null;
          updated_at: string | null;
          username: string;
        };
        Insert: {
          api_key?: string | null;
          auto_sync_enabled?: boolean | null;
          avatar_url?: string | null;
          ccplan?: string | null;
          ccplan_rank?: number | null;
          ccplan_updated_at?: string | null;
          clerk_id: string;
          community_updates_consent?: boolean | null;
          community_updates_consent_at?: string | null;
          country_code?: string | null;
          country_rank?: number | null;
          created_at?: string | null;
          current_level?: number | null;
          deleted_at?: string | null;
          display_name?: string | null;
          email?: string | null;
          github_id?: string | null;
          global_rank?: number | null;
          has_opus_usage?: boolean | null;
          hide_profile_on_invite?: boolean | null;
          id?: string;
          integrity_agreed?: boolean | null;
          integrity_agreed_at?: string | null;
          is_admin?: boolean | null;
          last_submission_at?: string | null;
          marketing_consent?: boolean | null;
          marketing_consent_at?: string | null;
          onboarding_completed?: boolean | null;
          opus_models?: string[] | null;
          primary_model?: string | null;
          primary_model_updated_at?: string | null;
          profile_visibility_consent?: boolean | null;
          profile_visibility_consent_at?: string | null;
          profile_visible?: boolean | null;
          referral_code?: string | null;
          referred_by?: string | null;
          social_links?: Json | null;
          timezone?: string | null;
          total_cost?: number | null;
          total_tokens?: number | null;
          updated_at?: string | null;
          username: string;
        };
        Update: {
          api_key?: string | null;
          auto_sync_enabled?: boolean | null;
          avatar_url?: string | null;
          ccplan?: string | null;
          ccplan_rank?: number | null;
          ccplan_updated_at?: string | null;
          clerk_id?: string;
          community_updates_consent?: boolean | null;
          community_updates_consent_at?: string | null;
          country_code?: string | null;
          country_rank?: number | null;
          created_at?: string | null;
          current_level?: number | null;
          deleted_at?: string | null;
          display_name?: string | null;
          email?: string | null;
          github_id?: string | null;
          global_rank?: number | null;
          has_opus_usage?: boolean | null;
          hide_profile_on_invite?: boolean | null;
          id?: string;
          integrity_agreed?: boolean | null;
          integrity_agreed_at?: string | null;
          is_admin?: boolean | null;
          last_submission_at?: string | null;
          marketing_consent?: boolean | null;
          marketing_consent_at?: string | null;
          onboarding_completed?: boolean | null;
          opus_models?: string[] | null;
          primary_model?: string | null;
          primary_model_updated_at?: string | null;
          profile_visibility_consent?: boolean | null;
          profile_visibility_consent_at?: string | null;
          profile_visible?: boolean | null;
          referral_code?: string | null;
          referred_by?: string | null;
          social_links?: Json | null;
          timezone?: string | null;
          total_cost?: number | null;
          total_tokens?: number | null;
          updated_at?: string | null;
          username?: string;
        };
        Relationships: [
          {
            foreignKeyName: "users_referred_by_fkey";
            columns: ["referred_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      calculate_country_ranks: { Args: Record<string, never>; Returns: undefined };
      calculate_global_ranks: { Args: Record<string, never>; Returns: undefined };
      calculate_level: { Args: { tokens: number }; Returns: number };
      count_unique_usage_days: { Args: { p_user_id: string }; Returns: number };
      cleanup_deleted_users: { Args: Record<string, never>; Returns: Json };
      cleanup_expired_device_codes: { Args: Record<string, never>; Returns: undefined };
      generate_referral_code: { Args: { p_username: string }; Returns: string };
      get_pending_deletion_info: { Args: { target_clerk_id: string }; Returns: Json };
      is_admin_user: { Args: Record<string, never>; Returns: boolean };
      is_user_active: { Args: { user_id: string }; Returns: boolean };
      recalculate_ccplan_ranks: { Args: Record<string, never>; Returns: undefined };
      recover_user: { Args: { target_clerk_id: string }; Returns: Json };
      soft_delete_user: { Args: { target_clerk_id: string }; Returns: Json };
      update_country_stats: { Args: Record<string, never>; Returns: undefined };
      update_user_ccplan_rank: { Args: { target_user_id: string }; Returns: undefined };
    };
    Enums: {
      // ccplan_type removed - now TEXT to support any plan (free, pro, max, max_20x, team, enterprise, etc.)
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// =====================================================
// Convenience Types
// =====================================================
export type User = Database["public"]["Tables"]["users"]["Row"];
export type UserInsert = Database["public"]["Tables"]["users"]["Insert"];
export type UserUpdate = Database["public"]["Tables"]["users"]["Update"];

export type UsageStats = Database["public"]["Tables"]["usage_stats"]["Row"];
export type UsageStatsInsert = Database["public"]["Tables"]["usage_stats"]["Insert"];
export type UsageStatsUpdate = Database["public"]["Tables"]["usage_stats"]["Update"];

export type UserBadge = Database["public"]["Tables"]["user_badges"]["Row"];
export type BadgeDisplay = Database["public"]["Tables"]["badge_display"]["Row"];
export type CountryStats = Database["public"]["Tables"]["country_stats"]["Row"];
export type DailySnapshot = Database["public"]["Tables"]["daily_snapshots"]["Row"];
export type Tool = Database["public"]["Tables"]["tools"]["Row"];
export type SubmittedSession = Database["public"]["Tables"]["submitted_sessions"]["Row"];

export type CCPlanType = string;

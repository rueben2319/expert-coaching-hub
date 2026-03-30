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
      ai_generations: {
        Row: {
          action_key: string
          actor_role: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          model: string | null
          prompt: string
          provider: string | null
          response: string | null
          response_format: string | null
          tokens_completion: number | null
          tokens_prompt: number | null
          user_id: string | null
        }
        Insert: {
          action_key: string
          actor_role?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          model?: string | null
          prompt: string
          provider?: string | null
          response?: string | null
          response_format?: string | null
          tokens_completion?: number | null
          tokens_prompt?: number | null
          user_id?: string | null
        }
        Update: {
          action_key?: string
          actor_role?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          model?: string | null
          prompt?: string
          provider?: string | null
          response?: string | null
          response_format?: string | null
          tokens_completion?: number | null
          tokens_prompt?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      client_notes: {
        Row: {
          ai_summary: string | null
          content_id: string | null
          created_at: string | null
          id: string
          is_ai_generated: boolean | null
          lesson_id: string | null
          metadata: Json | null
          note_text: string
          source: string | null
          tags: string[] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_summary?: string | null
          content_id?: string | null
          created_at?: string | null
          id?: string
          is_ai_generated?: boolean | null
          lesson_id?: string | null
          metadata?: Json | null
          note_text: string
          source?: string | null
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_summary?: string | null
          content_id?: string | null
          created_at?: string | null
          id?: string
          is_ai_generated?: boolean | null
          lesson_id?: string | null
          metadata?: Json | null
          note_text?: string
          source?: string | null
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "lesson_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_settings: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          paychangu_enabled: boolean
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          paychangu_enabled?: boolean
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          paychangu_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      coach_subscriptions: {
        Row: {
          billing_cycle: string
          coach_id: string
          created_at: string
          end_date: string | null
          failed_renewal_attempts: number
          grace_expires_at: string | null
          id: string
          payment_method: string | null
          renewal_date: string | null
          start_date: string
          status: string
          tier_id: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle: string
          coach_id: string
          created_at?: string
          end_date?: string | null
          failed_renewal_attempts?: number
          grace_expires_at?: string | null
          id?: string
          payment_method?: string | null
          renewal_date?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["course_status"]
          tier_id: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          coach_id?: string
          created_at?: string
          end_date?: string | null
          failed_renewal_attempts?: number
          grace_expires_at?: string | null
          id?: string
          payment_method?: string | null
          renewal_date?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["course_status"]
          tier_id?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_subscriptions_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      content_interactions: {
        Row: {
          content_id: string
          created_at: string
          id: string
          interaction_data: Json | null
          is_completed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          id?: string
          interaction_data?: Json | null
          is_completed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          content_id?: string
          created_at?: string
          id?: string
          interaction_data?: Json | null
          is_completed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_interactions_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "lesson_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
        ]
      }
      course_certificates: {
        Row: {
          certificate_id: string
          certificate_url: string | null
          course_id: string
          expires_at: string | null
          id: string
          issued_at: string | null
          template_version: string | null
          user_id: string
          verification_status: string | null
        }
        Insert: {
          certificate_id: string
          certificate_url?: string | null
          course_id: string
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          template_version?: string | null
          user_id: string
          verification_status?: string | null
        }
        Update: {
          certificate_id?: string
          certificate_url?: string | null
          course_id?: string
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          template_version?: string | null
          user_id?: string
          verification_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_certificates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
        ]
      }
      course_content_embeddings: {
        Row: {
          chunk: string
          content_id: string | null
          created_at: string | null
          embedding: string | null
          id: string
          lesson_id: string | null
          metadata: Json | null
        }
        Insert: {
          chunk: string
          content_id?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          lesson_id?: string | null
          metadata?: Json | null
        }
        Update: {
          chunk?: string
          content_id?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          lesson_id?: string | null
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "course_content_embeddings_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "lesson_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_content_embeddings_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      course_embeddings: {
        Row: {
          content_text: string
          course_id: string
          created_at: string | null
          embedding: string | null
          id: string
          metadata: Json | null
          updated_at: string | null
        }
        Insert: {
          content_text: string
          course_id: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          updated_at?: string | null
        }
        Update: {
          content_text?: string
          course_id?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_embeddings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_enrollments: {
        Row: {
          completed_at: string | null
          course_id: string
          credit_transaction_id: string | null
          credits_paid: number | null
          enrolled_at: string
          id: string
          payment_status: string | null
          progress_percentage: number
          status: Database["public"]["Enums"]["enrollment_status"]
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          credit_transaction_id?: string | null
          credits_paid?: number | null
          enrolled_at?: string
          id?: string
          payment_status?: string | null
          progress_percentage?: number
          status?: Database["public"]["Enums"]["enrollment_status"]
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          credit_transaction_id?: string | null
          credits_paid?: number | null
          enrolled_at?: string
          id?: string
          payment_status?: string | null
          progress_percentage?: number
          status?: Database["public"]["Enums"]["enrollment_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_files: {
        Row: {
          course_id: string
          description: string | null
          download_count: number | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          is_public: boolean | null
          lesson_id: string | null
          mime_type: string
          module_id: string | null
          tags: string[] | null
          uploaded_at: string | null
          uploaded_by: string
        }
        Insert: {
          course_id: string
          description?: string | null
          download_count?: number | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          is_public?: boolean | null
          lesson_id?: string | null
          mime_type: string
          module_id?: string | null
          tags?: string[] | null
          uploaded_at?: string | null
          uploaded_by: string
        }
        Update: {
          course_id?: string
          description?: string | null
          download_count?: number | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          is_public?: boolean | null
          lesson_id?: string | null
          mime_type?: string
          module_id?: string | null
          tags?: string[] | null
          uploaded_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_files_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_files_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_files_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_reviews: {
        Row: {
          course_id: string
          created_at: string | null
          id: string
          rating: number
          review_text: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string | null
          id?: string
          rating: number
          review_text?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          course_id?: string
          created_at?: string | null
          id?: string
          rating?: number
          review_text?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_reviews_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          average_rating: number | null
          category: string | null
          coach_id: string
          created_at: string
          description: string | null
          id: string
          is_free: boolean | null
          level: Database["public"]["Enums"]["course_level"] | null
          price_credits: number | null
          review_count: number | null
          status: Database["public"]["Enums"]["course_status"]
          tag: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          average_rating?: number | null
          category?: string | null
          coach_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_free?: boolean | null
          level?: Database["public"]["Enums"]["course_level"] | null
          price_credits?: number | null
          review_count?: number | null
          status?: Database["public"]["Enums"]["course_status"]
          tag?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          average_rating?: number | null
          category?: string | null
          coach_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_free?: boolean | null
          level?: Database["public"]["Enums"]["course_level"] | null
          price_credits?: number | null
          review_count?: number | null
          status?: Database["public"]["Enums"]["course_status"]
          tag?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          reference_id: string | null
          reference_type: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string | null
          id: string
          invoice_date: string
          invoice_number: string
          order_id: string | null
          payment_method: string | null
          status: string
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          description?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          order_id?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["course_status"]
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          order_id?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["course_status"]
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_completion_attempts: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          lesson_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          lesson_id?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          lesson_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_completion_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_completion_attempts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_content: {
        Row: {
          content_data: Json
          content_type: string
          created_at: string
          file_url: string | null
          file_metadata: Json | null
          id: string
          is_required: boolean
          lesson_id: string
          order_index: number
          updated_at: string
        }
        Insert: {
          content_data: Json
          content_type: string
          created_at?: string
          file_url?: string | null
          file_metadata?: Json | null
          id?: string
          is_required?: boolean
          lesson_id?: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          content_data?: Json
          content_type?: string
          created_at?: string
          file_url?: string | null
          file_metadata?: Json | null
          id?: string
          is_required?: boolean
          lesson_id?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_content_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed_at: string | null
          content_completed: number
          content_total: number
          created_at: string
          id: string
          lesson_id: string
          progress_percentage: number
          started_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          content_completed?: number
          content_total?: number
          created_at?: string
          id?: string
          lesson_id?: string
          progress_percentage?: number
          started_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          content_completed?: number
          content_total?: number
          created_at?: string
          id?: string
          lesson_id?: string
          progress_percentage?: number
          started_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          created_at: string
          description: string | null
          estimated_duration: number | null
          id: string
          module_id: string
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          estimated_duration?: number | null
          id?: string
          module_id: string
          order_index?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          estimated_duration?: number | null
          id?: string
          module_id?: string
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          created_at: string
          email: string
          failure_reason: string | null
          id: string
          ip: unknown
          success: boolean
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          failure_reason?: string | null
          id?: string
          ip?: unknown
          success: boolean
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          failure_reason?: string | null
          id?: string
          ip?: unknown
          success?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      meeting_analytics: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          meeting_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          meeting_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          meeting_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_analytics_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_chat: {
        Row: {
          access_token_encrypted: string | null
          created_at: string
          expires_at: string | null
          id: string
          provider: string
          refresh_count: number
          refresh_token_encrypted: string | null
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          provider: string
          refresh_count?: number
          refresh_token_encrypted?: string | null
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          access_token_encrypted?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          provider?: string
          refresh_count?: number
          refresh_token_encrypted?: string | null
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      oauth_tokens: {
        Row: {
          access_token_encrypted: string | null
          created_at: string
          expires_at: string | null
          id: string
          last_refresh_request_id: string | null
          provider: string
          refresh_count: number
          refresh_token_encrypted: string | null
          refresh_token_fingerprint: string | null
          refresh_token_rotated_at: string | null
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          last_refresh_request_id?: string | null
          provider: string
          refresh_count?: number
          refresh_token_encrypted?: string | null
          refresh_token_fingerprint?: string | null
          refresh_token_rotated_at?: string | null
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          last_refresh_request_id?: string | null
          provider?: string
          refresh_count?: number
          refresh_token_encrypted?: string | null
          refresh_token_fingerprint?: string | null
          refresh_token_rotated_at?: string | null
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      practice_exercise_items: {
        Row: {
          answer: string | null
          approved: boolean
          choices: Json | null
          created_at: string
          difficulty: string | null
          explanation: string | null
          exercise_type: string
          id: string
          metadata: Json | null
          order_index: number
          question: string
          set_id: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          answer?: string | null
          approved?: boolean
          choices?: Json | null
          created_at?: string
          difficulty?: string | null
          explanation?: string | null
          exercise_type: string
          id?: string
          metadata?: Json | null
          order_index?: number
          question: string
          set_id: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          answer?: string | null
          approved?: boolean
          choices?: Json | null
          created_at?: string
          difficulty?: string | null
          explanation?: string | null
          exercise_type?: string
          id?: string
          metadata?: Json | null
          order_index?: number
          question?: string
          set_id?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_exercise_items_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "practice_exercise_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_exercise_sets: {
        Row: {
          approved_at: string | null
          created_at: string
          difficulty: string | null
          generated_by: string | null
          id: string
          lesson_id: string | null
          content_id: string | null
          model_used: string | null
          prompt_context: Json | null
          raw_output: Json | null
          skill_focus: string | null
          status: string
          target_audience: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          difficulty?: string | null
          generated_by?: string | null
          id?: string
          lesson_id?: string | null
          content_id?: string | null
          model_used?: string | null
          prompt_context?: Json | null
          raw_output?: Json | null
          skill_focus?: string | null
          status?: Database["public"]["Enums"]["course_status"]
          target_audience?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          difficulty?: string | null
          generated_by?: string | null
          id?: string
          lesson_id?: string | null
          content_id?: string | null
          model_used?: string | null
          prompt_context?: Json | null
          raw_output?: Json | null
          skill_focus?: string | null
          status?: Database["public"]["Enums"]["course_status"]
          target_audience?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_exercise_sets_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "lesson_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_exercise_sets_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_exercise_sets_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      recommended_courses: {
        Row: {
          recommended_course_id: string
          score: number
          source_course_id: string
        }
        Insert: {
          recommended_course_id: string
          score: number
          source_course_id: string
        }
        Update: {
          recommended_course_id?: string
          score?: number
          source_course_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommended_courses_source_course_id_fkey"
            columns: ["source_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommended_courses_recommended_course_id_fkey"
            columns: ["recommended_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_log: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          id: string
          target_user_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          target_user_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          target_user_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_audit_log_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
        ]
      }
      tiers: {
        Row: {
          created_at: string
          description: string | null
          features: Json | null
          id: string
          name: string
          price_monthly: number
          price_yearly: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          name: string
          price_monthly: number
          price_yearly: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          name?: string
          price_monthly?: number
          price_yearly?: number
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string | null
          gateway_response: Json | null
          id: string
          order_id: string | null
          status: string
          subscription_id: string | null
          transaction_mode: string
          transaction_ref: string
          updated_at: string
          user_id: string
          credits_amount: number | null
          credit_package_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string | null
          gateway_response?: Json | null
          id?: string
          order_id?: string | null
          status?: Database["public"]["Enums"]["course_status"]
          subscription_id?: string | null
          transaction_mode?: string
          transaction_ref: string
          updated_at?: string
          user_id?: string
          credits_amount?: number | null
          credit_package_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string | null
          gateway_response?: Json | null
          id?: string
          order_id?: string | null
          status?: Database["public"]["Enums"]["course_status"]
          subscription_id?: string | null
          transaction_mode?: string
          transaction_ref?: string
          updated_at?: string
          user_id?: string
          credits_amount?: number | null
          credit_package_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      user_session_versions: {
        Row: {
          rotated_at: string
          rotated_reason: string | null
          user_id: string
          version: number
        }
        Insert: {
          rotated_at?: string
          rotated_reason?: string | null
          user_id: string
          version?: number
        }
        Update: {
          rotated_at?: string
          rotated_reason?: string | null
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      webhook_processing_log: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          payload: Json | null
          processed_at: string | null
          status: string
          tx_ref: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          status?: Database["public"]["Enums"]["course_status"]
          tx_ref: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          status?: Database["public"]["Enums"]["course_status"]
          tx_ref?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          admin_notes: string | null
          amount_mwk: number
          completed_at: string | null
          coach_id: string
          created_at: string
          credits_amount: number
          failure_reason: string | null
          id: string
          payout_ref: string | null
          payout_trans_id: string | null
          processed_at: string | null
          status: string
          transaction_ref: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          amount_mwk: number
          completed_at?: string | null
          coach_id: string
          created_at?: string
          credits_amount: number
          failure_reason?: string | null
          id?: string
          payout_ref?: string | null
          payout_trans_id?: string | null
          processed_at?: string | null
          status?: Database["public"]["Enums"]["course_status"]
          transaction_ref?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          amount_mwk?: number
          completed_at?: string | null
          coach_id?: string
          created_at?: string
          credits_amount?: number
          failure_reason?: string | null
          id?: string
          payout_ref?: string | null
          payout_trans_id?: string | null
          processed_at?: string | null
          status?: Database["public"]["Enums"]["course_status"]
          transaction_ref?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      meeting_analytics: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          meeting_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          meeting_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          meeting_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_analytics_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_chat: {
        Row: {
          created_at: string | null
          id: string
          meeting_id: string
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          meeting_id: string
          message: string
          user_id?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          meeting_id?: string
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_chat_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          attendees: Json | null
          calendar_event_id: string | null
          course_id: string | null
          created_at: string | null
          description: string | null
          end_time: string
          id: string
          meet_link: string | null
          start_time: string
          status: string | null
          summary: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attendees?: Json | null
          calendar_event_id?: string | null
          course_id?: string | null
          created_at?: string | null
          description?: string | null
          end_time: string
          id?: string
          meet_link?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["course_status"] | null
          summary: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attendees?: Json | null
          calendar_event_id?: string | null
          course_id?: string | null
          created_at?: string | null
          description?: string | null
          end_time?: string
          id?: string
          meet_link?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["course_status"] | null
          summary?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles_public: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      subscription_audit_log: {
        Row: {
          created_at: string | null
          id: string
          metadata: Json | null
          new_status: string | null
          old_status: string | null
          reason: string | null
          subscription_id: string
          subscription_type: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          new_status?: string | null
          old_status?: string | null
          reason?: string | null
          subscription_id: string
          subscription_type?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          new_status?: string | null
          old_status?: string | null
          reason?: string | null
          subscription_id?: string
          subscription_type?: string | null
        }
        Relationships: []
      }
      user_role_changes: {
        Row: {
          changed_by: string
          changed_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          changed_by: string
          changed_at?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          changed_by?: string
          changed_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_process_withdrawal: {
        Args: {
          p_action: string
          p_admin_id: string
          p_admin_notes?: string
          p_withdrawal_id: string
        }
        Returns: Json
      }
      begin_transaction: { Args: never; Returns: string }
      calculate_course_progress: {
        Args: { _course_id: string; _user_id: string }
        Returns: number
      }
      calculate_renewal_date: {
        Args: { _billing_cycle: string; _start_date?: string }
        Returns: string
      }
      check_duplicate_subscription: {
        Args: {
          _coach_id: string
          _package_id?: string
          _tier_id?: string
          _user_id: string
        }
        Returns: boolean
      }
      cleanup_expired_recommendations: { Args: never; Returns: undefined }
      cleanup_orphaned_files: { Args: never; Returns: undefined }
      commit_transaction: { Args: never; Returns: string }
      enroll_with_credits_atomic: {
        Args: { p_course_id: string; p_user_id: string }
        Returns: Json
      }
      finalize_oauth_callback: {
        Args: {
          p_avatar_url?: string
          p_email: string
          p_full_name?: string
          p_user_id: string
        }
        Returns: {
          onboarding_state: string
          redirect_to: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      fn_practice_item_coach_access: {
        Args: {
          item: Database["public"]["Tables"]["practice_exercise_items"]["Row"]
        }
        Returns: boolean
      }
      fn_practice_item_student_access: {
        Args: {
          item: Database["public"]["Tables"]["practice_exercise_items"]["Row"]
        }
        Returns: boolean
      }
      fn_practice_set_coach_access: {
        Args: {
          pes: Database["public"]["Tables"]["practice_exercise_sets"]["Row"]
        }
        Returns: boolean
      }
      fn_practice_set_student_access: {
        Args: {
          pes: Database["public"]["Tables"]["practice_exercise_sets"]["Row"]
        }
        Returns: boolean
      }
      generate_certificate_id: { Args: never; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      get_aged_credits: {
        Args: { p_min_age_days?: number; p_user_id: string }
        Returns: number
      }
      get_auth_user_security_by_email: {
        Args: { p_email: string }
        Returns: {
          bcrypt_cost: number
          email: string
          email_verified: boolean
          user_id: string
        }[]
      }
      get_available_withdrawable_credits: {
        Args: { credit_aging_days_param: number; user_id_param: string }
        Returns: number
      }
      get_coach_paychangu_secret: {
        Args: { _coach_id: string }
        Returns: string
      }
      get_coach_payment_key: {
        Args: { coach_user_id: string }
        Returns: string
      }
      get_file_signed_url_placeholder: {
        Args: { file_path: string }
        Returns: string
      }
      get_next_lesson: {
        Args: { _course_id: string; _user_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_file_download: { Args: { file_id: string }; Returns: undefined }
      is_login_locked: {
        Args: { p_email: string; p_ip: unknown }
        Returns: boolean
      }
      is_subscription_expiring_soon: {
        Args: { _days_ahead?: number; _subscription_id: string }
        Returns: boolean
      }
      issue_course_certificate: {
        Args: { p_course_id: string; p_user_id: string }
        Returns: string
      }
      mark_lesson_complete: {
        Args: { _lesson_id: string; _user_id: string }
        Returns: boolean
      }
      mark_old_processing_withdrawals_as_pending: {
        Args: never
        Returns: {
          hours_processing: number
          new_status: string
          old_status: string
          withdrawal_id: string
        }[]
      }
      process_withdrawal: {
        Args: {
          amount_mwk: number
          coach_id: string
          credits_amount: number
          payment_method?: string
          payout_ref?: string
          payout_trans_id?: string
          withdrawal_id: string
        }
        Returns: Json
      }
      record_login_attempt: {
        Args: {
          p_email: string
          p_failure_reason?: string
          p_ip?: unknown
          p_success: boolean
          p_user_id?: string
        }
        Returns: undefined
      }
      refund_failed_withdrawal: {
        Args: {
          coach_id: string
          credits_amount: number
          withdrawal_id: string
        }
        Returns: Json
      }
      rollback_transaction: { Args: never; Returns: string }
      rotate_user_session_version: {
        Args: { p_reason?: string; p_user_id: string }
        Returns: number
      }
      transfer_credits: {
        Args: {
          amount: number
          description?: string
          from_user_id: string
          metadata?: Json
          reference_id?: string
          reference_type?: string
          to_user_id: string
          transaction_type: string
        }
        Returns: Json
      }
      update_course_rating: {
        Args: { course_uuid: string }
        Returns: undefined
      }
      upsert_own_role: {
        Args: { p_role: Database["public"]["Enums"]["app_role"] }
        Returns: Json
      }
      verify_certificate: {
        Args: { p_certificate_id: string }
        Returns: {
          certificate_id: string
          coach_name: string
          course_title: string
          expires_at: string
          is_valid: boolean
          issued_at: string
          student_name: string
          verification_status: string
        }[]
      }
    }
    Enums: {
      app_role: "client" | "coach" | "admin"
      content_type:
        | "video"
        | "text"
        | "quiz"
        | "interactive"
        | "file"
        | "meeting"
      course_level: "introduction" | "intermediate" | "advanced"
      course_status: "draft" | "published" | "archived"
      enrollment_status: "active" | "completed" | "dropped"
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
    | keyof (DefaultSchema["Tables"]) &
        DefaultSchema["Views"]
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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"]) &
        DefaultSchema["Views"]
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
      app_role: ["client", "coach", "admin"],
      content_type: ["video", "text", "quiz", "interactive", "file", "meeting"],
      course_level: ["introduction", "intermediate", "advanced"],
      course_status: ["draft", "published", "archived"],
      enrollment_status: ["active", "completed", "dropped"],
    },
  },
} as const

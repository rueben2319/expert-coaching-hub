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
          paychangu_key_vault_id: string | null
          paychangu_secret_key: string | null
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          paychangu_enabled?: boolean
          paychangu_key_vault_id?: string | null
          paychangu_secret_key?: string | null
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          paychangu_enabled?: boolean
          paychangu_key_vault_id?: string | null
          paychangu_secret_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      coach_subscriptions: {
        Row: {
          billing_cycle: string
          coach_id: string
          created_at: string
          failed_renewal_attempts: number
          grace_expires_at: string | null
          end_date: string | null
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
          failed_renewal_attempts?: number
          grace_expires_at?: string | null
          end_date?: string | null
          id?: string
          payment_method?: string | null
          renewal_date?: string | null
          start_date?: string
          status?: string
          tier_id: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          coach_id?: string
          created_at?: string
          failed_renewal_attempts?: number
          grace_expires_at?: string | null
          end_date?: string | null
          id?: string
          payment_method?: string | null
          renewal_date?: string | null
          start_date?: string
          status?: string
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
          updated_at: string | null
        }
        Insert: {
          content_text: string
          course_id: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          content_text?: string
          course_id?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_embeddings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: true
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
          {
            foreignKeyName: "course_enrollments_credit_transaction_id_fkey"
            columns: ["credit_transaction_id"]
            isOneToOne: false
            referencedRelation: "credit_transactions"
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
          order_index: number
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
      courses: {
        Row: {
          category: string | null
          coach_id: string
          created_at: string
          description: string | null
          id: string
          is_free: boolean | null
          level: Database["public"]["Enums"]["course_level"] | null
          price_credits: number | null
          status: Database["public"]["Enums"]["course_status"]
          tag: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          coach_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_free?: boolean | null
          level?: Database["public"]["Enums"]["course_level"] | null
          price_credits?: number | null
          status?: Database["public"]["Enums"]["course_status"]
          tag?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          coach_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_free?: boolean | null
          level?: Database["public"]["Enums"]["course_level"] | null
          price_credits?: number | null
          status?: Database["public"]["Enums"]["course_status"]
          tag?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_packages: {
        Row: {
          bonus_credits: number | null
          created_at: string
          credits: number
          description: string | null
          id: string
          is_active: boolean
          name: string
          price_mwk: number
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          bonus_credits?: number | null
          created_at?: string
          credits: number
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price_mwk: number
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          bonus_credits?: number | null
          created_at?: string
          credits?: number
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price_mwk?: number
          sort_order?: number | null
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
        Relationships: []
      }
      credit_wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          total_earned: number
          total_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          client_subscription_id: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          invoice_date: string
          invoice_number: string
          order_id: string | null
          payment_method: string | null
          pdf_url: string | null
          status: string
          subscription_id: string | null
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          client_subscription_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          order_id?: string | null
          payment_method?: string | null
          pdf_url?: string | null
          status?: string
          subscription_id?: string | null
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          client_subscription_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          order_id?: string | null
          payment_method?: string | null
          pdf_url?: string | null
          status?: string
          subscription_id?: string | null
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "coach_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_completion_attempts: {
        Row: {
          attempted_at: string
          completed_count: number
          details: Json | null
          id: string
          lesson_id: string
          required_count: number
          success: boolean
          user_id: string
        }
        Insert: {
          attempted_at?: string
          completed_count: number
          details?: Json | null
          id?: string
          lesson_id: string
          required_count: number
          success: boolean
          user_id: string
        }
        Update: {
          attempted_at?: string
          completed_count?: number
          details?: Json | null
          id?: string
          lesson_id?: string
          required_count?: number
          success?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_lesson_completion_lesson"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
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
          content_type: Database["public"]["Enums"]["content_type"]
          created_at: string
          id: string
          is_required: boolean
          lesson_id: string
          order_index: number
          updated_at: string
        }
        Insert: {
          content_data: Json
          content_type: Database["public"]["Enums"]["content_type"]
          created_at?: string
          id?: string
          is_required?: boolean
          lesson_id: string
          order_index: number
          updated_at?: string
        }
        Update: {
          content_data?: Json
          content_type?: Database["public"]["Enums"]["content_type"]
          created_at?: string
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
          id: string
          is_completed: boolean
          lesson_id: string
          started_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          is_completed?: boolean
          lesson_id: string
          started_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          is_completed?: boolean
          lesson_id?: string
          started_at?: string
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
          order_index: number
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
          user_id: string
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
          status?: string | null
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
          status?: string | null
          summary?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_exercise_items: {
        Row: {
          answer: string | null
          approved: boolean
          choices: Json | null
          created_at: string
          difficulty: string | null
          exercise_type: string
          explanation: string | null
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
          exercise_type: string
          explanation?: string | null
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
          exercise_type?: string
          explanation?: string | null
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
          {
            foreignKeyName: "practice_exercise_items_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "v_practice_exercise_coach_scope"
            referencedColumns: ["set_id"]
          },
        ]
      }
      practice_exercise_sets: {
        Row: {
          approved_at: string | null
          content_id: string | null
          created_at: string
          difficulty: string | null
          generated_by: string | null
          id: string
          lesson_id: string | null
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
          content_id?: string | null
          created_at?: string
          difficulty?: string | null
          generated_by?: string | null
          id?: string
          lesson_id?: string | null
          model_used?: string | null
          prompt_context?: Json | null
          raw_output?: Json | null
          skill_focus?: string | null
          status?: string
          target_audience?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          content_id?: string | null
          created_at?: string
          difficulty?: string | null
          generated_by?: string | null
          id?: string
          lesson_id?: string | null
          model_used?: string | null
          prompt_context?: Json | null
          raw_output?: Json | null
          skill_focus?: string | null
          status?: string
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
          id: string
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
          created_at: string | null
          expires_at: string | null
          id: string
          reason: string | null
          recommended_course_id: string
          similarity_score: number | null
          source_course_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          reason?: string | null
          recommended_course_id: string
          similarity_score?: number | null
          source_course_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          reason?: string | null
          recommended_course_id?: string
          similarity_score?: number | null
          source_course_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommended_courses_recommended_course_id_fkey"
            columns: ["recommended_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommended_courses_source_course_id_fkey"
            columns: ["source_course_id"]
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
          ip_address: string | null
          target_user_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          target_user_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          target_user_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      subscription_audit_log: {
        Row: {
          change_reason: string | null
          changed_by: string | null
          created_at: string
          id: string
          metadata: Json | null
          new_status: string
          old_status: string | null
          subscription_id: string
          subscription_type: string
        }
        Insert: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_status: string
          old_status?: string | null
          subscription_id: string
          subscription_type: string
        }
        Update: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_status?: string
          old_status?: string | null
          subscription_id?: string
          subscription_type?: string
        }
        Relationships: []
      }
      tiers: {
        Row: {
          created_at: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          max_courses: number | null
          max_students: number | null
          name: string
          price_monthly: number
          price_yearly: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          max_courses?: number | null
          max_students?: number | null
          name: string
          price_monthly: number
          price_yearly: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          max_courses?: number | null
          max_students?: number | null
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
          credit_package_id: string | null
          credits_amount: number | null
          currency: string
          gateway_response: Json | null
          id: string
          order_id: string | null
          status: string
          subscription_id: string | null
          transaction_mode: string | null
          transaction_ref: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          credit_package_id?: string | null
          credits_amount?: number | null
          currency?: string
          gateway_response?: Json | null
          id?: string
          order_id?: string | null
          status?: string
          subscription_id?: string | null
          transaction_mode?: string | null
          transaction_ref: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          credit_package_id?: string | null
          credits_amount?: number | null
          currency?: string
          gateway_response?: Json | null
          id?: string
          order_id?: string | null
          status?: string
          subscription_id?: string | null
          transaction_mode?: string | null
          transaction_ref?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_credit_package_id_fkey"
            columns: ["credit_package_id"]
            isOneToOne: false
            referencedRelation: "credit_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "coach_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_role_changes: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
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
      webhook_processing_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          payload: Json
          processed_at: string | null
          status: string
          tx_ref: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          payload: Json
          processed_at?: string | null
          status: string
          tx_ref: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          status?: string
          tx_ref?: string
          updated_at?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          amount: number
          coach_id: string
          created_at: string
          credits_amount: number
          fraud_reasons: Json | null
          fraud_score: number | null
          id: string
          ip_address: string | null
          last_retry_at: string | null
          notes: string | null
          original_withdrawal_id: string | null
          payment_details: Json
          payment_method: string
          processed_at: string | null
          processed_by: string | null
          rejection_reason: string | null
          retry_count: number | null
          status: string
          transaction_ref: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          amount: number
          coach_id: string
          created_at?: string
          credits_amount: number
          fraud_reasons?: Json | null
          fraud_score?: number | null
          id?: string
          ip_address?: string | null
          last_retry_at?: string | null
          notes?: string | null
          original_withdrawal_id?: string | null
          payment_details: Json
          payment_method?: string
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          retry_count?: number | null
          status?: string
          transaction_ref?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          amount?: number
          coach_id?: string
          created_at?: string
          credits_amount?: number
          fraud_reasons?: Json | null
          fraud_score?: number | null
          id?: string
          ip_address?: string | null
          last_retry_at?: string | null
          notes?: string | null
          original_withdrawal_id?: string | null
          payment_details?: Json
          payment_method?: string
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          retry_count?: number | null
          status?: string
          transaction_ref?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
    }
    Views: {
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
      v_practice_exercise_coach_scope: {
        Row: {
          coach_id: string | null
          generated_by: string | null
          set_id: string | null
        }
        Relationships: []
      }
      withdrawal_analytics: {
        Row: {
          avg_fraud_score: number | null
          coach_id: string | null
          completed_count: number | null
          failed_count: number | null
          first_request_at: string | null
          last_request_at: string | null
          processing_count: number | null
          total_credits_requested: number | null
          total_credits_withdrawn: number | null
          total_requests: number | null
        }
        Relationships: []
      }
    }
    Functions: {
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
      commit_transaction: { Args: never; Returns: string }
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
      generate_invoice_number: { Args: never; Returns: string }
      get_aged_credits: {
        Args: { p_min_age_days?: number; p_user_id: string }
        Returns: number
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
      is_subscription_expiring_soon: {
        Args: { _days_ahead?: number; _subscription_id: string }
        Returns: boolean
      }
      mark_lesson_complete: {
        Args: { _lesson_id: string; _user_id: string }
        Returns: boolean
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
      refund_failed_withdrawal: {
        Args: {
          coach_id: string
          credits_amount: number
          withdrawal_id: string
        }
        Returns: Json
      }
      rollback_transaction: { Args: never; Returns: string }
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
      upsert_own_role: {
        Args: { p_role: Database["public"]["Enums"]["app_role"] }
        Returns: Json
      }
    }
    Enums: {
      app_role: "client" | "coach" | "admin"
      content_type: "video" | "text" | "quiz" | "interactive" | "file"
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
      app_role: ["client", "coach", "admin"],
      content_type: ["video", "text", "quiz", "interactive", "file"],
      course_level: ["introduction", "intermediate", "advanced"],
      course_status: ["draft", "published", "archived"],
      enrollment_status: ["active", "completed", "dropped"],
    },
  },
} as const

-- Phase 0 AI foundation migration

-- Ensure pgvector extension is available for embeddings
create extension if not exists "vector";

-- Table to log AI activity for auditing and analytics
create table if not exists public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  actor_role text check (actor_role in ('coach', 'client', 'admin', 'system')),
  action_key text not null,
  prompt text not null,
  response text,
  response_format text default 'markdown',
  tokens_prompt integer default 0,
  tokens_completion integer default 0,
  provider text default 'openai',
  model text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists ai_generations_user_created_idx
  on public.ai_generations (user_id, created_at desc);

-- Table for learner notes (manual or AI generated)
create table if not exists public.client_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete cascade,
  content_id uuid references public.lesson_content (id) on delete set null,
  note text not null,
  source text default 'manual', -- manual | ai_summary | ai_flashcard | ai_qna
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists client_notes_user_created_idx
  on public.client_notes (user_id, created_at desc);

-- Vector store for semantic search over lessons/content
create table if not exists public.course_content_embeddings (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references public.lessons (id) on delete cascade,
  content_id uuid references public.lesson_content (id) on delete cascade,
  embedding vector(1536),
  chunk text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  unique (lesson_id, content_id)
);

create index if not exists course_content_embeddings_lesson_idx
  on public.course_content_embeddings (lesson_id);

create index if not exists course_content_embeddings_embedding_idx
  on public.course_content_embeddings
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Enable row level security
alter table public.ai_generations enable row level security;
alter table public.client_notes enable row level security;
alter table public.course_content_embeddings enable row level security;

-- RLS for ai_generations: inserted via service role, authors can read their own, service role full access
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_generations'
      AND policyname = 'ai_generations_select_self'
  ) THEN
    CREATE POLICY "ai_generations_select_self" ON public.ai_generations
      FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_generations'
      AND policyname = 'ai_generations_insert_service'
  ) THEN
    CREATE POLICY "ai_generations_insert_service" ON public.ai_generations
      FOR INSERT WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- RLS for client_notes: learners manage their notes, service role allowed for AI automation
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'client_notes'
      AND policyname = 'client_notes_select_owner'
  ) THEN
    CREATE POLICY "client_notes_select_owner" ON public.client_notes
      FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'client_notes'
      AND policyname = 'client_notes_insert_owner'
  ) THEN
    CREATE POLICY "client_notes_insert_owner" ON public.client_notes
      FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'client_notes'
      AND policyname = 'client_notes_update_owner'
  ) THEN
    CREATE POLICY "client_notes_update_owner" ON public.client_notes
      FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'client_notes'
      AND policyname = 'client_notes_delete_owner'
  ) THEN
    CREATE POLICY "client_notes_delete_owner" ON public.client_notes
      FOR DELETE USING (auth.uid() = user_id OR auth.role() = 'service_role');
  END IF;
END $$;

-- RLS for embeddings: read allowed for everyone (content discovery), modify only via service role jobs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'course_content_embeddings'
      AND policyname = 'course_content_embeddings_select_all'
  ) THEN
    CREATE POLICY "course_content_embeddings_select_all" ON public.course_content_embeddings
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'course_content_embeddings'
      AND policyname = 'course_content_embeddings_insert_service'
  ) THEN
    CREATE POLICY "course_content_embeddings_insert_service" ON public.course_content_embeddings
      FOR INSERT WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'course_content_embeddings'
      AND policyname = 'course_content_embeddings_update_service'
  ) THEN
    CREATE POLICY "course_content_embeddings_update_service" ON public.course_content_embeddings
      FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'course_content_embeddings'
      AND policyname = 'course_content_embeddings_delete_service'
  ) THEN
    CREATE POLICY "course_content_embeddings_delete_service" ON public.course_content_embeddings
      FOR DELETE USING (auth.role() = 'service_role');
  END IF;
END $$;

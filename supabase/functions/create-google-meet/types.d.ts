// Deno Edge Runtime Types for Supabase Functions

declare global {
  const Deno: {
    env: {
      get(key: string): string | undefined;
    };
  };
}

// Deno standard library types
declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(
    handler: (request: Request) => Response | Promise<Response>,
    options?: { port?: number; hostname?: string }
  ): Promise<void>;
}

// Supabase client types
declare module "https://esm.sh/@supabase/supabase-js@2.74.0" {
  export interface SupabaseClient {
    auth: {
      getSession(): Promise<{ data: { session: any }, error: any }>;
      getUser(): Promise<{ data: { user: any }, error: any }>;
    };
    from(table: string): {
      insert(data: any): {
        select(): {
          single(): Promise<{ data: any, error: any }>;
        };
      };
    };
  }
  
  export function createClient(url: string, key: string): SupabaseClient;
}

export {};

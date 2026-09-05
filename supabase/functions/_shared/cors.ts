/**
 * Shared CORS configuration for Supabase Edge Functions
 * 
 * Security: Restricts CORS to specific origins instead of wildcard
 * Environment: Uses ALLOWED_ORIGINS env var (comma-separated list)
 * Fallback: Uses production app URL if no env var set
 */

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

/**
 * Get allowed origins from environment or fallback to app URL
 */
function getAllowedOrigins(): string[] {
  const allowedOriginsEnv = Deno.env.get("ALLOWED_ORIGINS");
  const appBaseUrl = Deno.env.get("APP_BASE_URL") || "http://localhost:8080";
  
  if (allowedOriginsEnv) {
    return allowedOriginsEnv.split(",").map(origin => origin.trim());
  }
  
  // Fallback to app base URL
  return [appBaseUrl];
}

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  
  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.some(allowed => {
    // Exact match
    if (allowed === origin) return true;
    
    // Subdomain wildcard support (e.g., https://*.example.com)
    if (allowed.includes("*")) {
      const pattern = allowed.replace(/\*/g, ".*");
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(origin);
    }
    
    return false;
  });
}

/**
 * Get CORS headers for a given request origin
 */
export function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const allowedOrigins = getAllowedOrigins();
  const isAllowed = isOriginAllowed(requestOrigin);
  
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "OPTIONS, POST, GET, PUT, DELETE, PATCH",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, signature",
    "Access-Control-Max-Age": "86400", // 24 hours
    "Access-Control-Allow-Credentials": "true",
  };
  
  // Only set specific origin if allowed, otherwise return no CORS headers
  if (isAllowed && requestOrigin) {
    headers["Access-Control-Allow-Origin"] = requestOrigin;
  } else if (allowedOrigins.length === 1) {
    // If only one origin allowed, return it directly
    headers["Access-Control-Allow-Origin"] = allowedOrigins[0];
  }
  
  return headers;
}

/**
 * Handle OPTIONS preflight request
 */
export function handleCorsPreflight(requestOrigin: string | null): Response {
  const headers = getCorsHeaders(requestOrigin);
  return new Response(null, { headers, status: 204 });
}

/**
 * Wrap response with CORS headers
 */
export function withCorsHeaders(response: Response, requestOrigin: string | null): Response {
  const headers = getCorsHeaders(requestOrigin);
  
  // Create new response with CORS headers
  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      ...Object.fromEntries(response.headers.entries()),
      ...headers,
    },
  });
  
  return newResponse;
}
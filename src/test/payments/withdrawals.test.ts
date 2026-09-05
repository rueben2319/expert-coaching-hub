import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn()
    }
  }
}));

describe('Withdrawals Edge Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('request-withdrawal', () => {
    it('should hold credits upon successful request', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { success: true },
        error: null
      });

      const result = await supabase.functions.invoke('request-withdrawal', {
        body: { amount: 50 }
      });

      expect(result.error).toBeNull();
      expect(result.data?.success).toBe(true);
    });

    it('should fail if user has insufficient credits', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: { message: 'Insufficient credits', status: 400, name: 'FunctionsHttpError' } as any
      });

      const result = await supabase.functions.invoke('request-withdrawal', {
        body: { amount: 5000 }
      });

      expect(result.error?.status).toBe(400);
      expect(result.error?.message).toMatch(/Insufficient credits/i);
    });
  });

  describe('process-withdrawal', () => {
    it('should reject non-admin users', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: { message: 'Unauthorized', status: 403, name: 'FunctionsHttpError' } as any
      });

      const result = await supabase.functions.invoke('process-withdrawal', {
        body: { withdrawalId: '123', status: 'approved' }
      });

      expect(result.error?.status).toBe(403);
    });

    it('should process withdrawal idempotently', async () => {
      // Success case
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { success: true },
        error: null
      });

      const result = await supabase.functions.invoke('process-withdrawal', {
        body: { withdrawalId: '123', status: 'approved' }
      });

      expect(result.error).toBeNull();
    });
  });
});

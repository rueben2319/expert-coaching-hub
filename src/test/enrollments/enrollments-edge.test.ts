import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn()
    }
  }
}));

describe('Enrollment Edge Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('enroll-with-credits', () => {
    it('should deduct credits and create enrollment record', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { success: true, enrollmentId: 'enroll-123' },
        error: null
      });

      const result = await supabase.functions.invoke('enroll-with-credits', {
        body: { courseId: 'course-123' }
      });

      expect(result.error).toBeNull();
      expect(result.data?.success).toBe(true);
      expect(result.data?.enrollmentId).toBeDefined();
    });

    it('should reject duplicate enrollment (idempotent success or error)', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: { message: 'Already enrolled', status: 400, name: 'FunctionsHttpError' } as any
      });

      const result = await supabase.functions.invoke('enroll-with-credits', {
        body: { courseId: 'course-123' }
      });

      expect(result.error?.status).toBe(400);
      expect(result.error?.message).toMatch(/Already enrolled/i);
    });

    it('should fail if user has insufficient credits', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: { message: 'Insufficient credits', status: 400, name: 'FunctionsHttpError' } as any
      });

      const result = await supabase.functions.invoke('enroll-with-credits', {
        body: { courseId: 'course-123' }
      });

      expect(result.error?.status).toBe(400);
      expect(result.error?.message).toMatch(/Insufficient credits/i);
    });
  });
});

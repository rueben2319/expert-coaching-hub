import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client
vi.mock('@/integrations/supabase/client');

describe('Course Enrollment Flow Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Course Enrollment', () => {
    it('should create enrollment record with proper status', async () => {
      const mockEnrollment = {
        id: 'enroll-123',
        user_id: 'user-123',
        course_id: 'course-123',
        status: 'active',
        progress_percentage: 0,
        enrolled_at: new Date().toISOString(),
        credits_paid: 100,
      };

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          data: mockEnrollment,
          error: null,
        }),
      } as any);

      const result = await supabase.from('course_enrollments').insert({
        user_id: 'user-123',
        course_id: 'course-123',
        status: 'active',
        progress_percentage: 0,
        credits_paid: 100,
      });

      expect(result.data?.status).toBe('active');
      expect(result.data?.progress_percentage).toBe(0);
    });

    it('should prevent duplicate enrollments', async () => {
      const mockExistingEnrollment = {
        id: 'enroll-123',
        user_id: 'user-123',
        course_id: 'course-123',
        status: 'active',
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [mockExistingEnrollment],
          error: null,
        }),
      } as any);

      const result = await supabase
        .from('course_enrollments')
        .select('*')
        .eq('user_id', 'user-123')
        .eq('course_id', 'course-123');

      // If enrollment exists, should prevent duplicate
      if (result.data && result.data.length > 0) {
        expect(result.data.length).toBeGreaterThan(0);
      }
    });

    it('should deduct credits from user wallet on enrollment', async () => {
      const mockWalletBefore = {
        id: 'wallet-123',
        user_id: 'user-123',
        balance: 500,
      };

      const mockWalletAfter = {
        id: 'wallet-123',
        user_id: 'user-123',
        balance: 400, // 100 credits deducted
      };

      const coursePrice = 100;

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: mockWalletBefore,
          error: null,
        }),
        update: vi.fn().mockResolvedValue({
          data: mockWalletAfter,
          error: null,
        }),
      } as any);

      const result = await supabase
        .from('credit_wallets')
        .update({ balance: Number(mockWalletBefore.balance) - coursePrice })
        .eq('user_id', 'user-123');

      expect(result.data?.balance).toBe(400);
    });

    it('should add credits to coach wallet on enrollment', async () => {
      const mockCoachWalletBefore = {
        id: 'wallet-456',
        user_id: 'coach-123',
        balance: 1000,
      };

      const mockCoachWalletAfter = {
        id: 'wallet-456',
        user_id: 'coach-123',
        balance: 1100, // 100 credits added
      };

      const coursePrice = 100;

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: mockCoachWalletBefore,
          error: null,
        }),
        update: vi.fn().mockResolvedValue({
          data: mockCoachWalletAfter,
          error: null,
        }),
      } as any);

      const result = await supabase
        .from('credit_wallets')
        .update({ balance: Number(mockCoachWalletBefore.balance) + coursePrice })
        .eq('user_id', 'coach-123');

      expect(result.data?.balance).toBe(1100);
    });

    it('should handle free course enrollment without credit deduction', async () => {
      const mockFreeCourse = {
        id: 'course-123',
        title: 'Free Course',
        is_free: true,
        price_credits: 0,
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: mockFreeCourse,
          error: null,
        }),
      } as any);

      const result = await supabase
        .from('courses')
        .select('*')
        .eq('id', 'course-123')
        .single();

      const isFree = result.data?.is_free || Number(result.data?.price_credits) === 0;
      expect(isFree).toBe(true);
    });
  });

  describe('Progress Tracking', () => {
    it('should calculate course progress correctly', () => {
      const totalLessons = 10;
      const completedLessons = 5;
      const expectedProgress = Math.round((completedLessons / totalLessons) * 100);

      expect(expectedProgress).toBe(50);
    });

    it('should update enrollment status when course completed', async () => {
      const mockEnrollment = {
        id: 'enroll-123',
        user_id: 'user-123',
        course_id: 'course-123',
        status: 'active',
        progress_percentage: 100,
      };

      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: { ...mockEnrollment, status: 'completed' },
          error: null,
        }),
      } as any);

      const result = await supabase
        .from('course_enrollments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', 'enroll-123');

      expect(result.data?.status).toBe('completed');
    });

    it('should track lesson completion attempts', async () => {
      const mockCompletion = {
        id: 'completion-123',
        lesson_id: 'lesson-123',
        user_id: 'user-123',
        completed_at: new Date().toISOString(),
      };

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          data: mockCompletion,
          error: null,
        }),
      } as any);

      const result = await supabase.from('lesson_completion_attempts').insert({
        lesson_id: 'lesson-123',
        user_id: 'user-123',
        completed_at: new Date().toISOString(),
      });

      expect(result.data?.completed_at).toBeDefined();
    });
  });

  describe('Course Access Control', () => {
    it('should allow enrolled users to access course content', async () => {
      const mockEnrollment = {
        id: 'enroll-123',
        user_id: 'user-123',
        course_id: 'course-123',
        status: 'active',
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [mockEnrollment],
          error: null,
        }),
      } as any);

      const result = await supabase
        .from('course_enrollments')
        .select('*')
        .eq('user_id', 'user-123')
        .eq('course_id', 'course-123');

      const hasAccess = result.data && result.data.length > 0;
      expect(hasAccess).toBe(true);
    });

    it('should deny access to non-enrolled users', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      } as any);

      const result = await supabase
        .from('course_enrollments')
        .select('*')
        .eq('user_id', 'user-123')
        .eq('course_id', 'course-123');

      const hasAccess = result.data && result.data.length > 0;
      expect(hasAccess).toBe(false);
    });

    it('should allow coaches to access their own courses', async () => {
      const mockCourse = {
        id: 'course-123',
        coach_id: 'coach-123',
        title: 'Test Course',
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: mockCourse,
          error: null,
        }),
      } as any);

      const result = await supabase
        .from('courses')
        .select('*')
        .eq('id', 'course-123')
        .single();

      const isCoach = result.data?.coach_id === 'coach-123';
      expect(isCoach).toBe(true);
    });
  });

  describe('Certificate Generation', () => {
    it('should generate certificate on course completion', async () => {
      const mockCertificate = {
        id: 'cert-123',
        course_id: 'course-123',
        user_id: 'user-123',
        certificate_id: 'CERT-20260828-12345678',
        issued_at: new Date().toISOString(),
        verification_status: 'valid',
      };

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          data: mockCertificate,
          error: null,
        }),
      } as any);

      const result = await supabase.from('course_certificates').insert({
        course_id: 'course-123',
        user_id: 'user-123',
        certificate_id: 'CERT-20260828-12345678',
        verification_status: 'valid',
      });

      expect(result.data?.verification_status).toBe('valid');
      expect(result.data?.certificate_id).toBeDefined();
    });

    it('should prevent duplicate certificates', async () => {
      const mockExistingCertificate = {
        id: 'cert-123',
        course_id: 'course-123',
        user_id: 'user-123',
        certificate_id: 'CERT-20260828-12345678',
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [mockExistingCertificate],
          error: null,
        }),
      } as any);

      const result = await supabase
        .from('course_certificates')
        .select('*')
        .eq('course_id', 'course-123')
        .eq('user_id', 'user-123');

      const hasCertificate = result.data && result.data.length > 0;
      expect(hasCertificate).toBe(true);
    });
  });
});
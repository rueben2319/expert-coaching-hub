// @ts-ignore: Deno imports work at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports work at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

// Deno global type declaration for IDE
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "OPTIONS, POST",
  "Access-Control-Max-Age": "86400",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { course_id } = body;

    // Validate course_id
    if (!course_id || typeof course_id !== 'string') {
      return new Response(JSON.stringify({ error: "course_id must be a valid string" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(course_id)) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid course ID format. Please ensure you're using a valid course link." 
        }), 
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if already enrolled
    const { data: existingEnrollment } = await supabase
      .from("course_enrollments")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_id", course_id)
      .single();

    if (existingEnrollment) {
      return new Response(JSON.stringify({ error: "Already enrolled in this course" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch course details
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id, title, price_credits, is_free, coach_id")
      .eq("id", course_id)
      .eq("status", "published")
      .single();

    if (courseError || !course) {
      return new Response(JSON.stringify({ error: "Course not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle free courses
    if (course.is_free || !course.price_credits || course.price_credits === 0) {
      const { data: enrollment, error: enrollError } = await supabase
        .from("course_enrollments")
        .insert({
          user_id: user.id,
          course_id: course_id,
          credits_paid: 0,
          payment_status: "free",
        })
        .select()
        .single();

      if (enrollError) {
        throw new Error("Failed to create enrollment: " + enrollError.message);
      }

      return new Response(
        JSON.stringify({
          success: true,
          enrollment_id: enrollment.id,
          message: "Enrolled successfully (free course)",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle paid courses - use transfer_credits function
    const creditsRequired = Number(course.price_credits);

    // Validate course price configuration
    if (isNaN(creditsRequired) || creditsRequired < 0) {
      return new Response(
        JSON.stringify({ error: "Invalid course price configuration" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!Number.isInteger(creditsRequired)) {
      return new Response(
        JSON.stringify({ error: "Course price must be a whole number of credits" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call the transfer_credits database function
    const { data: transferResult, error: transferError } = await supabase.rpc(
      "transfer_credits",
      {
        from_user_id: user.id,
        to_user_id: course.coach_id,
        amount: creditsRequired,
        transaction_type: "course_payment",
        reference_type: "course_enrollment",
        reference_id: course_id,
        description: `Enrolled in course: ${course.title}`,
        metadata: {
          course_id: course_id,
          course_title: course.title,
        },
      }
    );

    if (transferError) {
      console.error("Transfer error:", transferError);
      return new Response(
        JSON.stringify({
          error: transferError.message || "Failed to transfer credits",
          details: transferError,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate transfer result structure
    if (!transferResult) {
      console.error("Transfer succeeded but returned null/undefined result");
      return new Response(
        JSON.stringify({
          error: "Credit transfer completed but no result received",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if transfer was successful
    if (transferResult.success === false || (typeof transferResult === 'object' && !transferResult.success && !transferResult.sender_transaction_id)) {
      console.error("Transfer failed:", transferResult);
      return new Response(
        JSON.stringify({
          error: "Credit transfer failed",
          details: transferResult,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate that we have the required transaction ID
    if (!transferResult.sender_transaction_id) {
      console.error("Transfer succeeded but missing sender_transaction_id:", transferResult);
      return new Response(
        JSON.stringify({
          error: "Credit transfer completed but transaction ID is missing",
          details: transferResult,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create enrollment record
    const { data: enrollment, error: enrollError } = await supabase
      .from("course_enrollments")
      .insert({
        user_id: user.id,
        course_id: course_id,
        credits_paid: creditsRequired,
        payment_status: "paid",
        credit_transaction_id: transferResult.sender_transaction_id,
      })
      .select()
      .single();

    if (enrollError) {
      console.error("Enrollment error:", enrollError);
      
      // Attempt to refund credits if enrollment creation fails
      // Note: This is a best-effort attempt - the refund function may not exist
      // If it doesn't exist, log for manual intervention
      try {
        const { error: refundError } = await supabase.rpc('refund_credits', {
          from_user_id: course.coach_id,
          to_user_id: user.id,
          amount: creditsRequired,
          original_transaction_id: transferResult.sender_transaction_id,
          reason: 'Enrollment creation failed'
        }).catch(() => ({ error: { message: 'Refund function not available' } }));
        
        if (refundError) {
          console.error("Critical: Failed to refund credits after enrollment failure:", refundError);
          // Log for manual intervention - this is a critical data integrity issue
          await supabase.from('error_logs').insert({
            error_type: 'enrollment_refund_failed',
            details: {
              user_id: user.id,
              course_id: course_id,
              credits: creditsRequired,
              enrollment_error: enrollError.message,
              refund_error: refundError.message || 'Refund function not available',
              transaction_id: transferResult.sender_transaction_id
            }
          }).catch((logError) => {
            console.error("Failed to log error:", logError);
          });
        } else {
          console.log("Successfully refunded credits after enrollment failure");
        }
      } catch (refundErr: any) {
        console.error("Failed to process refund:", refundErr);
        // Log for manual intervention
        await supabase.from('error_logs').insert({
          error_type: 'enrollment_refund_failed',
          details: {
            user_id: user.id,
            course_id: course_id,
            credits: creditsRequired,
            enrollment_error: enrollError.message,
            refund_error: refundErr.message || 'Unknown error during refund',
            transaction_id: transferResult.sender_transaction_id
          }
        }).catch((logError) => {
          console.error("Failed to log error:", logError);
        });
      }
      
      return new Response(
        JSON.stringify({
          error: "Failed to create enrollment: " + enrollError.message,
          note: "Credits have been deducted. If enrollment was not created, please contact support.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        enrollment_id: enrollment.id,
        credits_paid: creditsRequired,
        message: "Enrolled successfully",
        transaction_id: transferResult.sender_transaction_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("Error in enroll-with-credits:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

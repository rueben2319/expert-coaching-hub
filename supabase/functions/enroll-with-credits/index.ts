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
      return new Response(JSON.stringify({ error: "Invalid course_id format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      throw new Error("Failed to create enrollment: " + enrollError.message);
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

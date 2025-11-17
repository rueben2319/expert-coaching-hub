// @ts-ignore: Deno imports work at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports work at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

// Minimal Deno type declaration for environment access
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const GRACE_PERIOD_DAYS = Number(Deno.env.get("GRACE_PERIOD_DAYS") ?? 3);
const RENEWAL_MAX_ATTEMPTS = Number(Deno.env.get("RENEWAL_MAX_ATTEMPTS") ?? 3);
const SUBSCRIPTION_ALERT_WEBHOOK = Deno.env.get("SUBSCRIPTION_ALERT_WEBHOOK");

async function notifySubscriptionAlert(params: {
  supabase: ReturnType<typeof createClient>;
  subscriptionId: string;
  oldStatus: string;
  newStatus: string;
  reason: string;
  metadata?: Record<string, unknown>;
}) {
  const { supabase, subscriptionId, oldStatus, newStatus, reason, metadata } = params;
  try {
    await supabase.from("subscription_audit_log").insert({
      subscription_id: subscriptionId,
      subscription_type: "coach",
      old_status: oldStatus,
      new_status: newStatus,
      changed_by: null,
      change_reason: reason,
      metadata,
    });
  } catch (error) {
    console.error("Failed to write subscription audit log:", error);
  }

  if (SUBSCRIPTION_ALERT_WEBHOOK) {
    try {
      await fetch(SUBSCRIPTION_ALERT_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription_id: subscriptionId,
          old_status: oldStatus,
          new_status: newStatus,
          reason,
          metadata,
        }),
      });
    } catch (webhookError) {
      console.error("Failed to send subscription alert webhook:", webhookError);
    }
  }
}

type CoachSubscription = {
  id: string;
  coach_id: string;
  tier_id: string;
  status: string;
  billing_cycle: "monthly" | "yearly";
  renewal_date: string | null;
  grace_expires_at: string | null;
  failed_renewal_attempts: number | null;
};

type Tier = {
  id: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
};

const MAX_RENEWALS_PER_RUN = Number(Deno.env.get("RENEWAL_BATCH_SIZE") ?? 25);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const results: Array<Record<string, unknown>> = [];

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const paychanguSecret = Deno.env.get("PAYCHANGU_SECRET_KEY");
    const defaultCurrency = Deno.env.get("PAYCHANGU_DEFAULT_CURRENCY") || "MWK";
    const appBaseUrl = Deno.env.get("APP_BASE_URL") || "https://experts-coaching-hub.com";

    if (!supabaseUrl || !supabaseKey || !paychanguSecret) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const nowIso = new Date().toISOString();

    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const batchLimit = limitParam ? Math.min(Number(limitParam), MAX_RENEWALS_PER_RUN) : MAX_RENEWALS_PER_RUN;

    const { data: dueSubscriptions, error: subsError } = await supabase
      .from("coach_subscriptions")
      .select("id, coach_id, tier_id, status, billing_cycle, renewal_date, grace_expires_at, failed_renewal_attempts")
      .in("status", ["active", "grace"])
      .lte("renewal_date", nowIso)
      .order("renewal_date", { ascending: true })
      .limit(batchLimit);

    if (subsError) {
      throw subsError;
    }

    if (!dueSubscriptions || dueSubscriptions.length === 0) {
      return new Response(
        JSON.stringify({
          processed: 0,
          message: "No coach subscriptions due for renewal",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const nowMs = Date.now();
    const graceWindowMs = GRACE_PERIOD_DAYS * DAY_IN_MS;

    for (const subscription of dueSubscriptions as CoachSubscription[]) {
      try {
        if (!subscription.renewal_date) {
          results.push({
            subscription_id: subscription.id,
            status: "skipped",
            reason: "missing_renewal_date",
          });
          continue;
        }

        if (subscription.status === "grace" && subscription.grace_expires_at) {
          const graceExpired = Date.parse(subscription.grace_expires_at) < nowMs;
          if (graceExpired) {
            await supabase
              .from("coach_subscriptions")
              .update({
                status: "expired",
                end_date: subscription.grace_expires_at,
              })
              .eq("id", subscription.id);

            await notifySubscriptionAlert({
              supabase,
              subscriptionId: subscription.id,
              oldStatus: subscription.status,
              newStatus: "expired",
              reason: "grace_period_elapsed",
              metadata: {
                grace_expires_at: subscription.grace_expires_at,
              },
            });

            results.push({
              subscription_id: subscription.id,
              status: "expired",
              reason: "grace_period_elapsed",
            });
            continue;
          }
        }

        const failedAttempts = subscription.failed_renewal_attempts ?? 0;
        if (failedAttempts >= RENEWAL_MAX_ATTEMPTS) {
          await supabase
            .from("coach_subscriptions")
            .update({
              status: "expired",
              end_date: new Date(nowMs).toISOString(),
            })
            .eq("id", subscription.id);

          await notifySubscriptionAlert({
            supabase,
            subscriptionId: subscription.id,
            oldStatus: subscription.status,
            newStatus: "expired",
            reason: "max_attempts_reached",
            metadata: {
              failed_attempts: failedAttempts,
            },
          });

          results.push({
            subscription_id: subscription.id,
            status: "expired",
            reason: "max_attempts_reached",
          });
          continue;
        }

        // Skip if there is already a pending transaction for this subscription
        const { data: existingPending } = await supabase
          .from("transactions")
          .select("id, created_at")
          .eq("subscription_id", subscription.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingPending) {
          results.push({
            subscription_id: subscription.id,
            status: "skipped",
            reason: "pending_transaction_exists",
            pending_transaction_id: existingPending.id,
          });
          continue;
        }

        const { data: tier, error: tierError } = await supabase
          .from("tiers")
          .select("id, name, price_monthly, price_yearly")
          .eq("id", subscription.tier_id)
          .single();

        if (tierError || !tier) {
          results.push({
            subscription_id: subscription.id,
            status: "failed",
            reason: "tier_not_found",
            error: tierError?.message,
          });
          continue;
        }

        const amount = subscription.billing_cycle === "yearly" ? tier.price_yearly : tier.price_monthly;

        if (!amount || amount <= 0) {
          results.push({
            subscription_id: subscription.id,
            status: "failed",
            reason: "invalid_amount",
          });
          continue;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", subscription.coach_id)
          .maybeSingle();

        const txRef = `RN-${crypto.randomUUID()}`;

        const transactionInsert = {
          user_id: subscription.coach_id,
          transaction_ref: txRef,
          amount,
          currency: defaultCurrency,
          status: "pending" as const,
          gateway_response: null,
          order_id: null,
          subscription_id: subscription.id,
          transaction_mode: "coach_subscription_renewal",
        };

        const { data: transaction, error: txError } = await supabase
          .from("transactions")
          .insert(transactionInsert)
          .select()
          .single();

        if (txError || !transaction) {
          results.push({
            subscription_id: subscription.id,
            status: "failed",
            reason: "transaction_insert_failed",
            error: txError?.message,
          });
          continue;
        }

        const first_name = profile?.full_name?.split(" ")[0] || "";
        const last_name = profile?.full_name?.split(" ")?.slice(1).join(" ") || "";

        const callbackUrl = Deno.env.get("PAYCHANGU_WEBHOOK_URL") || `${supabaseUrl}/functions/v1/paychangu-webhook`;
        const returnUrl = `${appBaseUrl}/coach/billing/success?tx_ref=${txRef}&source=renewal`;

        const payPayload = {
          amount: String(amount),
          currency: defaultCurrency,
          email: profile?.email,
          first_name,
          last_name,
          callback_url: callbackUrl,
          return_url: returnUrl,
          tx_ref: txRef,
          customization: {
            title: "Experts Coaching Hub",
            description: `Coach subscription renewal (${tier.name} - ${subscription.billing_cycle})`,
          },
          meta: {
            mode: "coach_subscription",
            subscription_id: subscription.id,
            user_id: subscription.coach_id,
            auto_renewal: true,
          },
        };

        const payResponse = await fetch("https://api.paychangu.com/payment", {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${paychanguSecret}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payPayload),
        });

        const payData = await payResponse.json();

        if (!payResponse.ok || payData.status !== "success") {
          await supabase
            .from("transactions")
            .update({
              status: "failed",
              gateway_response: payData as Record<string, unknown>,
            })
            .eq("id", transaction.id);

          const nextAttempts = failedAttempts + 1;
          const graceExpiresAt = new Date(nowMs + graceWindowMs).toISOString();
          let subscriptionStatus: "grace" | "expired" = "grace";

          if (nextAttempts >= RENEWAL_MAX_ATTEMPTS) {
            subscriptionStatus = "expired";
          }

          const updatePayload =
            subscriptionStatus === "expired"
              ? {
                  status: "expired",
                  end_date: new Date(nowMs).toISOString(),
                  failed_renewal_attempts: nextAttempts,
                  grace_expires_at: null,
                }
              : {
                  status: "grace",
                  failed_renewal_attempts: nextAttempts,
                  grace_expires_at: graceExpiresAt,
                };

          await supabase.from("coach_subscriptions").update(updatePayload).eq("id", subscription.id);

          await notifySubscriptionAlert({
            supabase,
            subscriptionId: subscription.id,
            oldStatus: subscription.status,
            newStatus: updatePayload.status,
            reason: "payment_initialization_failed",
            metadata: {
              failed_attempts: nextAttempts,
              grace_expires_at: updatePayload.grace_expires_at,
              payment_status: payData.status,
            },
          });

          results.push({
            subscription_id: subscription.id,
            status: subscriptionStatus,
            reason: "payment_initialization_failed",
            payment_status: payData.status,
            failed_attempts: nextAttempts,
            grace_expires_at: updatePayload.grace_expires_at,
          });

          continue;
        }

        await supabase
          .from("transactions")
          .update({
            gateway_response: payData as Record<string, unknown>,
          })
          .eq("id", transaction.id);

        results.push({
          subscription_id: subscription.id,
          status: "initiated",
          transaction_id: transaction.id,
          checkout_url: payData.data?.checkout_url,
        });
      } catch (subscriptionError) {
        const errorMessage = subscriptionError instanceof Error ? subscriptionError.message : "Unknown error";
        results.push({
          subscription_id: subscription.id,
          status: "error",
          reason: errorMessage,
        });
      }
    }

    return new Response(
      JSON.stringify({
        processed: results.length,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("renew-coach-subscriptions error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});


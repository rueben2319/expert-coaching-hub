-- Create subscription_audit_log table to fix coach subscription webhook error
-- This table is referenced by the log_subscription_status_change function but was never created

CREATE TABLE IF NOT EXISTS "public"."subscription_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subscription_id" "uuid" NOT NULL,
    "subscription_type" "text" NOT NULL,
    "old_status" "text",
    "new_status" "text" NOT NULL,
    "changed_by" "uuid",
    "change_reason" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- Add primary key constraint
ALTER TABLE ONLY "public"."subscription_audit_log"
    ADD CONSTRAINT "subscription_audit_log_pkey" PRIMARY KEY ("id");

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS "subscription_audit_log_subscription_id_idx" ON "public"."subscription_audit_log" USING "btree" ("subscription_id");
CREATE INDEX IF NOT EXISTS "subscription_audit_log_subscription_type_idx" ON "public"."subscription_audit_log" USING "btree" ("subscription_type");
CREATE INDEX IF NOT EXISTS "subscription_audit_log_created_at_idx" ON "public"."subscription_audit_log" USING "btree" ("created_at");

-- Add foreign key constraints
ALTER TABLE ONLY "public"."subscription_audit_log"
    ADD CONSTRAINT "subscription_audit_log_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE "public"."subscription_audit_log" ENABLE ROW LEVEL SECURITY;

-- Add RLS policies (only admins can view audit logs)
CREATE POLICY "Admins can view subscription audit logs" ON "public"."subscription_audit_log" FOR SELECT USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));
CREATE POLICY "System can insert subscription audit logs" ON "public"."subscription_audit_log" FOR INSERT WITH CHECK (true);

-- Grant permissions
GRANT ALL ON TABLE "public"."subscription_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."subscription_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_audit_log" TO "service_role";

-- Create the trigger that was missing
CREATE TRIGGER "trigger_log_subscription_status_change"
    AFTER UPDATE OF "status" ON "public"."coach_subscriptions"
    FOR EACH ROW EXECUTE FUNCTION "public"."log_subscription_status_change"();

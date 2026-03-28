/**
 * Backward-compatibility wrapper.
 *
 * Legacy integrations may still target /functions/v1/paychangu-webhook.
 * We intentionally reuse the OneKhusa webhook implementation to avoid
 * maintaining duplicate webhook processors.
 */
import "../onekhusa-webhook/index.ts";


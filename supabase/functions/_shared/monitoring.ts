/**
 * Monitoring and Alerting Utilities
 * 
 * Provides functions for logging, alerting, and monitoring critical events
 * in the credit system.
 */

// Minimal Deno type declaration for environment access
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

export interface AlertPayload {
  level: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  metadata?: Record<string, any>;
  user_id?: string;
  timestamp?: string;
}

export interface FraudAlert extends Omit<AlertPayload, 'level'> {
  fraud_score: number;
  fraud_reasons: string[];
  amount: number;
  transaction_type: string;
}

// Rate limiting for alert spam prevention
const alertCache = new Map<string, number>();

/**
 * Send alert to monitoring system
 * In production, integrate with Sentry, Slack, PagerDuty, etc.
 */
export async function sendAlert(payload: AlertPayload): Promise<void> {
  const alertKey = `${payload.level}:${payload.title}`;
  const now = Date.now();
  const lastSent = alertCache.get(alertKey);
  
  // Configurable cooldown period (default 1 minute)
  const ALERT_COOLDOWN = parseInt(
    Deno.env.get('ALERT_COOLDOWN_MS') || '60000',
    10
  );
  
  // Skip if same alert was sent recently (except critical alerts which bypass rate limiting)
  if (lastSent && (now - lastSent) < ALERT_COOLDOWN && payload.level !== 'critical') {
    console.log(`[RATE LIMITED] Skipping duplicate alert: ${alertKey}`);
    return;
  }
  
  alertCache.set(alertKey, now);
  
  // Clean up old entries from cache (keep cache from growing indefinitely)
  for (const [key, timestamp] of alertCache.entries()) {
    if (now - timestamp > ALERT_COOLDOWN * 10) { // Clean entries older than 10x cooldown
      alertCache.delete(key);
    }
  }
  
  const timestamp = payload.timestamp || new Date().toISOString();
  
  // Console logging for all environments
  const logLevel = payload.level === 'critical' ? 'error' : 
                   payload.level === 'error' ? 'error' : 
                   payload.level === 'warning' ? 'warn' : 'log';
  
  console[logLevel](`[${payload.level.toUpperCase()}] ${payload.title}`, {
    message: payload.message,
    timestamp,
    metadata: payload.metadata,
  });
  
  // In production, send to external monitoring services
  const environment = Deno.env.get('ENVIRONMENT') || 'development';
  
  if (environment === 'production') {
    // Example: Send to Slack webhook
    const slackWebhook = Deno.env.get('SLACK_WEBHOOK_URL');
    if (slackWebhook) {
      try {
        await fetch(slackWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 ${payload.title}`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*${payload.title}*\n${payload.message}`,
                },
              },
              {
                type: 'context',
                elements: [
                  {
                    type: 'mrkdwn',
                    text: `Level: ${payload.level} | Time: ${timestamp}`,
                  },
                ],
              },
            ],
          }),
        });
      } catch (error) {
        console.error('Failed to send Slack alert:', error);
      }
    }
    
    // Example: Send to Sentry
    // In production, you would initialize Sentry properly
    // Sentry.captureMessage(payload.title, {
    //   level: payload.level,
    //   extra: payload.metadata,
    // });
  }
}

/**
 * Send fraud detection alert
 */
export async function sendFraudAlert(alert: FraudAlert): Promise<void> {
  await sendAlert({
    level: alert.fraud_score >= 75 ? 'critical' : 'warning',
    title: `Fraud Detection: ${alert.title}`,
    message: alert.message,
    metadata: {
      fraud_score: alert.fraud_score,
      fraud_reasons: alert.fraud_reasons,
      amount: alert.amount,
      transaction_type: alert.transaction_type,
      user_id: alert.user_id,
    },
    user_id: alert.user_id,
  });
}

/**
 * Log high-value transaction
 */
export async function logHighValueTransaction(
  type: 'purchase' | 'withdrawal',
  userId: string,
  amount: number,
  amountMWK: number
): Promise<void> {
  const LARGE_AMOUNT_THRESHOLD = parseInt(
    Deno.env.get('LARGE_TRANSACTION_THRESHOLD') || '10000',
    10
  );
  
  if (amount >= LARGE_AMOUNT_THRESHOLD) {
    await sendAlert({
      level: 'info',
      title: `Large ${type}`,
      message: `User ${userId} initiated ${type} of ${amount} credits (MWK ${amountMWK.toLocaleString()})`,
      metadata: {
        type,
        user_id: userId,
        credits: amount,
        mwk: amountMWK,
        threshold: LARGE_AMOUNT_THRESHOLD,
      },
      user_id: userId,
    });
  }
}

/**
 * Log rate limit hit
 */
export async function logRateLimitHit(
  userId: string,
  operation: string,
  limit: number,
  current: number
): Promise<void> {
  await sendAlert({
    level: 'warning',
    title: 'Rate Limit Hit',
    message: `User ${userId} hit rate limit for ${operation} (${current}/${limit})`,
    metadata: {
      user_id: userId,
      operation,
      limit,
      current,
    },
    user_id: userId,
  });
}

/**
 * Log system error
 */
export async function logSystemError(
  operation: string,
  error: Error,
  metadata?: Record<string, any>
): Promise<void> {
  await sendAlert({
    level: 'error',
    title: `System Error: ${operation}`,
    message: error.message,
    metadata: {
      operation,
      error_name: error.name,
      error_stack: error.stack,
      ...metadata,
    },
  });
}

/**
 * Create structured log entry
 */
export function createLogEntry(
  level: 'debug' | 'info' | 'warn' | 'error',
  operation: string,
  message: string,
  metadata?: Record<string, any>
): void {
  const logFn = console[level] || console.log;
  logFn(`[${operation}] ${message}`, metadata || {});
}

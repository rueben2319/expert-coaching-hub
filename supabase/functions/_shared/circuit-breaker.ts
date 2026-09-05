/**
 * Circuit Breaker Pattern Implementation
 * 
 * Prevents cascading failures when external services are down by:
 * - Tracking failure counts
 * - Opening the circuit after threshold is reached
 * - Allowing limited requests in half-open state for recovery
 * - Automatic recovery after cooldown period
 */

const CircuitState = {
  CLOSED: 'closed',    // Normal operation
  OPEN: 'open',        // Circuit is open, rejecting requests
  HALF_OPEN: 'half-open' // Testing if service has recovered
};

class CircuitBreaker {
  constructor(
    private config: any,
    private serviceName: string
  ) {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;
    this.successCount = 0;
    this.lastStateChange = new Date();
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute(fn: () => Promise<any>): Promise<any> {
    const result = this.shouldAllowRequest();

    if (!result.allowed) {
      throw new Error(
        `Circuit breaker OPEN for ${this.serviceName}. Service unavailable. Next attempt at ${result.nextAttemptTime?.toISOString()}`
      );
    }

    try {
      // Set timeout for the request
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Request timeout after ${this.config.timeoutMs}ms`)), this.config.timeoutMs);
      });

      const result = await Promise.race([fn(), timeoutPromise]);
      
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Check if request should be allowed
   */
  shouldAllowRequest() {
    const now = new Date();

    // Check if monitoring period has passed (reset failure count)
    if (this.state === CircuitState.CLOSED) {
      const timeSinceLastChange = now.getTime() - this.lastStateChange.getTime();
      if (timeSinceLastChange > this.config.monitoringPeriodMs) {
        this.failureCount = 0;
        this.lastStateChange = now;
      }
    }

    // Handle OPEN state
    if (this.state === CircuitState.OPEN) {
      if (this.nextAttemptTime && now >= this.nextAttemptTime) {
        // Transition to HALF_OPEN
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        this.lastStateChange = now;
        console.log(`Circuit breaker for ${this.serviceName} transitioned to HALF_OPEN`);
      } else {
        return {
          allowed: false,
          state: this.state,
          failureCount: this.failureCount,
          lastFailureTime: this.lastFailureTime,
          nextAttemptTime: this.nextAttemptTime
        };
      }
    }

    // Handle HALF_OPEN state
    if (this.state === CircuitState.HALF_OPEN) {
      // Allow limited requests for testing
      return {
        allowed: true,
        state: this.state,
        failureCount: this.failureCount,
        lastFailureTime: this.lastFailureTime
      };
    }

    // CLOSED state - allow all requests
    return {
      allowed: true,
      state: this.state,
      failureCount: this.failureCount
    };
  }

  /**
   * Handle successful request
   */
  onSuccess() {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      // If enough successes in HALF_OPEN, close the circuit
      if (this.successCount >= 3) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastStateChange = new Date();
        this.nextAttemptTime = undefined;
        console.log(`Circuit breaker for ${this.serviceName} transitioned to CLOSED (recovered)`);
      }
    } else {
      // Reset failure count on success in CLOSED state
      this.failureCount = 0;
    }
  }

  /**
   * Handle failed request
   */
  onFailure() {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      // Fail in HALF_OPEN, go back to OPEN
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = new Date(Date.now() + this.config.resetTimeoutMs);
      this.lastStateChange = new Date();
      console.error(`Circuit breaker for ${this.serviceName} transitioned to OPEN (half-open test failed)`);
    } else if (this.failureCount >= this.config.failureThreshold) {
      // Threshold reached, open the circuit
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = new Date(Date.now() + this.config.resetTimeoutMs);
      this.lastStateChange = new Date();
      console.error(`Circuit breaker for ${this.serviceName} transitioned to OPEN (threshold: ${this.config.failureThreshold})`);
    }
  }

  /**
   * Get current circuit breaker state
   */
  getState() {
    return this.shouldAllowRequest();
  }

  /**
   * Manually reset the circuit breaker (for admin/monitoring)
   */
  reset() {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;
    this.lastStateChange = new Date();
    console.log(`Circuit breaker for ${this.serviceName} manually reset to CLOSED`);
  }
}

// Circuit breaker registry
const circuitBreakers = new Map<string, CircuitBreaker>();

/**
 * Get or create a circuit breaker for a service
 */
export function getCircuitBreaker(
  serviceName: string,
  config?: any
): CircuitBreaker {
  if (!circuitBreakers.has(serviceName)) {
    const defaultConfig = {
      failureThreshold: 5,
      timeoutMs: 10000,
      resetTimeoutMs: 60000,
      monitoringPeriodMs: 60000,
      ...config
    };

    circuitBreakers.set(serviceName, new CircuitBreaker(defaultConfig, serviceName));
  }

  return circuitBreakers.get(serviceName)!;
}

/**
 * Pre-configured circuit breakers for common services
 */
export const circuitBreakers = {
  onekhusa: getCircuitBreaker('onekhusa', {
    failureThreshold: 3,
    timeoutMs: 15000,
    resetTimeoutMs: 120000, // 2 minutes
  }),

  paychangu: getCircuitBreaker('paychangu', {
    failureThreshold: 3,
    timeoutMs: 15000,
    resetTimeoutMs: 120000, // 2 minutes
  }),

  googleCalendar: getCircuitBreaker('google-calendar', {
    failureThreshold: 5,
    timeoutMs: 10000,
    resetTimeoutMs: 300000, // 5 minutes
  }),

  openai: getCircuitBreaker('openai', {
    failureThreshold: 10,
    timeoutMs: 30000,
    resetTimeoutMs: 600000, // 10 minutes
  }),

  googleGenAI: getCircuitBreaker('google-genai', {
    failureThreshold: 10,
    timeoutMs: 30000,
    resetTimeoutMs: 600000, // 10 minutes
  }),
};

/**
 * Health check for all circuit breakers
 */
export function getCircuitBreakerHealth() {
  const health: Record<string, any> = {};
  
  for (const [name, breaker] of circuitBreakers.entries()) {
    health[name] = breaker.getState();
  }

  return health;
}

/**
 * Reset all circuit breakers (for admin/recovery)
 */
export function resetAllCircuitBreakers() {
  for (const breaker of circuitBreakers.values()) {
    breaker.reset();
  }
}

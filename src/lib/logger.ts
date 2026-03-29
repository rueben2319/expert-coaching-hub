// Production-safe logging utility
import { redactSensitiveData } from "@/lib/redactSensitiveData";

const isDevelopment = import.meta.env.DEV;

const sanitizeArgs = (args: any[]) => args.map((arg) => redactSensitiveData(arg));

export const logger = {
  log: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.log(redactSensitiveData(message), ...sanitizeArgs(args));
    }
  },

  error: (message: string, ...args: any[]) => {
    console.error(redactSensitiveData(message), ...sanitizeArgs(args));
  },

  warn: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.warn(redactSensitiveData(message), ...sanitizeArgs(args));
    }
  },

  info: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.info(redactSensitiveData(message), ...sanitizeArgs(args));
    }
  }
};

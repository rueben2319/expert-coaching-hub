declare global {
  namespace Deno {
    namespace env {
      function get(key: string): string | undefined;
    }
  }
}

export {};

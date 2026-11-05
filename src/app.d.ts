import type { User } from './lib/server/db';
declare global {
  const __APP_VERSION__: string;
  namespace App {
    interface Locals {
      user: User | null;
      apiScopes: import('./lib/access').ApiScope[] | null;
    }
  }
}
export {};

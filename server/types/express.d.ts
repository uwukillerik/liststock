import type { UserRole } from "@shared/api";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        role: UserRole;
      };
    }
  }
}

export {};

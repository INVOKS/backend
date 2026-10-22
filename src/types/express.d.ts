export interface RequestUser {
  id: number;
  role: "user" | "admin";
}

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}

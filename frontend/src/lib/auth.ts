export type UserRole = "admin" | "user";

export type AuthUser = {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
};

import { Role, UserStatus } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      role: Role;
      status: UserStatus;
      name?: string | null;
      email?: string | null;
    };
  }

  interface User {
    id: string;
    username: string;
    role: Role;
    status: UserStatus;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    role: Role;
    status: UserStatus;
  }
}

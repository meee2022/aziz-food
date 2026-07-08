import { createContext, useContext, useState, ReactNode } from "react";

export type Role = "admin" | "sales" | "accountant" | "warehouse";
export interface User {
  id: string;
  name: string;
  role: Role;
}

interface AuthCtx {
  user: User | null;
  login: (u: User) => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({ user: null, login: () => {}, logout: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("user");
    return raw ? (JSON.parse(raw) as User) : null;
  });
  const login = (u: User) => {
    setUser(u);
    localStorage.setItem("user", JSON.stringify(u));
  };
  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };
  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

/** صلاحيات كل دور: أي أقسام يمكنه الوصول إليها. */
export const ROLE_ACCESS: Record<Role, string[]> = {
  admin: ["dashboard", "invoices", "invoice-new", "customers", "items", "prices", "priceLists", "purchases", "reports", "settings"],
  sales: ["dashboard", "invoices", "invoice-new", "customers", "items"],
  accountant: ["dashboard", "invoices", "customers", "reports", "payments"],
  warehouse: ["items", "prices", "purchases"],
};

export function can(role: Role | undefined, section: string): boolean {
  if (!role) return false;
  return ROLE_ACCESS[role].includes(section);
}

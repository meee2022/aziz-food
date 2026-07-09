import { createContext, useContext, useState, ReactNode } from "react";

export type Role = "admin" | "sales" | "accountant" | "warehouse" | "customer";
export interface User {
  id: string;
  name: string;
  role: Role;
  customerId?: string | null;
}

interface AuthCtx {
  user: User | null;
  token: string | null;
  login: (u: User, token: string) => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({ user: null, token: null, login: () => {}, logout: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("user");
    const tok = localStorage.getItem("token");
    // اعتبره مسجّلًا فقط إذا وُجد token أيضًا (جلسات قديمة بدون token = إعادة دخول)
    return raw && tok ? (JSON.parse(raw) as User) : null;
  });
  const login = (u: User, tok: string) => {
    setUser(u);
    setToken(tok);
    localStorage.setItem("user", JSON.stringify(u));
    localStorage.setItem("token", tok);
  };
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };
  return <Ctx.Provider value={{ user, token, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

/** صلاحيات كل دور: أي أقسام يمكنه الوصول إليها. */
export const ROLE_ACCESS: Record<Role, string[]> = {
  admin: ["dashboard", "invoices", "invoice-new", "orders", "customers", "items", "prices", "priceLists", "purchases", "expenses", "reports", "settings"],
  sales: ["dashboard", "invoices", "invoice-new", "orders", "customers", "items"],
  accountant: ["dashboard", "invoices", "orders", "customers", "expenses", "reports", "payments"],
  warehouse: ["items", "prices", "purchases"],
  customer: [],
};

export function can(role: Role | undefined, section: string): boolean {
  if (!role) return false;
  return ROLE_ACCESS[role].includes(section);
}

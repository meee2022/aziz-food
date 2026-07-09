import { useQuery, useMutation } from "convex/react";
import { useAuth } from "./auth";

/**
 * خطافات تحقن token الجلسة تلقائيًا في كل استدعاء لقاعدة البيانات.
 * تُستورَد في صفحات التطبيق بديلًا عن useQuery/useMutation من convex/react،
 * فتمرّ كل الاستدعاءات مصادَقة بدون تعديل كل موضع يدويًا.
 */

export function useAuthedQuery(ref: any, args?: any): any {
  const { token } = useAuth();
  const finalArgs = args === "skip" ? "skip" : { ...(args ?? {}), token: token ?? "" };
  return useQuery(ref, finalArgs as any);
}

export function useAuthedMutation(ref: any): (args?: any) => Promise<any> {
  const { token } = useAuth();
  const run = useMutation(ref);
  return (args?: any) => run({ ...(args ?? {}), token: token ?? "" } as any);
}

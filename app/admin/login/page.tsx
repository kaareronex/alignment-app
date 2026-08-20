import { createAdminClient } from "@/lib/supabase/server";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return <LoginForm hasPasswordSet={Boolean(data)} />;
}

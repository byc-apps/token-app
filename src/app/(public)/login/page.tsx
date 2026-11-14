import { LoginPage } from "@/features/auth/components/login-page";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const params = await searchParams;
  return <LoginPage initialError={typeof params.error === "string" ? params.error : undefined} />;
}

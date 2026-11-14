import { HomePage } from "@/features/auth/components/home-page";
import { RoleGuard } from "@/components/layout/auth-guard";

export default function Page() {
  return (
    <RoleGuard roles={["student_faculty"]}>
      <HomePage />
    </RoleGuard>
  );
}

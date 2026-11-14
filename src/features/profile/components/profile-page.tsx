"use client";

import { useState } from "react";
import { emailPrefsSchema, mobileBodySchema } from "@shared/schemas";
import { ID_LABEL } from "@shared/ids";
import { useAuth } from "@/context/auth-context";
import Link from "next/link";
import { ApiError } from "@/lib/api-client";
import { routes } from "@/config/routes";
import {
  Button,
  ErrorState,
  FormField,
  Input,
  PageHeader,
  Skeleton,
  Switch,
} from "@/components/ui";
import { useDepartments, useUpdateEmailPrefs, useUpdateMobile } from "..";

export function ProfilePage() {
  const { user } = useAuth();
  const departments = useDepartments();
  const [mobile, setMobile] = useState(user?.mobile ?? "");
  const [mobileError, setMobileError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const mobileMutation = useUpdateMobile(user?.uid ?? "");
  const prefsMutation = useUpdateEmailPrefs(user?.uid ?? "");

  if (!user) return <Skeleton />;

  const id = user.userType === "student" ? user.regNo : user.empId;
  const department = departments.data?.departments.find((item) => item.id === user.departmentId);
  const mobileApiError = mobileMutation.error instanceof ApiError ? mobileMutation.error : null;
  const prefsApiError = prefsMutation.error instanceof ApiError ? prefsMutation.error : null;

  function saveMobile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMobileError(null);
    setSaved(false);
    const parsed = mobileBodySchema.safeParse({ mobile });
    if (!parsed.success) {
      setMobileError(parsed.error.issues[0]?.message ?? "Invalid mobile number.");
      return;
    }
    mobileMutation.mutate(parsed.data.mobile, { onSuccess: () => setSaved(true) });
  }

  function updatePreference(key: "reminders" | "feedbackRequests", value: boolean) {
    const parsed = emailPrefsSchema.safeParse({ [key]: value });
    if (parsed.success) prefsMutation.mutate(parsed.data);
  }

  return (
    <section className="stack">
      <PageHeader title="Profile" />
      {user.role === "student_faculty" && !user.profileComplete ? (
        <p className="box">
          Complete your profile before booking.{" "}
          <Link href={routes.completeProfile}>Complete profile</Link>
        </p>
      ) : null}
      <section className="stack">
        <h2 className="section-title">University details</h2>
        <div className="styleguide-grid">
          <div className="field">
            <span className="field__label">Name</span>
            <span>{user.name}</span>
          </div>
          <div className="field">
            <span className="field__label">Email</span>
            <span>{user.email}</span>
          </div>
          <div className="field">
            <span className="field__label">Account type</span>
            <span>{user.userType === "student" ? "Student" : user.userType === "faculty" ? "Faculty or staff" : "Not set"}</span>
          </div>
          <div className="field">
            <span className="field__label">{user.userType ? ID_LABEL[user.userType] : "University ID"}</span>
            <span className="token-number">{id ?? "Not set"}</span>
          </div>
          <div className="field">
            <span className="field__label">Department</span>
            <span>{department?.name ?? user.departmentId ?? "Not set"}</span>
          </div>
        </div>
        <p className="text-muted text-small">Contact the App Admin to change these details.</p>
        {departments.error ? (
          <ErrorState
            message={departments.error instanceof Error ? departments.error.message : "Could not load departments."}
            error={departments.error}
            onRetry={() => void departments.refetch()}
          />
        ) : null}
      </section>

      <hr className="divider" />

      <section className="stack">
        <h2 className="section-title">Mobile</h2>
        <form className="stack" onSubmit={saveMobile} noValidate>
          <FormField id="profile-mobile" label="Mobile" error={mobileError ?? mobileApiError?.message}>
            <Input
              id="profile-mobile"
              type="tel"
              value={mobile}
              autoComplete="tel"
              onChange={(event) => setMobile(event.target.value)}
              aria-invalid={Boolean(mobileError || mobileApiError)}
            />
          </FormField>
          {mobileMutation.error ? (
            <ErrorState
              message={mobileApiError?.message ?? (mobileMutation.error instanceof Error ? mobileMutation.error.message : "Could not save mobile number.")}
              error={mobileMutation.error}
              status={mobileApiError?.status}
              requestId={mobileApiError?.requestId}
            />
          ) : null}
          {saved ? <p className="text-muted">Saved.</p> : null}
          <Button type="submit" variant="secondary" disabled={mobileMutation.isPending}>
            {mobileMutation.isPending ? "Saving" : "Save"}
          </Button>
        </form>
      </section>

      <hr className="divider" />

      <section className="stack">
        <h2 className="section-title">Email preferences</h2>
        <Switch
          label="Reminder emails"
          checked={user.emailPrefs.reminders}
          disabled={prefsMutation.isPending}
          onCheckedChange={(checked) => updatePreference("reminders", checked)}
        />
        <Switch
          label="Feedback request emails"
          checked={user.emailPrefs.feedbackRequests}
          disabled={prefsMutation.isPending}
          onCheckedChange={(checked) => updatePreference("feedbackRequests", checked)}
        />
        {prefsMutation.error ? (
          <ErrorState
            message={prefsApiError?.message ?? (prefsMutation.error instanceof Error ? prefsMutation.error.message : "Could not save email preferences.")}
            error={prefsMutation.error}
            status={prefsApiError?.status}
            requestId={prefsApiError?.requestId}
          />
        ) : null}
      </section>
    </section>
  );
}

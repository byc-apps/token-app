"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ID_LABEL, checkId, type IdKind } from "@shared/ids";
import { profileBodySchema } from "@shared/schemas";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api-client";
import { landingPath } from "@/lib/landing";
import {
  Button,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  PageHeader,
  RadioGroup,
  Select,
  Skeleton,
} from "@/components/ui";
import { useCompleteProfile, useDepartments, useSettings } from "..";

export function CompleteProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const settings = useSettings();
  const departments = useDepartments();
  const [accountType, setAccountType] = useState<IdKind>(user?.userType ?? "student");
  const [id, setId] = useState(() => {
    if (user?.userType === "student") return user.regNo ?? "";
    if (user?.userType === "faculty") return user.empId ?? "";
    return "";
  });
  const [departmentId, setDepartmentId] = useState(user?.departmentId ?? "");
  const [mobile, setMobile] = useState(user?.mobile ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const mutation = useCompleteProfile(user?.uid ?? "");

  if (!user) return <Skeleton />;
  const currentUser = user;
  if (user.role !== "student_faculty") {
    return (
      <section className="stack">
        <PageHeader title="Complete profile" />
        <p className="box">Your account is managed by the App Admin. This step is not required.</p>
      </section>
    );
  }

  const idCheck = id && settings.data
    ? checkId(accountType, id, settings.data.idFormats)
    : null;
  const apiError = mutation.error instanceof ApiError ? mutation.error : null;
  const departmentItems = departments.data?.departments ?? [];

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});

    if (idCheck && !idCheck.ok) {
      setFieldErrors({ id: idCheck.message });
      return;
    }

    const submittedId = idCheck?.ok ? idCheck.id : id;
    const result = profileBodySchema.safeParse({
      userType: accountType,
      id: submittedId,
      departmentId,
      mobile,
    });
    if (!result.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const path = issue.path[0];
        if (typeof path === "string" && !nextErrors[path]) nextErrors[path] = issue.message;
      }
      setFieldErrors(nextErrors);
      return;
    }

    mutation.mutate(result.data, {
      onSuccess: () => router.replace(landingPath(currentUser)),
    });
  }

  function apiFieldError(path: string): string | undefined {
    return apiError?.details.find((detail) => detail.path === path)?.message;
  }

  return (
    <section className="stack">
      <PageHeader title="Complete profile" description="Enter your university ID and contact details." />
      {settings.isPending ? (
        <div className="stack">
          <Skeleton />
          <Skeleton />
        </div>
      ) : settings.error ? (
        <ErrorState
          message={settings.error instanceof Error ? settings.error.message : "Could not load settings."}
          error={settings.error}
          onRetry={() => void settings.refetch()}
        />
      ) : null}

      {departments.isPending ? <Skeleton /> : null}
      {departments.error ? (
        <ErrorState
          message={departments.error instanceof Error ? departments.error.message : "Could not load departments."}
          error={departments.error}
          onRetry={() => void departments.refetch()}
        />
      ) : null}
      {departments.data && departmentItems.length === 0 ? (
        <EmptyState message="No departments yet. Ask the App Admin." />
      ) : null}

      {mutation.error ? (
        <ErrorState
          message={apiError?.message ?? (mutation.error instanceof Error ? mutation.error.message : "Could not save profile.")}
          error={mutation.error}
          status={apiError?.status}
          requestId={apiError?.requestId}
        />
      ) : null}
      {apiError?.code === "ID_ALREADY_LINKED" ? (
        <p className="field__error" role="alert">ID_ALREADY_LINKED: {apiError.message}</p>
      ) : null}

      <form className="stack" onSubmit={submit} noValidate>
        <fieldset className="stack" style={{ padding: 0, border: 0 }}>
          <legend className="field__label">Account type</legend>
          <RadioGroup
            name="accountType"
            value={accountType}
            onValueChange={(value) => {
              if (value === "student" || value === "faculty") {
                if (value !== accountType) setId("");
                setAccountType(value);
              }
            }}
            options={[
              { value: "student", label: "Student" },
              { value: "faculty", label: "Faculty or staff" },
            ]}
          />
        </fieldset>
        <FormField
          id="id"
          label={ID_LABEL[accountType]}
          hint={settings.data ? `Use ${settings.data.idFormats[accountType].minLength === settings.data.idFormats[accountType].maxLength ? settings.data.idFormats[accountType].minLength : `${settings.data.idFormats[accountType].minLength}-${settings.data.idFormats[accountType].maxLength}`} ${settings.data.idFormats[accountType].charset === "digits" ? "digits" : "letters or digits"}.` : undefined}
          error={fieldErrors.id ?? apiFieldError("id")}
        >
          <Input
            id="id"
            value={id}
            autoComplete="off"
            onChange={(event) => setId(event.target.value)}
            aria-invalid={Boolean(fieldErrors.id || apiFieldError("id"))}
          />
          {idCheck?.ok ? <span className="field__hint">ID format is valid.</span> : null}
        </FormField>
        <FormField id="departmentId" label="Department" error={fieldErrors.departmentId ?? apiFieldError("departmentId")}>
          <Select
            id="departmentId"
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
            disabled={!departmentItems.length}
          >
            <option value="">Choose a department</option>
            {departmentItems.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </Select>
        </FormField>
        <FormField id="mobile" label="Mobile" error={fieldErrors.mobile ?? apiFieldError("mobile")}>
          <Input
            id="mobile"
            type="tel"
            value={mobile}
            autoComplete="tel"
            onChange={(event) => setMobile(event.target.value)}
            aria-invalid={Boolean(fieldErrors.mobile || apiFieldError("mobile"))}
          />
        </FormField>
        <Button
          type="submit"
          size="student"
          disabled={
            mutation.isPending ||
            settings.isPending ||
            departments.isPending ||
            !settings.data ||
            departmentItems.length === 0 ||
            (idCheck !== null && !idCheck.ok)
          }
        >
          {mutation.isPending ? "Saving" : "Save"}
        </Button>
      </form>
    </section>
  );
}

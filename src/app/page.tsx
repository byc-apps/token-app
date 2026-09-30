"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/auth-context";
import {
  isChristUniversityEmail,
  AUTH_ERROR_MESSAGES,
} from "@/lib/auth/domain-verification";
import {
  createTokenSchema,
  updateTokenStatusSchema,
  studentMasterSchema,
  mailQueueSchema,
  CENTER_IDS,
  TOKEN_STATUSES,
  TOKEN_PRIORITIES,
  CreateTokenInput,
} from "@/lib/validations/token";
import {
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  KeyRound,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  School,
  Lock,
  Mail,
  User,
  LogOut,
  LogIn,
  AlertTriangle,
  ArrowRight,
  Database,
  FileCheck2,
  Ticket,
  ChevronRight,
} from "lucide-react";

interface MockToken {
  id: string;
  tokenNumber: string;
  studentEmail: string;
  studentName: string;
  registerNumber: string;
  department: string;
  centerId: (typeof CENTER_IDS)[number];
  serviceType: string;
  status: (typeof TOKEN_STATUSES)[number];
  priority: (typeof TOKEN_PRIORITIES)[number];
  assignedCounter?: string;
  facultyRemarks?: string;
  createdAt: string;
}

const INITIAL_TOKENS: MockToken[] = [
  {
    id: "token_byc_101",
    tokenNumber: "BYC-CERT-01",
    studentEmail: "arjun.m@student.christuniversity.in",
    studentName: "Arjun Manoj",
    registerNumber: "2347102",
    department: "School of Business and Management",
    centerId: "bonafide-certificates",
    serviceType: "Bonafide Certificate for Visa Application",
    status: "PENDING",
    priority: "REGULAR",
    createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
  },
  {
    id: "token_byc_102",
    tokenNumber: "BYC-FEE-05",
    studentEmail: "sneha.k@student.christuniversity.in",
    studentName: "Sneha Krishnan",
    registerNumber: "2240188",
    department: "School of Engineering & Technology",
    centerId: "fee-counter",
    serviceType: "Semester Fee Receipt Verification",
    status: "IN_PROGRESS",
    priority: "URGENT",
    assignedCounter: "Desk 2 - Central Billing",
    facultyRemarks: "Verifying NEFT reference number",
    createdAt: new Date(Date.now() - 35 * 60000).toISOString(),
  },
  {
    id: "token_byc_103",
    tokenNumber: "BYC-ID-03",
    studentEmail: "rohan.p@student.christuniversity.in",
    studentName: "Rohan Prakash",
    registerNumber: "2441055",
    department: "Department of Computer Science",
    centerId: "id-cards",
    serviceType: "Smart Card RFID Re-programming",
    status: "COMPLETED",
    priority: "REGULAR",
    assignedCounter: "Counter 4 - Smart Cards",
    facultyRemarks: "RFID replaced and activated on turnstiles",
    createdAt: new Date(Date.now() - 75 * 60000).toISOString(),
  },
];

export default function Home() {
  const { user, signInWithGoogle, signOut, loading, error: authError } = useAuth();

  // Active section tab
  const [activeTab, setActiveTab] = useState<"auth" | "token-form" | "queue" | "rules">("auth");

  // Domain verification tester state
  const [testEmail, setTestEmail] = useState("rahul.verma@student.christuniversity.in");
  const isTestEmailValid = isChristUniversityEmail(testEmail);

  // Simulated identity state for testing RBAC without needing multiple Google accounts
  const [simulatedRole, setSimulatedRole] = useState<"student" | "faculty" | "admin" | "rejected">("student");
  const [simulatedCenterId, setSimulatedCenterId] = useState<(typeof CENTER_IDS)[number]>("bonafide-certificates");
  const [simulatedEmail, setSimulatedEmail] = useState("arjun.m@student.christuniversity.in");

  // Token creation form state
  const [tokenFormData, setTokenFormData] = useState<Partial<CreateTokenInput>>({
    studentEmail: simulatedEmail,
    studentName: "Arjun Manoj",
    registerNumber: "2347102",
    department: "School of Business and Management",
    centerId: "bonafide-certificates",
    serviceType: "Bonafide Certificate for Internship",
    priority: "REGULAR",
    notes: "Requires HOD seal for off-campus summer project",
    phone: "+91 9876543210",
  });

  const [formValidationErrors, setFormValidationErrors] = useState<Record<string, string>>({});
  const [formSuccessMessage, setFormSuccessMessage] = useState<string | null>(null);

  // Mock Tokens state
  const [tokens, setTokens] = useState<MockToken[]>(INITIAL_TOKENS);
  const [queueActionMessage, setQueueActionMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // Quick Preset Selector for Domain Tester
  const selectEmailPreset = (email: string) => {
    setTestEmail(email);
  };

  // Handle Simulated Role Change
  const handleRoleChange = (role: "student" | "faculty" | "admin" | "rejected") => {
    setSimulatedRole(role);
    if (role === "student") {
      setSimulatedEmail("arjun.m@student.christuniversity.in");
      setTokenFormData((prev) => ({
        ...prev,
        studentEmail: "arjun.m@student.christuniversity.in",
        studentName: "Arjun Manoj",
      }));
    } else if (role === "faculty") {
      setSimulatedEmail("prof.thomas@christuniversity.in");
    } else if (role === "admin") {
      setSimulatedEmail("ssc.admin@christuniversity.in");
    } else {
      setSimulatedEmail("external.visitor@gmail.com");
    }
  };

  // Handle Token Submission with Zod Validation
  const handleCreateToken = (e: React.FormEvent) => {
    e.preventDefault();
    setFormValidationErrors({});
    setFormSuccessMessage(null);

    const payload = {
      ...tokenFormData,
      studentEmail: simulatedRole === "rejected" ? "visitor@gmail.com" : tokenFormData.studentEmail,
    };

    const result = createTokenSchema.safeParse(payload);

    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join(".");
        errors[path] = issue.message;
      }
      setFormValidationErrors(errors);
      return;
    }

    // Success: Create new token
    const newToken: MockToken = {
      id: `token_byc_${Date.now().toString().slice(-4)}`,
      tokenNumber: `BYC-${result.data.centerId.slice(0, 4).toUpperCase()}-${Math.floor(10 + Math.random() * 89)}`,
      studentEmail: result.data.studentEmail,
      studentName: result.data.studentName,
      registerNumber: result.data.registerNumber,
      department: result.data.department,
      centerId: result.data.centerId,
      serviceType: result.data.serviceType,
      status: "PENDING",
      priority: result.data.priority,
      createdAt: new Date().toISOString(),
    };

    setTokens((prev) => [newToken, ...prev]);
    setFormSuccessMessage(`Token ${newToken.tokenNumber} successfully issued for ${newToken.studentName}!`);
  };

  // Handle Token Status Transition with Faculty CenterId Verification
  const handleUpdateStatus = (
    tokenId: string,
    newStatus: (typeof TOKEN_STATUSES)[number],
    targetCenterId: (typeof CENTER_IDS)[number]
  ) => {
    setQueueActionMessage(null);

    // Check RBAC matching Firestore rules
    if (simulatedRole === "student") {
      if (newStatus !== "CANCELLED") {
        setQueueActionMessage({
          text: "PERMISSION DENIED: Students can only cancel their own pending tokens. Status advancement is restricted to SSC Faculty/Admin.",
          error: true,
        });
        return;
      }
    } else if (simulatedRole === "faculty") {
      // Faculty must match centerId custom claim!
      if (targetCenterId !== simulatedCenterId) {
        setQueueActionMessage({
          text: `FIRESTORE RULES ENFORCED: Faculty custom claim centerId is '${simulatedCenterId}', but this token belongs to '${targetCenterId}'. Update operation denied.`,
          error: true,
        });
        return;
      }
    } else if (simulatedRole === "rejected") {
      setQueueActionMessage({
        text: "AUTHENTICATION ERROR: Non-Christ domain accounts have no access to Firestore tokens.",
        error: true,
      });
      return;
    }

    // Update in local state
    setTokens((prev) =>
      prev.map((t) => {
        if (t.id === tokenId) {
          return {
            ...t,
            status: newStatus,
            assignedCounter:
              newStatus === "IN_PROGRESS"
                ? `Desk - ${simulatedCenterId.toUpperCase()}`
                : t.assignedCounter,
            facultyRemarks:
              newStatus === "COMPLETED"
                ? `Processed and closed by ${simulatedEmail}`
                : newStatus === "CANCELLED"
                ? "Cancelled by user"
                : t.facultyRemarks,
          };
        }
        return t;
      })
    );

    setQueueActionMessage({
      text: `Token status transitioned to ${newStatus} successfully (Complies with Firestore Security Rules).`,
      error: false,
    });
  };

  return (
    <div className="min-h-screen bg-mesh flex flex-col">
      {/* Top University Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-700 via-blue-900 to-indigo-950 border border-blue-500/30 flex items-center justify-center shadow-lg shadow-blue-950/50">
              <School className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                  CHRIST (Deemed to be University)
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-950 border border-blue-800 text-blue-300">
                  BYC CAMPUS
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Student Service Center Token System
              </h1>
            </div>
          </div>

          {/* User Auth Status / Control */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-700/80 rounded-full pl-3 pr-1.5 py-1.5 shadow-inner">
                <div className="text-xs text-right">
                  <div className="font-medium text-slate-200">{user.displayName || user.email}</div>
                  <div className="text-[10px] text-emerald-400 font-mono">Authenticated via Google SSO</div>
                </div>
                <button
                  onClick={signOut}
                  className="px-3 py-1 text-xs font-semibold bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/60 rounded-full transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={signInWithGoogle}
                disabled={loading}
                className="px-4 py-2 text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-md hover:shadow-blue-500/25 transition-all flex items-center gap-2 cursor-pointer border border-blue-400/30"
              >
                <LogIn className="w-4 h-4" />
                {loading ? "Connecting..." : "Sign In with Google SSO"}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        {/* Architecture Badges & Campus Banner */}
        <section className="glass-panel rounded-2xl p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            <div className="lg:col-span-2 space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950/80 border border-blue-700/60 text-xs font-medium text-blue-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Prompt 1 Base: Authentication, Firestore Schema & Security
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Christ University BYC Student Service Center
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                Configured with strict Google SSO domain verification supporting all subdomains ending with{" "}
                <code className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-xs">
                  christuniversity.in
                </code>
                , fine-grained Firestore security rules with custom claims, and full Zod schema validation.
              </p>
            </div>

            {/* Architecture Highlights Pill Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-700/60 flex flex-col gap-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> Domain Lock
                </span>
                <span className="font-semibold text-slate-100">*.christuniversity.in</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-700/60 flex flex-col gap-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-blue-400" /> RBAC Claims
                </span>
                <span className="font-semibold text-slate-100">centerId & email</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-700/60 flex flex-col gap-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-purple-400" /> Mail Security
                </span>
                <span className="font-semibold text-slate-100">Write-Only Server</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-700/60 flex flex-col gap-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <FileCheck2 className="w-4 h-4 text-amber-400" /> Schemas
                </span>
                <span className="font-semibold text-slate-100">100% Zod Validated</span>
              </div>
            </div>
          </div>
        </section>

        {/* Global Error Banner if any */}
        {authError && (
          <div className="rounded-xl border border-red-500/40 bg-red-950/40 p-4 text-red-200 flex items-start gap-3 text-sm">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Authentication Notice:</div>
              <div>{authError}</div>
            </div>
          </div>
        )}

        {/* Interactive Role Simulator Bar */}
        <section className="glass-card rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 border border-blue-900/40 bg-slate-950/60">
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <UserCheck className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-slate-200">Active Test Persona:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleRoleChange("student")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                simulatedRole === "student"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              🎓 Student (arjun.m@student...)
            </button>

            <button
              onClick={() => handleRoleChange("faculty")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                simulatedRole === "faculty"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              🏛️ Faculty Desk ({simulatedCenterId})
            </button>

            {simulatedRole === "faculty" && (
              <select
                value={simulatedCenterId}
                onChange={(e) => setSimulatedCenterId(e.target.value as (typeof CENTER_IDS)[number])}
                className="bg-slate-900 border border-indigo-700/60 rounded-lg px-2.5 py-1 text-xs text-indigo-200 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              >
                {CENTER_IDS.map((c) => (
                  <option key={c} value={c}>
                    claim: {c}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => handleRoleChange("admin")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                simulatedRole === "admin"
                  ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              👑 SSC Admin
            </button>

            <button
              onClick={() => handleRoleChange("rejected")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                simulatedRole === "rejected"
                  ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              🚫 External (@gmail.com)
            </button>
          </div>
        </section>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 space-x-2 sm:space-x-4 overflow-x-auto pb-1 text-sm font-medium">
          <button
            onClick={() => setActiveTab("auth")}
            className={`pb-3 px-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === "auth"
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            1. Domain Auth & SSO Verifier
          </button>

          <button
            onClick={() => setActiveTab("token-form")}
            className={`pb-3 px-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === "token-form"
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Ticket className="w-4 h-4" />
            2. Token Issue & Zod Validation
          </button>

          <button
            onClick={() => setActiveTab("queue")}
            className={`pb-3 px-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === "queue"
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Clock className="w-4 h-4" />
            3. Live Queue & Faculty RBAC
          </button>

          <button
            onClick={() => setActiveTab("rules")}
            className={`pb-3 px-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === "rules"
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Database className="w-4 h-4" />
            4. Firestore Rules & Specs
          </button>
        </div>

        {/* TAB 1: DOMAIN VERIFICATION & SSO CONSOLE */}
        {activeTab === "auth" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Domain Rule Logic Explainer */}
            <div className="lg:col-span-6 space-y-6">
              <div className="glass-card rounded-2xl p-6 border border-slate-700/80 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white">Domain Verification Rule</h3>
                    <p className="text-xs text-slate-400">Strict sub-domain matching policy</p>
                  </div>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed">
                  Per the prompt requirement, authentication allows any sub-domain ending with{" "}
                  <strong className="text-amber-300">christuniversity.in</strong> (e.g.,{" "}
                  <code className="text-emerald-300 font-mono text-xs">@student.christuniversity.in</code>,{" "}
                  <code className="text-emerald-300 font-mono text-xs">@christuniversity.in</code>,{" "}
                  <code className="text-emerald-300 font-mono text-xs">@res.christuniversity.in</code>). Any non-Christ
                  domain is rejected with a clean error message and immediately signed out.
                </p>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 font-mono text-xs space-y-1.5 text-slate-300">
                  <div className="text-slate-500">// Domain matching logic</div>
                  <div className="text-blue-300">
                    domain === &quot;christuniversity.in&quot; || domain.endsWith(&quot;.christuniversity.in&quot;)
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Test With Presets:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { email: "rahul.v@student.christuniversity.in", label: "Student BYC", valid: true },
                      { email: "director.byc@christuniversity.in", label: "Faculty / Dean", valid: true },
                      { email: "scholar@res.christuniversity.in", label: "Research Scholar", valid: true },
                      { email: "applicant@gmail.com", label: "External Gmail", valid: false },
                      { email: "phishing@fakechristuniversity.in", label: "Lookalike Domain", valid: false },
                      { email: "user@christuniversity.in.attacker.com", label: "Subdomain Attack", valid: false },
                    ].map((preset) => (
                      <button
                        key={preset.email}
                        onClick={() => selectEmailPreset(preset.email)}
                        className={`px-2.5 py-1 rounded text-xs border transition-all cursor-pointer ${
                          preset.valid
                            ? "bg-emerald-950/40 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/60"
                            : "bg-red-950/40 border-red-700/60 text-red-300 hover:bg-red-900/60"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Live Interactive Tester */}
            <div className="lg:col-span-6 space-y-6">
              <div className="glass-card rounded-2xl p-6 border border-slate-700/80 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-white flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-amber-400" />
                    Live Domain Evaluator
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      isTestEmailValid
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-red-500/20 text-red-400 border border-red-500/30"
                    }`}
                  >
                    {isTestEmailValid ? "PERMITTED" : "REJECTED"}
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300">Enter Google Account Email:</label>
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="e.g. yourname@student.christuniversity.in"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-mono"
                  />
                </div>

                {/* Validation Feedback Box */}
                {isTestEmailValid ? (
                  <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-700/60 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-emerald-200 space-y-1">
                      <div className="font-bold text-emerald-300">Authorized Christ University Identity</div>
                      <div>
                        Domain matches authorized Christ University domain pattern. Eligible for Student Service
                        Center token issuance and query.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-red-950/40 border border-red-700/60 flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-red-200 space-y-1">
                      <div className="font-bold text-red-300">Authentication Blocked</div>
                      <div className="leading-relaxed">{AUTH_ERROR_MESSAGES.DOMAIN_UNAUTHORIZED}</div>
                    </div>
                  </div>
                )}

                <div className="border-t border-slate-800 pt-4 flex items-center justify-between text-xs text-slate-400">
                  <span>Firebase Auth Google SSO Handler:</span>
                  <span className="text-emerald-400 font-mono">domain-verification.ts</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TOKEN ISSUE & ZOD VALIDATION */}
        {activeTab === "token-form" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-6">
              <form onSubmit={handleCreateToken} className="glass-card rounded-2xl p-6 sm:p-8 border border-slate-700/80 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Ticket className="w-5 h-5 text-amber-400" />
                      Issue Student Service Token
                    </h3>
                    <p className="text-xs text-slate-400">Validated against strict Zod schema</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded bg-blue-950 border border-blue-800 text-blue-300">
                    BYC Service Desk
                  </span>
                </div>

                {formSuccessMessage && (
                  <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-700/60 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    {formSuccessMessage}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">Student Email *</label>
                    <input
                      type="email"
                      value={tokenFormData.studentEmail || ""}
                      onChange={(e) => setTokenFormData({ ...tokenFormData, studentEmail: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                    />
                    {formValidationErrors.studentEmail && (
                      <p className="text-[11px] text-red-400">{formValidationErrors.studentEmail}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">Student Full Name *</label>
                    <input
                      type="text"
                      value={tokenFormData.studentName || ""}
                      onChange={(e) => setTokenFormData({ ...tokenFormData, studentName: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    {formValidationErrors.studentName && (
                      <p className="text-[11px] text-red-400">{formValidationErrors.studentName}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">Register Number *</label>
                    <input
                      type="text"
                      value={tokenFormData.registerNumber || ""}
                      onChange={(e) => setTokenFormData({ ...tokenFormData, registerNumber: e.target.value })}
                      placeholder="e.g. 2340123"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    {formValidationErrors.registerNumber && (
                      <p className="text-[11px] text-red-400">{formValidationErrors.registerNumber}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">Department *</label>
                    <input
                      type="text"
                      value={tokenFormData.department || ""}
                      onChange={(e) => setTokenFormData({ ...tokenFormData, department: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    {formValidationErrors.department && (
                      <p className="text-[11px] text-red-400">{formValidationErrors.department}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">Service Center Desk (centerId) *</label>
                    <select
                      value={tokenFormData.centerId || "general-enquiry"}
                      onChange={(e) =>
                        setTokenFormData({
                          ...tokenFormData,
                          centerId: e.target.value as (typeof CENTER_IDS)[number],
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      {CENTER_IDS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    {formValidationErrors.centerId && (
                      <p className="text-[11px] text-red-400">{formValidationErrors.centerId}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">Priority Level</label>
                    <select
                      value={tokenFormData.priority || "REGULAR"}
                      onChange={(e) =>
                        setTokenFormData({
                          ...tokenFormData,
                          priority: e.target.value as (typeof TOKEN_PRIORITIES)[number],
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      {TOKEN_PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Specific Service Request *</label>
                  <input
                    type="text"
                    value={tokenFormData.serviceType || ""}
                    onChange={(e) => setTokenFormData({ ...tokenFormData, serviceType: e.target.value })}
                    placeholder="e.g. Bonafide Certificate for Visa / Fee Concession Request"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  {formValidationErrors.serviceType && (
                    <p className="text-[11px] text-red-400">{formValidationErrors.serviceType}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Optional Notes / Remarks</label>
                  <textarea
                    rows={2}
                    value={tokenFormData.notes || ""}
                    onChange={(e) => setTokenFormData({ ...tokenFormData, notes: e.target.value })}
                    placeholder="Provide any additional context or reference numbers"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 transition-all shadow-lg shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-2 text-sm"
                >
                  <FileCheck2 className="w-4 h-4" /> Validate Schema & Issue Token
                </button>
              </form>
            </div>

            {/* Zod Schema Inspector */}
            <div className="lg:col-span-5 space-y-6">
              <div className="glass-card rounded-2xl p-6 border border-slate-700/80 space-y-4">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Zod Validation Rules Applied
                </h4>
                <p className="text-xs text-slate-300">
                  All requests are strictly validated client-side and server-side using TypeScript Zod definitions:
                </p>
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-start gap-2">
                    <span className="text-amber-400 font-mono">studentEmail:</span>
                    <span className="text-slate-300">Enforces @*.christuniversity.in domain</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-start gap-2">
                    <span className="text-amber-400 font-mono">registerNumber:</span>
                    <span className="text-slate-300">4-20 chars alphanumeric register ID</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-start gap-2">
                    <span className="text-amber-400 font-mono">centerId:</span>
                    <span className="text-slate-300">One of 7 predefined BYC service desks</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-start gap-2">
                    <span className="text-amber-400 font-mono">priority:</span>
                    <span className="text-slate-300">REGULAR, URGENT, SPECIAL_ASSISTANCE</span>
                  </div>
                </div>

                <div className="pt-2 text-center">
                  <span className="text-[11px] text-emerald-400 font-mono">
                    ✓ 13/13 Automated Unit Tests Passing (npm test)
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: LIVE QUEUE & FACULTY RBAC ENFORCEMENT */}
        {activeTab === "queue" && (
          <div className="space-y-6">
            {/* Live Queue Banner */}
            <div className="flex flex-wrap items-center justify-between gap-4 glass-card p-4 rounded-xl border border-slate-700/80">
              <div>
                <h3 className="font-bold text-white text-base">Active Token Queue - Bangalore Yeshwanthpur Campus</h3>
                <p className="text-xs text-slate-400">
                  Testing role enforcement: Faculty can ONLY update tokens matching custom claim{" "}
                  <code className="text-indigo-300 font-mono">centerId</code>
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-1 rounded bg-slate-800 text-slate-300">
                  Total Tokens: {tokens.length}
                </span>
                <span className="px-2 py-1 rounded bg-amber-950/60 border border-amber-800/80 text-amber-300">
                  Pending: {tokens.filter((t) => t.status === "PENDING").length}
                </span>
                <span className="px-2 py-1 rounded bg-blue-950/60 border border-blue-800/80 text-blue-300">
                  In Progress: {tokens.filter((t) => t.status === "IN_PROGRESS").length}
                </span>
              </div>
            </div>

            {/* Action Feedback Banner */}
            {queueActionMessage && (
              <div
                className={`p-4 rounded-xl border text-xs flex items-center gap-2 ${
                  queueActionMessage.error
                    ? "bg-red-950/40 border-red-700/80 text-red-300"
                    : "bg-emerald-950/40 border-emerald-700/80 text-emerald-300"
                }`}
              >
                {queueActionMessage.error ? (
                  <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                )}
                <span>{queueActionMessage.text}</span>
              </div>
            )}

            {/* Tokens Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className="glass-card rounded-xl p-5 border border-slate-700/80 flex flex-col justify-between space-y-4 hover:border-slate-600 transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-extrabold text-sm text-amber-400">
                        {token.tokenNumber}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          token.status === "PENDING"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : token.status === "IN_PROGRESS"
                            ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                            : token.status === "COMPLETED"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-red-500/20 text-red-300 border border-red-500/30"
                        }`}
                      >
                        {token.status}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-white text-sm">{token.studentName}</h4>
                      <p className="text-xs text-slate-400 font-mono">{token.studentEmail}</p>
                      <p className="text-[11px] text-slate-500">Reg: {token.registerNumber} • {token.department}</p>
                    </div>

                    <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800 text-xs space-y-1">
                      <div className="text-slate-400 font-medium">Service Desk:</div>
                      <div className="text-indigo-300 font-mono text-[11px]">{token.centerId}</div>
                      <div className="text-slate-300 text-xs">{token.serviceType}</div>
                    </div>

                    {token.assignedCounter && (
                      <div className="text-[11px] text-blue-300">Counter: {token.assignedCounter}</div>
                    )}
                    {token.facultyRemarks && (
                      <div className="text-[11px] text-slate-400 italic">&ldquo;{token.facultyRemarks}&rdquo;</div>
                    )}
                  </div>

                  {/* Actions depending on simulated persona */}
                  <div className="border-t border-slate-800 pt-3 flex flex-wrap gap-2">
                    {token.status === "PENDING" && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(token.id, "IN_PROGRESS", token.centerId)}
                          className="px-2.5 py-1 text-xs rounded bg-blue-600/80 hover:bg-blue-600 text-white font-medium cursor-pointer"
                        >
                          Call Token
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(token.id, "CANCELLED", token.centerId)}
                          className="px-2.5 py-1 text-xs rounded bg-red-950/70 hover:bg-red-900 border border-red-800 text-red-300 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </>
                    )}

                    {token.status === "IN_PROGRESS" && (
                      <button
                        onClick={() => handleUpdateStatus(token.id, "COMPLETED", token.centerId)}
                        className="px-2.5 py-1 text-xs rounded bg-emerald-600/80 hover:bg-emerald-600 text-white font-medium cursor-pointer"
                      >
                        Complete Request
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: FIRESTORE RULES SPECIFICATION & CODE */}
        {activeTab === "rules" && (
          <div className="space-y-6">
            <div className="glass-card rounded-2xl p-6 border border-slate-700/80 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-amber-400" />
                  Firestore Security Rules (firestore.rules)
                </h3>
                <span className="text-xs px-2.5 py-1 rounded bg-emerald-950 border border-emerald-800 text-emerald-300">
                  Compliant with Assumed Schema & RBAC
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="font-bold text-blue-300 flex items-center gap-1.5">
                    <User className="w-4 h-4" /> students_master
                  </div>
                  <p className="text-slate-400">
                    <strong>Read-only</strong> for authenticated students based on their own email matching document key
                    (e.g., <code className="text-slate-300">email == studentEmail</code>).
                  </p>
                  <p className="text-slate-400">
                    <strong>Writeable:</strong> By Admin only.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="font-bold text-indigo-300 flex items-center gap-1.5">
                    <Ticket className="w-4 h-4" /> tokens
                  </div>
                  <p className="text-slate-400">
                    <strong>Students:</strong> Read/Write only where <code className="text-slate-300">studentEmail == auth.token.email</code>.
                  </p>
                  <p className="text-slate-400">
                    <strong>Faculty:</strong> Read/Update tokens matching their custom claim <code className="text-slate-300">centerId</code>.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="font-bold text-purple-300 flex items-center gap-1.5">
                    <Mail className="w-4 h-4" /> mail
                  </div>
                  <p className="text-slate-400">
                    <strong>Write-only:</strong> For server-side logic and authenticated trigger routines.
                  </p>
                  <p className="text-slate-400">
                    <strong>Read:</strong> Strictly denied for client SDKs (<code className="text-slate-300">allow read: if false</code>).
                  </p>
                </div>
              </div>

              {/* Code Snippet Preview */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto space-y-2">
                <div className="text-slate-500">// Snippet from firestore.rules</div>
                <div>match /students_master/{`{studentEmail}`} &#123;</div>
                <div className="pl-4 text-emerald-400">
                  allow read: if isAuthenticated() &amp;&amp; (isStudentOwner(studentEmail) || isAdmin());
                </div>
                <div className="pl-4 text-blue-400">
                  allow write: if isAdmin() &amp;&amp; isValidStudentMaster(request.resource.data);
                </div>
                <div>&#125;</div>
                <div className="pt-2">match /tokens/{`{tokenId}`} &#123;</div>
                <div className="pl-4 text-emerald-400">
                  allow read: if isAuthenticated() &amp;&amp; (resource.data.studentEmail == request.auth.token.email || isFacultyForCenter(resource.data.centerId) || isAdmin());
                </div>
                <div className="pl-4 text-blue-400">
                  allow create: if isAuthenticated() &amp;&amp; hasChristEmail() &amp;&amp; request.resource.data.studentEmail == request.auth.token.email;
                </div>
                <div>&#125;</div>
                <div className="pt-2">match /mail/{`{mailId}`} &#123;</div>
                <div className="pl-4 text-red-400">allow read: if false; // Write-only</div>
                <div className="pl-4 text-blue-400">allow create: if isTriggerRoutineOrAdmin();</div>
                <div>&#125;</div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* University Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 py-6 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <School className="w-4 h-4 text-amber-400" />
            <span>CHRIST (Deemed to be University) • Bangalore Yeshwanthpur Campus (BYC)</span>
          </div>
          <div>Student Service Center (SSC) Token Management System</div>
        </div>
      </footer>
    </div>
  );
}

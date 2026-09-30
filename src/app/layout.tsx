import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Christ University BYC - Student Service Center Token System",
  description:
    "Official Token Management System for Student Service Center (SSC) at Christ University Bangalore Yeshwanthpur Campus (BYC). Features Google SSO, custom claims RBAC, and Firestore security rules.",
  keywords: [
    "Christ University",
    "BYC",
    "Bangalore Yeshwanthpur Campus",
    "Student Service Center",
    "Token System",
    "Firebase Auth",
    "Google SSO",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-900 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

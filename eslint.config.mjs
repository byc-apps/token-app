import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/app/api/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "api/lib",
                "api/lib/**",
                "api/services",
                "api/services/**",
                "api/middleware",
                "api/middleware/**",
                "api/routes",
                "api/routes/**",
                "api/app",
                "api/app/**",
                "**/api/lib/**",
                "**/api/services/**",
                "**/api/middleware/**",
                "**/api/routes/**",
                "**/api/shared/**",
                "**/api/app",
                "firebase-admin",
                "firebase-admin/**",
                "firebase/firestore",
              ],
              message: "Frontend code may import backend-shared code only through @shared/*.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

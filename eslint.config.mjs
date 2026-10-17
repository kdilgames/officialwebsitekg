import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * ESLint 9 flat configuration.
 *
 * `eslint-config-next` ships flat configs, so the Next.js and React rules are
 * composed directly instead of going through the legacy `extends` mechanism.
 */
const config = [
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "prisma/migrations/**"],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Server Actions must keep the full `(previous, formData)` signature even
      // when an action ignores one of the arguments.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
];

export default config;

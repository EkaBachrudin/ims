import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  // --- Aturan arah dependensi antar layer ---
  {
    files: ["src/modules/**/*.service.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@prisma/client",
              allowTypeImports: true,
              message: "Service: akses data lewat repository, bukan Prisma langsung.",
            },
            { name: "express", message: "Service: jangan bergantung pada HTTP." },
          ],
          patterns: [
            {
              group: ["**/infrastructure/prisma/**"],
              allowTypeImports: true,
              message: "Service: hanya boleh `import type { Db }` dari infra Prisma.",
            },
            {
              group: ["**/middlewares/**"],
              message: "Service: jangan import middleware HTTP.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/**/*.{routes,controller}.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@prisma/client",
              message: "Routes/controller: pindahkan query ke repository.",
            },
          ],
          patterns: [
            {
              group: ["**/infrastructure/prisma/**", "**/*.repository"],
              message: "Routes/controller: akses data via service.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/application/**/*.ts", "src/domain/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@prisma/client",
              allowTypeImports: true,
              message: "Domain/application: gunakan tipe domain.",
            },
            { name: "express", message: "Domain/application: jangan bergantung pada HTTP." },
          ],
          patterns: [
            {
              group: ["**/infrastructure/**", "**/middlewares/**"],
              allowTypeImports: true,
              message: "Domain/application: hanya boleh `import type` dari infra (untuk port).",
            },
          ],
        },
      ],
    },
  },
);

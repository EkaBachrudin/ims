import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: { ecmaVersion: 2022, sourceType: "module" },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  // --- Aturan arah dependensi antar layer ---
  {
    files: ["src/application/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "axios", message: "Application: akses data lewat port, bukan HTTP/axios." },
            { name: "pg", message: "Application: akses data lewat port, bukan pg." },
            { name: "telegraf", message: "Application: jangan bergantung pada Telegram." },
          ],
          patterns: [
            {
              group: ["**/infrastructure/**"],
              message: "Application: gunakan port, bukan implementasi infrastructure.",
            },
            {
              group: ["**/presentation/**"],
              message: "Application: jangan bergantung pada presentation.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/presentation/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "axios", message: "Presentation: gunakan application layer." },
            { name: "pg", message: "Presentation: gunakan application layer." },
          ],
          patterns: [
            {
              group: ["**/infrastructure/**"],
              message: "Presentation: gunakan application layer, bukan infrastructure.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/infrastructure/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/presentation/**"],
              message: "Infrastructure: jangan bergantung pada presentation.",
            },
          ],
        },
      ],
    },
  },
);

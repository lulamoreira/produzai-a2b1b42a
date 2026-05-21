import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import i18next from "eslint-plugin-i18next";

export default tseslint.config(
  { 
    ignores: [
      "dist",
      "src/i18n/locales/**",
      "src/lib/exportCampaignPPT.ts",
      "**/*.test.ts",
      "**/*.spec.ts",
      "vite.config.ts",
      "tailwind.config.ts"
    ] 
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      i18next,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "i18next/no-literal-string": [
        "warn",
        {
          mode: "jsx-only",
          "jsx-components": { include: ["*"] },
          "jsx-attributes": {
            include: ["placeholder", "title", "alt", "aria-label", "aria-placeholder", "aria-roledescription", "aria-valuetext", "label"]
          },
          ignore: [
            "^[^a-záàãâéêíóôõúüçA-ZÁÀÃÂÉÊÍÓÔÕÚÜÇ]*$",
            "^[0-9.,\\-+%/: ]+$",
            "^v[0-9]",
            "^#[0-9a-fA-F]+$",
            "^[A-Z_]+$"
          ],
          ignoreAttribute: ["className", "class", "style", "key", "id", "data-testid", "data-cy", "href", "src", "type", "name", "value", "role", "tabIndex", "htmlFor", "to", "path", "variant", "size", "side", "align", "asChild"]
        }
      ]
    },
  },
);
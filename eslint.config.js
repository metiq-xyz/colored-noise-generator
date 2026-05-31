import { FlatCompat } from "@eslint/eslintrc";
import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import globals from "globals";

const compat = new FlatCompat({
    baseDirectory: import.meta.dirname,
});

export default defineConfig(
    {
        ignores: ["dist/**"],
        languageOptions: {
            globals: globals.node,
        },
    },
    ...compat.config({
        extends: ["prettier"],
    }),
    eslintConfigPrettier,
    eslint.configs.recommended,
);

import config from "@pokermap/config/eslint";

export default [
  ...config,
  { ignores: ["e2e/**", "next-env.d.ts"] },
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ["*.{ts,tsx,js,mjs,cjs}"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];

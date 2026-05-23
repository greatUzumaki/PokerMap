import config from "@pokermap/config/eslint";

export default [
  ...config,
  { ignores: ["next-env.d.ts"] },
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ["*.{ts,tsx,js,mjs,cjs}"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];

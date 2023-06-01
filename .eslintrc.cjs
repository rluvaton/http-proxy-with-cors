module.exports = {
  extends: ["plugin:prettier/recommended"],
  root: true,
  env: {
    node: true
  },
  parserOptions: {
    sourceType: "module",
    ecmaVersion: "latest"
  },
  ignorePatterns: [".eslintrc.js"],
  rules: {
    "prettier/prettier": ["error", { printWidth: 120 }]
  }
};

module.exports = {
  root: true,
  parser: 'babel-eslint',
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
    node: true
  },
  extends: [
    'standard'
  ],
  parserOptions: {
    ecmaVersion: 12
  },
  rules: {
    'no-console': 'off',
    'no-debugger': 'warn'
  }
}

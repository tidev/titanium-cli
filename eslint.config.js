import js from "@eslint/js";
import globals from 'globals';

export default {
    ...js.configs.recommended,
    files: ["src/**/*.js", "test/**/*.test.js"],
    languageOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        globals: {
            ...globals.node
        }
    },
    rules: {
        'array-bracket-spacing': ['warn', 'never'],
        'brace-style': [2, '1tbs', { 'allowSingleLine': true }],
        'camelcase': 'off',
        'curly': ['error', 'all'],
        'eol-last': 'error',
        'indent': ['error', 'tab', { 'SwitchCase': 1 }],
        'keyword-spacing': ['error'],
        'linebreak-style': ['error', 'unix'],
        'max-len': ['error', 200],
        'no-case-declarations': 'off',
        'no-cond-assign': 'off',
        'no-console': 'off',
        'no-control-regex': 'off',
        'no-empty': 'off',
        'no-inner-declarations': 'off',
        'no-mixed-spaces-and-tabs': 'error',
        'no-multi-str': 'error',
        'no-multiple-empty-lines': 'error',
        'no-regex-spaces': 'off',
        'no-trailing-spaces': 'error',
        'no-unused-vars': 'off',
        'no-useless-escape': 'warn',
        'quotes': ['error', 'single'],
        'semi': ['error', 'always'],
        'space-before-blocks': ['error', 'always'],
        'space-before-function-paren': ['error', { 'anonymous': 'always', 'named': 'ignore', 'asyncArrow': 'always' }],
        'space-in-parens': ['error', 'never'],
        'space-infix-ops': 'error',
        'space-unary-ops': ['error', { 'nonwords': false, 'overrides': {} }]
    }
};

module.exports = {
	env: {
        es2021: true,
        node: true
    },
	extends: [
        'eslint:recommended'
    ],
    parserOptions: {
        "ecmaVersion": "latest",
        "sourceType": "module"
    },
	plugins: [
		'promise',
		'security'
	],
	root: true,
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
        'no-trailing-spaces': 'error',
        'no-unused-vars': 'off',
        'no-useless-escape': 'warn',
        'promise/always-return': 'error',
        'promise/no-return-wrap': 'error',
        'promise/param-names': 'error',
        'promise/catch-or-return': 'error',
        'promise/no-native': 'off',
        'promise/no-nesting': 'warn',
        'promise/no-promise-in-callback': 'warn',
        'promise/no-callback-in-promise': 'warn',
        'promise/avoid-new': 'off',
        'promise/no-new-statics': 'error',
        'promise/no-return-in-finally': 'warn',
        'promise/valid-params': 'warn',
        'quotes': ['error', 'single'],
        'semi': ['error', 'always'],
        'space-before-blocks': ['error', 'always'],
        'space-before-function-paren': ['error', { 'anonymous': 'always', 'named': 'ignore', 'asyncArrow': 'always' }],
        'space-in-parens': ['error', 'never'],
        'space-infix-ops': 'error',
        'space-unary-ops': ['error', { 'nonwords': false, 'overrides': {} }]
    }
};

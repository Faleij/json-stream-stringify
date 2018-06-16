module.exports = {
    extends: ['../.eslintrc.js'],
    plugins: [
        'mocha',
    ],
    env: {
        mocha: true,
    },
    rules: {
        'no-sparse-arrays': 'off',
        'import/first': 'off',
    },
};
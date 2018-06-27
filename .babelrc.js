module.exports = {
    presets: [
        ['@babel/preset-env', {
            forceAllTransforms: true,
            modules: 'cjs',
            debug: false,
            useBuiltIns: 'usage',
        }],
    ],
    exclude: 'node_modules/**',
    plugins: [
        ['@babel/plugin-transform-runtime', {
            helpers: false,
            polyfill: true,
            regenerator: false,
        }],
    ],
};

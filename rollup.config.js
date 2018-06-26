import babel from 'rollup-plugin-babel';

export default [
  // polyfilled output
  {
    input: './src/JsonStreamStringify.js',
    output: [{
      file: './dist/umd.polyfilled.js',
      format: 'umd',
      name: 'jsonStreamStringify',
      sourcemap: true,
      globals: {
        stream: 'stream',
      },
    },
    {
      file: './dist/module.polyfill.js',
      format: 'es',
      name: 'jsonStreamStringify',
      sourcemap: true,
      globals: {
        stream: 'stream',
      },
    },
    ],
    plugins: [
      babel({
        presets: [
          [('@babel/preset-env'), {
            forceAllTransforms: true,
            modules: false,
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
        runtimeHelpers: true,
      }),
    ],
    external(v) {
      return [
        'stream',
        'core-js/',
        '@babel/runtime',
      ].some(el => v === el || v.startsWith(el));
    },
  },
  // no polyfilled output
  {
    input: './src/JsonStreamStringify.js',
    output: [{
      file: './dist/umd.js',
      format: 'umd',
      name: 'jsonStreamStringify',
      sourcemap: true,
      globals: {
        stream: 'stream',
      },
    },
    {
      file: './dist/module.js',
      format: 'es',
      name: 'jsonStreamStringify',
      sourcemap: true,
      globals: {
        stream: 'stream',
      },
    },
    ],
    plugins: [
      babel({
        presets: [
          [('@babel/preset-env'), {
            forceAllTransforms: true,
            modules: false,
            debug: false,
            useBuiltIns: false,
          }],
        ],
        exclude: 'node_modules/**',
      }),
    ],
    external: ['stream'],
  },
];

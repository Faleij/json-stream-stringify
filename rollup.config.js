import babel from 'rollup-plugin-babel';
import typescript from 'rollup-plugin-typescript2';

const presets = [
  ['@babel/preset-env', {
    forceAllTransforms: true,
    debug: false,
    useBuiltIns: 'usage',
    targets: {
      chrome: 58,
      ie: 8,
      node: '0.12',
    },
    corejs: 3,
  }],
];

export default [
  {
    input: './src/JsonStreamStringify.ts',
    output: [{
      file: './lib/umd.polyfill.js',
      format: 'umd',
      name: 'jsonStreamStringify',
      sourcemap: true,
      globals: {
        stream: 'stream',
      },
    },
    {
      file: './lib/module.polyfill.js',
      format: 'es',
      name: 'jsonStreamStringify',
      sourcemap: true,
      globals: {
        stream: 'stream',
      },
    },
    ],
    plugins: [
      typescript(),
      babel({
        babelrc: false,
        extensions: ['.js', '.ts'],
        presets,
        exclude: 'node_modules/**',
        /*
        plugins: [
          ['@babel/plugin-transform-runtime', {
            helpers: true,
            regenerator: false,
            useESModules: true,
            corejs: 3,
          }],
        ],
        */
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
    input: './src/JsonStreamStringify.ts',
    output: [{
      file: './lib/umd.js',
      format: 'umd',
      name: 'jsonStreamStringify',
      sourcemap: true,
      globals: {
        stream: 'stream',
      },
    },
    {
      file: './lib/module.js',
      format: 'es',
      name: 'jsonStreamStringify',
      sourcemap: true,
      globals: {
        stream: 'stream',
      },
    },
    ],
    plugins: [
      typescript(),
      babel({
        babelrc: false,
        extensions: ['.js', '.ts'],
        presets: [['@babel/preset-env', {
          forceAllTransforms: true,
          debug: false,
          useBuiltIns: false,
        }]],
        exclude: 'node_modules/**',
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
  // compile tests
  {
    input: './test-src/JsonStreamStringify.spec.ts',
    output: [{
      file: './test/JsonStreamStringify.spec.js',
      format: 'umd',
      name: 'jsonStreamStringify',
      sourcemap: true,
      globals: {
        stream: 'stream',
      },
    }, ],
    plugins: [
      typescript(),
      babel({
        babelrc: false,
        extensions: ['.js', '.ts'],
        presets,
        plugins: ['istanbul'],
        exclude: 'node_modules/**',
        runtimeHelpers: true,
      }),
    ],
    external(v) {
      return !(/([\\/]test-src[\\/])|(^.\/)|(^\0)/).test(v);
    },
  },
];

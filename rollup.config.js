import { babel } from '@rollup/plugin-babel';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';
import dts from 'rollup-plugin-dts';

const input = './src/JsonStreamStringify.ts';
const tsconfigOverride = { compilerOptions: { declaration: false } };
const extensions = ['.ts', '.js', '.mjs'];
const targets = {
  chrome: 55,
  node: '7.10.1',
};
const envConfig = {
  forceAllTransforms: false,
  debug: false,
  useBuiltIns: 'usage',
  targets,
  corejs: 3,
  modules: false,
};
const presets = [
  ['@babel/preset-env', {
    ...envConfig,
    corejs: 3,
    useBuiltIns: 'usage',
  }],
];
const presetsNoPolly = [
  ['@babel/preset-env', {
    ...envConfig,
    useBuiltIns: false,
  }],
];

function createExportConfig(
  output = {
    name: 'jsonStreamStringify',
    sourcemap: true,
    globals: {
      stream: 'stream',
    },
  },
  plugins = [
    typescript({
      useTsconfigDeclarationDir: true,
    }),
    nodeResolve({
      jsnext: true,
      extensions,
    }),
    babel({
      babelrc: false,
      extensions,
      presets,
      exclude: 'node_modules/**',
      babelHelpers: 'runtime',
      plugins: [
        '@babel/plugin-transform-runtime',
      ],
    }),
  ],
) {
  return {
    input,
    output: {
      name: 'jsonStreamStringify',
      sourcemap: true,
      globals: {
        stream: 'stream',
      },
      ...output,
    },
    plugins,
    external(v) {
      return [
        'stream',
        'core-js/',
        '@babel/runtime',
      ].some((el) => v === el || v.startsWith(el));
    },
  };
}

const pluginsNoPolly = [
  typescript({ tsconfigOverride }),
  nodeResolve({
    jsnext: true,
    extensions,
  }),
  babel({
    babelrc: false,
    extensions,
    presets: presetsNoPolly,
    exclude: 'node_modules/**',
    plugins: [],
  }),
];

export default [
  createExportConfig({
    file: './lib/esm/polyfill.mjs',
    format: 'es',
  }),
  // no polyfilled output
  createExportConfig({
    file: './lib/esm/index.mjs',
    format: 'es',
  }, pluginsNoPolly),
  // no polyfilled output
  createExportConfig({
    file: './lib/umd/index.js',
    format: 'umd',
  }, pluginsNoPolly),
  // no polyfilled output
  createExportConfig({
    file: './lib/cjs/index.js',
    format: 'cjs',
  }, pluginsNoPolly),
  createExportConfig({
    file: './lib/umd/polyfill.js',
    format: 'umd',
  }),
  createExportConfig({
    file: './lib/cjs/polyfill.js',
    format: 'cjs',
  }),

  // generate typings
  {
    input,
    output: [{ file: 'lib/types/index.d.ts', format: 'es' }],
    plugins: [dts()],
  },

  // compile tests
  {
    input: './test-src/JsonStreamStringify.esm.ts',
    output: {
      file: './test/JsonStreamStringify.esm.js',
      format: 'umd',
      name: 'jsonStreamStringify-esm',
      sourcemap: true,
      globals: {
        stream: 'stream',
      },
    },
    plugins: [
      nodeResolve({
        jsnext: true,
        extensions,
      }),
      typescript({
        tsconfigOverride: {
          compilerOptions: {
            ...tsconfigOverride.compilerOptions,
            module: 'ESNext',
          },
        },
      }),
      babel({
        babelrc: false,
        extensions,
        presets: [],
        exclude: 'node_modules/**',
      }),
    ],
    external(v) {
      return !(/([\\/]test-src[\\/])|(^.\/)|(^\0)/).test(v);
    },
  },
  {
    input: './test-src/JsonStreamStringify.spec.ts',
    output: {
      dir: './test',
      format: 'cjs',
      name: 'jsonStreamStringify',
      sourcemap: true,
      globals: {
        stream: 'stream',
      },
    },
    plugins: [
      nodeResolve({
        jsnext: true,
        extensions,
      }),
      typescript({ tsconfigOverride }),
      babel({
        babelrc: false,
        extensions,
        presets,
        exclude: 'node_modules/**',
      }),
    ],
    external(v) {
      return !(/([\\/]test-src[\\/])|(^.\/)|(^\0)/).test(v) || v.includes('JsonStreamStringify.dynamic.');
    },
  },
];

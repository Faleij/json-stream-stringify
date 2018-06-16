import babel from 'rollup-plugin-babel';
import index from 'rollup-plugin-node-globals';

const name = 'jsonStreamStringify';
const babelOptions = {
  presets: [
    ['env', {
      targets: {
        ie: 9,
        node: '0.10',
        DUK: '1.5',
      },
      modules: false,
      useBuiltIns: true,
    }],
  ],
  plugins: [
    'transform-runtime',
  ],
};
const es5Plugins = [
  index(),
  babel(Object.assign({
    exclude: 'node_modules/**',
    runtimeHelpers: true,
  }, babelOptions)),
];
const es6Plugins = [
  babel({
    exclude: 'node_modules/**',
    minified: false,
    comments: true,
    presets: [['env', {
      targets: { node: '6.5' },
      modules: false,
    }]],
  }),
];

const external = v => [
  'regenerator-runtime/',
  'babel-runtime/',
  'stream',
  'core-js/',
].some(el => v === el || v.startsWith(el));

export default [
  {
    input: 'rollup.es5.entry.js',
    output: {
      file: 'dist/es5.umd.js',
      format: 'umd',
      name,
      sourcemap: true,
      globals: {
        stream: 'stream',
        'regenerator-runtime': 'regeneratorRuntime',
      },
    },
    plugins: es5Plugins.concat([
      // beautify,
    ]),
    external,
  },
  {
    input: 'rollup.es6.entry.js',
    output: {
      file: 'dist/es6.umd.js',
      format: 'umd',
      name,
      sourcemap: true,
      globals: {
        stream: 'stream',
      },
    },
    plugins: es6Plugins.concat([
      // beautify,
    ]),
    external,
  },
];

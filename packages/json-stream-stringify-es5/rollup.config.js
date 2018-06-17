import babel from 'rollup-plugin-babel';
import index from 'rollup-plugin-node-globals';

export default {
  input: './rollup.entry.js',
  output: {
    file: './dist/umd.js',
    format: 'umd',
    name: 'jsonStreamStringify',
    sourcemap: true,
    globals: {
      stream: 'stream',
      'regenerator-runtime': 'regeneratorRuntime',
    },
  },
  plugins: [
    index(),
    babel({
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
      exclude: 'node_modules/**',
      runtimeHelpers: true,
    }),
  ],
  external(v) {
    return [
      'regenerator-runtime/',
      'babel-runtime/',
      'stream',
      'core-js/',
    ].some(el => v === el || v.startsWith(el));
  },
};

import babel from 'rollup-plugin-babel';

export default {
  input: './rollup.entry.js',
  output: {
    file: './dist/umd.js',
    format: 'umd',
    name: 'jsonStreamStringify',
    sourcemap: true,
    globals: {
      stream: 'stream',
    },
  },
  plugins: [
    babel({
      exclude: 'node_modules/**',
      minified: false,
      comments: true,
      presets: [
        ['env', {
          targets: {
            node: '6.5',
          },
          modules: false,
        }],
      ],
    }),
  ],
  external: ['stream'],
};

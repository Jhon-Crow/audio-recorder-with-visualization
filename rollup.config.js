import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';

const packageJson = {
  main: 'dist/index.js',
  module: 'dist/index.esm.js',
  types: 'dist/index.d.ts',
};

export default [
  // Main bundles (CommonJS and ESM)
  {
    input: 'src/index.ts',
    output: [
      {
        file: packageJson.main,
        format: 'cjs',
        sourcemap: true,
        exports: 'named',
      },
      {
        file: packageJson.module,
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: './dist',
      }),
    ],
    external: [],
  },
  // UMD bundle for browser use
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/audio-recorder-visualization.umd.js',
      format: 'umd',
      name: 'AudioRecorderVisualization',
      sourcemap: true,
    },
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
    ],
    external: [],
  },
  // Type definitions bundle
  {
    input: 'dist/index.d.ts',
    output: [{ file: 'dist/index.d.ts', format: 'esm' }],
    plugins: [dts()],
    external: [/\.css$/],
  },
];

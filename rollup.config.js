import dts from 'rollup-plugin-dts'
import esbuild from 'rollup-plugin-esbuild'

export default [
  {
    input: `src/timetracker-api.ts`,
    external: ['moment'],
    plugins: [esbuild()],
    output: [
      {
        file: `dist/timetracker-api_cjs.js`,
        format: 'cjs',
        sourcemap: true,
        exports: 'auto'
      },
      {
        file: `dist/timetracker-api_es.js`,
        format: 'es',
        sourcemap: true,
        exports: 'auto'
      },
    ]
  },
  {
    input: `src/timetracker-api.ts`,
    external: ['moment'],
    plugins: [dts()],
    output: {
      file: `dist/timetracker-api.d.ts`,
      format: 'es'
    },
  }
]

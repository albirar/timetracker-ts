import dts from 'rollup-plugin-dts'
import esbuild from 'rollup-plugin-esbuild'

export default [
  {
    input: `src/timetracker_api.ts`,
    external: ['moment'],
    plugins: [esbuild()],
    output: [
      {
        file: `dist/timetracker_api.cjs`,
        format: 'cjs',
        sourcemap: true,
        exports: 'auto'
      },
    ]
  },
  {
    input: `src/timetracker_api.ts`,
    external: ['moment'],
    plugins: [dts()],
    output: {
      file: `dist/timetracker_api.d.ts`,
      format: 'es'
    },
  }
]

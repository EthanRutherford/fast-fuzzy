import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import babel from 'rollup-plugin-babel';
import pkg from './package.json';

const input = 'src/fuzzy.js';

export default [
	{
		input,
		output: {
			name: 'fuzzy',
			file: pkg.browser,
			format: 'umd'
		},
		plugins: [
      json(),
			resolve(),
      commonjs(),
      babel({
        exclude: ['node_modules/**']
      })
		]
	},

	// CommonJS (for Node) and ES module (for bundlers) build.
	// (We could have three entries in the configuration array
	// instead of two, but it's quicker to generate multiple
	// builds from a single configuration where possible, using
	// an array for the `output` option, where we can specify
	// `file` and `format` for each target)
	{
		input,
		output: [
			{ file: pkg.main, format: 'cjs' },
			{ file: pkg.module, format: 'es' }
    ],
    external: ['graphemesplit'],
    plugins: [
      json(),
      babel({
        exclude: ['node_modules/**']
      })
    ]
	}
];

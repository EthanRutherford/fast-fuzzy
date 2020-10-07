import babel from "rollup-plugin-babel";
import copy from "rollup-plugin-copy";

export default {
	input: "src/fuzzy.js",
	output: [
		{file: "lib/fuzzy.js", format: "cjs"},
		{file: "lib/fuzzy.mjs", format: "es"},
	],
	external: ["graphemesplit"],
	plugins: [
		babel({exclude: ["node_modules/**"]}),
		copy({targets: [
			{src: "src/fuzzy.d.ts", dest: "lib"},
		]}),
	],
};

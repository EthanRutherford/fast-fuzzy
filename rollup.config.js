import babel from "rollup-plugin-babel";

export default {
	input: "src/fuzzy.js",
	output: [
		{file: "lib/fuzzy.js", format: "cjs"},
		{file: "lib/fuzzy.mjs", format: "es"},
	],
	external: ["graphemesplit"],
	plugins: [
		babel({exclude: ["node_modules/**"]}),
	],
};

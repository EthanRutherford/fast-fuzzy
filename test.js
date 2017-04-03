/* global describe, it */
const assert = require("assert");
const {fuzzy, search, Searcher} = require("./fuzzy");

assert.greater = function greater(actual, expected, message) {
	if (actual <= expected) {
		assert.fail(actual, expected, message, ">", assert.fail);
	}
};

assert.less = function greater(actual, expected, message) {
	if (actual >= expected) {
		assert.fail(actual, expected, message, "<", assert.fail);
	}
};

describe("fuzzy", () => {
	it("should score exact matches perfectly", () => {
		assert.equal(fuzzy("hello", "hello"), 1);
		assert.equal(fuzzy("goodbye", "goodbye"), 1);
	});

	it("should score exact substring matches perfectly", () => {
		assert.equal(fuzzy("hello", "hello there"), 1);
		assert.equal(fuzzy("goodbye", "well, goodbye then"), 1);
	});

	it("should score close matches highly", () => {
		assert.greater(fuzzy("help", "hello"), .5);
		assert.greater(fuzzy("goodie", "goodbye"), .5);
	});

	it("should score poor matches poorly", () => {
		assert.less(fuzzy("hello", "goodbye"), .5);
		assert.less(fuzzy("goodbye", "hello"), .5);
	});

	it("should score non-matches minimally", () => {
		assert.equal(fuzzy("hello", "pigs and stuff"), 0);
		assert.equal(fuzzy("goodbye", "cars plus trucks"), 0);
	});
});

describe("search", () => {
	it("should filter out low matches", () => {
		assert.deepEqual(
			search("hello", ["goodbye"]),
			[]
		);
	});

	it("should have good relative ordering", () => {
		assert.deepEqual(
			search("item", ["items", "iterator", "itemize", "item", "temperature"]),
			["item", "items", "itemize", "iterator", "temperature"]
		);
	});

	describe("options", () => {
		it("should work with objects when keySelector is provided", () => {
			assert.throws(() => {
				search("hello", [{name: "hello"}]);
			});
			assert.doesNotThrow(() => {
				search("hello", [{name: "hello"}], {keySelector: (item) => item.name});
			});
			assert.deepEqual(
				search("hello", [{name: "hello"}], {keySelector: (item) => item.name}),
				[{name: "hello"}]
			);
		});

		it("should have more results when threshold is lower", () => {
			assert.greater(
				search("aaa", ["aaa", "aab", "abb", "bbb"], {threshold: .3}).length,
				search("aaa", ["aaa", "aab", "abb", "bbb"], {threshold: .7}).length
			);
		});

		it("should have different results when ignoreCase is set", () => {
			assert.deepEqual(
				search("hello", ["HELLO"], {ignoreCase: false}),
				[]
			);
			assert.deepEqual(
				search("hello", ["HELLO"], {ignoreCase: true}),
				["HELLO"]
			);
		});

		it("should have different results when ignoreSymbols is set", () => {
			assert.deepEqual(
				search("hello", ["h..e..l..l..o"], {ignoreSymbols: false}),
				[]
			);
			assert.deepEqual(
				search("hello", ["h..e..l..l..o"], {ignoreSymbols: true}),
				["h..e..l..l..o"]
			);
		});

		it("should have different results when normalizeWhitespace is set", () => {
			assert.deepEqual(
				search("a b c d", ["a  b  c  d"], {normalizeWhitespace: false}),
				[]
			);
			assert.deepEqual(
				search("a b c d", ["a  b  c  d"], {normalizeWhitespace: true}),
				["a  b  c  d"]
			);
		});
	});
});

describe("Searcher", () => {
	it("should return the same results as search", () => {
		const searcher = new Searcher(["hello", "help", "goodbye"]);
		assert.deepEqual(
			search("hello", ["hello", "help", "goodbye"]),
			searcher.search("hello")
		);
	});

	it("should work more than once", () => {
		const searcher = new Searcher(["aaa", "aab", "abb", "bbb"]);
		assert.deepEqual(
			searcher.search("aaa"),
			["aaa", "aab"]
		);
		assert.deepEqual(
			searcher.search("bbb"),
			["bbb", "abb"]
		);
		assert.deepEqual(
			searcher.search("ccc"),
			[]
		);
	});

	it("should have different behavior with different options", () => {
		//we only really have to test one option, as the more strict
		//tests are handled in search
		//this is really just making sure the options are set
		assert.deepEqual(
			new Searcher(["HELLO"], {ignoreCase: false}).search("hello"),
			[]
		);
		assert.deepEqual(
			new Searcher(["HELLO"], {ignoreCase: true}).search("hello"),
			["HELLO"]
		);
	});

	it("should allow overriding threshold", () => {
		const searcher = new Searcher(["aaa", "aab", "abb", "bbb"], {threshold: .3});
		assert.greater(
			searcher.search("aaa").length,
			searcher.search("aaa", .7).length
		);
	});
});

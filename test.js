/* global describe, it */
const assert = require("assert");
const {fuzzy, search, Searcher} = require("./lib/fuzzy");

assert.greater = function greater(actual, expected, message) {
	if (actual <= expected) {
		assert.fail(actual, expected, message, ">", assert.fail);
	}
};

assert.less = function less(actual, expected, message) {
	if (actual >= expected) {
		assert.fail(actual, expected, message, "<", assert.fail);
	}
};

describe("fuzzy", function() {
	it("should score exact matches perfectly", function() {
		assert.equal(fuzzy("hello", "hello"), 1);
		assert.equal(fuzzy("goodbye", "goodbye"), 1);
	});

	it("should score exact substring matches perfectly", function() {
		assert.equal(fuzzy("hello", "hello there"), 1);
		assert.equal(fuzzy("goodbye", "well, goodbye then"), 1);
	});

	it("should score close matches highly", function() {
		assert.greater(fuzzy("help", "hello"), .5);
		assert.greater(fuzzy("goodie", "goodbye"), .5);
	});

	it("should score poor matches poorly", function() {
		assert.less(fuzzy("hello", "goodbye"), .5);
		assert.less(fuzzy("goodbye", "hello"), .5);
	});

	it("should score non-matches minimally", function() {
		assert.equal(fuzzy("hello", "pigs and stuff"), 0);
		assert.equal(fuzzy("goodbye", "cars plus trucks"), 0);
	});

	it("should return perfect scores for empty search terms", function() {
		assert.equal(fuzzy("", "anything"), 1);
	});

	it("should return minimum scores for empty candidates", function() {
		assert.equal(fuzzy("nothing", ""), 0);
	});

	it("should handle unicode well", function() {
		// unicode characters are normalized
		assert.equal(fuzzy("\u212B", "\u0041\u030A"), 1);
		// handles high and low surrogates as single characters
		assert.equal(fuzzy("high", "h💩gh"), .75);
		// handles combining marks as single characters
		assert.equal(fuzzy("hi zalgo hello hello", "hi Z͑ͫ̓ͪ̂ͫ̽͏̴̙̤̞͉͚̯̞̠͍A̴̵̜̰͔ͫ͗͢L̠ͨͧͩ͘G̴̻͈͍͔̹̑͗̎̅͛́Ǫ̵̹̻̝̳͂̌̌͘ hello hello"), .75);

		// handles graphemes such as hangul jamo and joined emoji as single characters
		assert.equal(fuzzy("high", "h깍👨‍👩‍👧‍👦h"), .5);
	});

	describe("options", function() {
		it("should have different results when ignoreCase is set", function() {
			assert.greater(
				fuzzy("hello", "HELLO", {ignoreCase: true}),
				fuzzy("hello", "HELLO", {ignoreCase: false}),
			);
		});

		it("should have different results when ignoreSymbols is set", function() {
			assert.greater(
				fuzzy("hello", "h..e..l..l..o", {ignoreSymbols: true}),
				fuzzy("hello", "h..e..l..l..o", {ignoreSymbols: false}),
			);
		});

		it("should have different results when normalizeWhitespace is set", function() {
			assert.greater(
				fuzzy("a b c d", "a  b  c  d", {normalizeWhitespace: true}),
				fuzzy("a b c d", "a  b  c  d", {normalizeWhitespace: false}),
			);
		});

		it("should have different results when useDamerau is set", function() {
			assert.equal(fuzzy("abcd", "acbd", {useDamerau: false}), .5);
			assert.equal(fuzzy("abcd", "acbd", {useDamerau: true}), .75);
		});

		it("should return match data when returnMatchData is set", function() {
			assert.deepEqual(
				fuzzy("abcd", "acbd", {returnMatchData: true}),
				{
					item: "acbd",
					original: "acbd",
					key: "acbd",
					score: .75,
					match: {index: 0, length: 4},
				},
			);
		});

		it("should map matches to their original positions", function() {
			assert.deepEqual(
				fuzzy("hello", "  h..e..l..l  ..o", {returnMatchData: true}),
				{
					item: "  h..e..l..l  ..o",
					original: "  h..e..l..l  ..o",
					key: "hell o",
					score: .8,
					match: {index: 2, length: 10},
				},
			);
		});

		it("should allow normal levenshtein", function() {
			const options = {useSellers: false};
			assert.equal(fuzzy("hello", "hello", options), 1);
			assert.equal(fuzzy("hello", "he", options), .4);
			assert.equal(fuzzy("he", "hello", options), .4);
		});
	});
});

describe("search", function() {
	it("should filter out low matches", function() {
		assert.deepEqual(
			search("hello", ["goodbye"]),
			[],
		);
	});

	it("should have good relative ordering", function() {
		// test order by closeness of match
		assert.deepEqual(
			search("item", ["items", "iterator", "itemize", "item", "temperature"]),
			["item", "items", "itemize", "iterator", "temperature"],
		);

		// test order by earliness of match
		assert.deepEqual(
			search("item", ["lineitem", "excitement", "itemize", "item"]),
			["item", "itemize", "excitement", "lineitem"],
		);
	});

	it("should handle empty candidates", function() {
		assert.doesNotThrow(() => search("x", [""]));
	});

	it("should handle unicode well", function() {
		const options = {returnMatchData: true};
		const tSearch = (a, b) => search(a, [b], options)[0].score;
		// unicode characters are normalized
		assert.equal(tSearch("\u212B", "\u0041\u030A"), 1);
		// handles high and low surrogates as single characters
		assert.equal(tSearch("high", "h💩gh"), .75);
		// handles combining marks as single characters
		assert.equal(tSearch("hi zalgo hello hello", "hi Z͑ͫ̓ͪ̂ͫ̽͏̴̙̤̞͉͚̯̞̠͍A̴̵̜̰͔ͫ͗͢L̠ͨͧͩ͘G̴̻͈͍͔̹̑͗̎̅͛́Ǫ̵̹̻̝̳͂̌̌͘ hello hello"), .75);

		// handles graphemes such as hangul jamo and joined emoji as single characters
		assert.equal(tSearch("abcde", "abc깍👨‍👩‍👧‍👦"), .6);
	});

	describe("options", function() {
		// here we describe the search specific options
		// the other options were tested with fuzzy
		it("should work with objects when keySelector is provided", function() {
			assert.throws(() => {
				search("hello", [{name: "hello"}]);
			});
			assert.doesNotThrow(() => {
				search("hello", [{name: "hello"}], {keySelector: (item) => item.name});
			});
			assert.deepEqual(
				search("hello", [{name: "hello"}], {keySelector: (item) => item.name}),
				[{name: "hello"}],
			);
		});

		it("should have good ordering when using multiple keys per object", function() {
			assert.deepEqual(
				search("grin", [["grinning", "grin"], ["grin", "grinning"]]),
				[["grin", "grinning"], ["grinning", "grin"]],
			);

			assert.deepEqual(
				search("laugh", [["smile", "laughing"], ["laughing"], ["laugh"]]),
				[["laugh"], ["laughing"], ["smile", "laughing"]],
			);
		});

		it("should handle searching multiple keys per object", function() {
			assert.doesNotThrow(() => {
				search(
					"hello",
					[{name: "hello", value: "world"}],
					{keySelector: (item) => [item.name, item.value]},
				);
			});
			assert.deepEqual(
				search(
					"hello",
					[
						{name: "hello", value: "jell"},
						{name: "world", value: "hello"},
					],
					{keySelector: (item) => [item.name, item.value]},
				),
				[{name: "hello", value: "jell"}, {name: "world", value: "hello"}],
			);
		});

		it("should have more results when threshold is lower", function() {
			assert.greater(
				search("aaa", ["aaa", "aab", "abb", "bbb"], {threshold: .3}).length,
				search("aaa", ["aaa", "aab", "abb", "bbb"], {threshold: .7}).length,
			);
		});

		it("should return match data when returnMatchData is set", function() {
			assert.equal(
				search("hello", ["hello"])[0].score,
				null,
			);
			assert.deepEqual(
				search("hello", ["hello"], {returnMatchData: true})[0],
				{
					item: "hello",
					original: "hello",
					key: "hello",
					score: 1,
					match: {index: 0, length: 5},
				},
			);
		});

		it("should allow normal levenshtein", function() {
			const options = {useSellers: false};
			const candidates = ["items", "iterator", "itemize", "item", "temperature", "myitem"];
			assert.deepEqual(
				search("item", candidates, options),
				["item", "items", "myitem"],
			);

			assert.deepEqual(
				search("345", ["12345"], options),
				["12345"],
			);

			assert.deepEqual(
				search("12345", ["345"], options),
				["345"],
			);
		});
	});
});

describe("Searcher", function() {
	it("should return the same results as search", function() {
		const searcher = new Searcher(["hello", "help", "goodbye"]);
		assert.deepEqual(
			search("hello", ["hello", "help", "goodbye"]),
			searcher.search("hello"),
		);
	});

	it("should work more than once", function() {
		const searcher = new Searcher(["aaa", "aab", "abb", "bbb"]);
		assert.deepEqual(
			searcher.search("aaa"),
			["aaa", "aab"],
		);
		assert.deepEqual(
			searcher.search("bbb"),
			["bbb", "abb"],
		);
		assert.deepEqual(
			searcher.search("ccc"),
			[],
		);
	});

	it("should have different behavior with different options", function() {
		// we only really have to test one option, as the more strict
		// tests are handled in search/fuzzy
		// this is really just making sure the options are set
		assert.deepEqual(
			new Searcher(["HELLO"], {ignoreCase: false}).search("hello"),
			[],
		);
		assert.deepEqual(
			new Searcher(["HELLO"], {ignoreCase: true}).search("hello"),
			["HELLO"],
		);
	});

	it("should allow overriding threshold", function() {
		const searcher = new Searcher(["aaa", "aab", "abb", "bbb"], {threshold: .3});
		assert.greater(
			searcher.search("aaa").length,
			searcher.search("aaa", {threshold: .7}).length,
		);
	});
});

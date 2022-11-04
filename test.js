/* global describe, it */
const expect = require("expect");
const {sortKind, fuzzy, search, Searcher} = require("./lib/fuzzy");

describe("fuzzy", function() {
	it("should score exact matches perfectly", function() {
		expect(fuzzy("hello", "hello")).toBe(1);
		expect(fuzzy("goodbye", "goodbye")).toBe(1);
	});

	it("should score exact substring matches perfectly", function() {
		expect(fuzzy("hello", "hello there")).toBe(1);
		expect(fuzzy("goodbye", "well, goodbye then")).toBe(1);
	});

	it("should score close matches highly", function() {
		expect(fuzzy("help", "hello")).toBeGreaterThan(.5);
		expect(fuzzy("goodie", "goodbye")).toBeGreaterThan(.5);
	});

	it("should score poor matches poorly", function() {
		expect(fuzzy("hello", "goodbye")).toBeLessThan(.5);
		expect(fuzzy("goodbye", "hello")).toBeLessThan(.5);
	});

	it("should score non-matches minimally", function() {
		expect(fuzzy("hello", "pigs and stuff")).toBe(0);
		expect(fuzzy("goodbye", "cars plus trucks")).toBe(0);
	});

	it("should return perfect scores for empty search terms", function() {
		expect(fuzzy("", "anything")).toBe(1);
	});

	it("should return minimum scores for empty candidates", function() {
		expect(fuzzy("nothing", "")).toBe(0);
	});

	it("should handle unicode well", function() {
		// unicode characters are normalized
		expect(fuzzy("\u212B", "\u0041\u030A")).toBe(1);
		// handles high and low surrogates as single characters
		expect(fuzzy("high", "h💩gh")).toBe(.75);
		// handles combining marks as single characters
		expect(fuzzy("hi zalgo hello hello", "hi Z͑ͫ̓ͪ̂ͫ̽͏̴̙̤̞͉͚̯̞̠͍A̴̵̜̰͔ͫ͗͢L̠ͨͧͩ͘G̴̻͈͍͔̹̑͗̎̅͛́Ǫ̵̹̻̝̳͂̌̌͘ hello hello")).toBe(.75);
		// handles graphemes such as hangul jamo and joined emoji as single characters
		expect(fuzzy("high", "h깍👨‍👩‍👧‍👦h")).toBe(.5);
	});

	it("should handle unicode well(with useSeparatedUnicode)", function() {
		const options = {useSeparatedUnicode: true};
		// unicode characters are normalized
		expect(fuzzy("\u212B", "\u0041\u030A", options)).toBe(1);
		// handles high and low surrogates as multiple characters
		expect(fuzzy("high", "h💩gh", options)).toBe(.5);
		// handles combining marks as single characters
		expect(fuzzy("hi zalgo hello hello", "hi Z͑ͫ̓ͪ̂ͫ̽͏̴̙̤̞͉͚̯̞̠͍A̴̵̜̰͔ͫ͗͢L̠ͨͧͩ͘G̴̻͈͍͔̹̑͗̎̅͛́Ǫ̵̹̻̝̳͂̌̌͘ hello hello", options)).toBe(.6);
		// handles graphemes such as hangul jamo and joined emoji as multiple characters
		expect(fuzzy("high", "h깍👨‍👩‍👧‍👦h", options)).toBe(.25);
		// handles hangul jamo as multiple characters
		expect(fuzzy("ㅅㄹ", "사랑", options)).toBe(.5);
	});

	describe("options", function() {
		it("should have different results when ignoreCase is set", function() {
			expect(
				fuzzy("hello", "HELLO", {ignoreCase: true}),
			).toBeGreaterThan(
				fuzzy("hello", "HELLO", {ignoreCase: false}),
			);
		});

		it("should have different results when ignoreSymbols is set", function() {
			expect(
				fuzzy("hello", "h..e..l..l..o", {ignoreSymbols: true}),
			).toBeGreaterThan(
				fuzzy("hello", "h..e..l..l..o", {ignoreSymbols: false}),
			);
		});

		it("should have different results when normalizeWhitespace is set", function() {
			expect(
				fuzzy("a b c d", "a  b  c  d", {normalizeWhitespace: true}),
			).toBeGreaterThan(
				fuzzy("a b c d", "a  b  c  d", {normalizeWhitespace: false}),
			);
		});

		it("should have different results when useDamerau is set", function() {
			expect(fuzzy("abcd", "acbd", {useDamerau: false})).toBe(.5);
			expect(fuzzy("abcd", "acbd", {useDamerau: true})).toBe(.75);
		});

		it("should return match data when returnMatchData is set", function() {
			expect(fuzzy("abcd", "acbd", {returnMatchData: true})).toEqual({
				item: "acbd",
				original: "acbd",
				key: "acbd",
				score: .75,
				match: {index: 0, length: 4},
			});
		});

		it("should map matches to their original positions", function() {
			expect(fuzzy("hello", "  h..e..l..l  ..o", {returnMatchData: true})).toEqual({
				item: "  h..e..l..l  ..o",
				original: "  h..e..l..l  ..o",
				key: "hell o",
				score: .8,
				match: {index: 2, length: 10},
			});
		});

		it("should allow normal levenshtein", function() {
			const options = {useSellers: false};
			expect(fuzzy("hello", "hello", options)).toBe(1);
			expect(fuzzy("hello", "he", options)).toBe(.4);
			expect(fuzzy("he", "hello", options)).toBe(.4);
		});
	});
});

describe("search", function() {
	it("should filter out low matches", function() {
		expect(search("hello", ["goodbye"])).toEqual([]);
	});

	it("should have good relative ordering", function() {
		// test order by closeness of match
		expect(
			search("item", ["items", "iterator", "itemize", "item", "temperature"]),
		).toEqual(
			["item", "items", "itemize", "iterator", "temperature"],
		);

		// test order by earliness of match
		expect(
			search("item", ["lineitem", "excitement", "itemize", "item"]),
		).toEqual(
			["item", "itemize", "excitement", "lineitem"],
		);
	});

	it("should handle empty candidates", function() {
		expect(() => search("x", [""])).not.toThrow();
	});

	it("should handle unicode well", function() {
		const options = {returnMatchData: true};
		const tSearch = (a, b) => search(a, [b], options)[0].score;
		// unicode characters are normalized
		expect(tSearch("\u212B", "\u0041\u030A")).toBe(1);
		// handles high and low surrogates as single characters
		expect(tSearch("high", "h💩gh")).toBe(.75);
		// handles combining marks as single characters
		expect(tSearch("hi zalgo hello hello", "hi Z͑ͫ̓ͪ̂ͫ̽͏̴̙̤̞͉͚̯̞̠͍A̴̵̜̰͔ͫ͗͢L̠ͨͧͩ͘G̴̻͈͍͔̹̑͗̎̅͛́Ǫ̵̹̻̝̳͂̌̌͘ hello hello")).toBe(.75);
		// handles graphemes such as hangul jamo and joined emoji as single characters
		expect(tSearch("abcde", "abc깍👨‍👩‍👧‍👦")).toBe(.6);
	});

	it("should handle unicode well(with useSeparatedUnicode)", function() {
		const options = {returnMatchData: true, useSeparatedUnicode: true, threshold: 0.5};
		const tSearch = (a, b) => search(a, [b], options)[0].score;
		// unicode characters are normalized
		expect(tSearch("\u212B", "\u0041\u030A")).toBe(1);
		// handles high and low surrogates as multiple characters
		expect(tSearch("high", "h💩gh")).toBe(.5);
		// handles combining marks as multiple characters
		expect(tSearch("hi zalgo hello hello", "hi Z͑ͫ̓ͪ̂ͫ̽͏̴̙̤̞͉͚̯̞̠͍A̴̵̜̰͔ͫ͗͢L̠ͨͧͩ͘G̴̻͈͍͔̹̑͗̎̅͛́Ǫ̵̹̻̝̳͂̌̌͘ hello hello")).toBe(.6);
		// handles graphemes such as hangul jamo and joined emoji as multiple characters
		expect(tSearch("abcde", "abc깍👨‍👩‍👧‍👦")).toBe(.6);
		// handles hangul jamo as multiple characters
		expect(tSearch("ㅅㄹ", "사랑")).toBe(.5);
	});

	describe("options", function() {
		// here we describe the search specific options
		// the other options were tested with fuzzy
		it("should work with objects when keySelector is provided", function() {
			expect(() => search("hello", [{name: "hello"}])).toThrow();
			expect(() => {
				search("hello", [{name: "hello"}], {keySelector: (item) => item.name});
			}).not.toThrow();
			expect(
				search("hello", [{name: "hello"}], {keySelector: (item) => item.name}),
			).toEqual(
				[{name: "hello"}],
			);
		});

		it("should have good ordering when using multiple keys per object", function() {
			expect(
				search("grin", [["grinning", "grin"], ["grin", "grinning"]]),
			).toEqual(
				[["grin", "grinning"], ["grinning", "grin"]],
			);

			expect(
				search("laugh", [["smile", "laughing"], ["laughing"], ["laugh"]]),
			).toEqual(
				[["laugh"], ["laughing"], ["smile", "laughing"]],
			);
		});

		it("should handle searching multiple keys per object", function() {
			expect(() => {
				search(
					"hello",
					[{name: "hello", value: "world"}],
					{keySelector: (item) => [item.name, item.value]},
				);
			}).not.toThrow();
			expect(search(
				"hello",
				[
					{name: "hello", value: "jell"},
					{name: "world", value: "hello"},
				],
				{keySelector: (item) => [item.name, item.value]},
			)).toEqual(
				[{name: "hello", value: "jell"}, {name: "world", value: "hello"}],
			);
		});

		it("should have more results when threshold is lower", function() {
			expect(
				search("aaa", ["aaa", "aab", "abb", "bbb"], {threshold: .3}).length,
			).toBeGreaterThan(
				search("aaa", ["aaa", "aab", "abb", "bbb"], {threshold: .7}).length,
			);
		});

		it("should return match data when returnMatchData is set", function() {
			expect(search("hello", ["hello"])[0].score).toBeUndefined();
			expect(
				search("hello", ["hello"], {returnMatchData: true})[0],
			).toEqual({
				item: "hello",
				original: "hello",
				key: "hello",
				score: 1,
				match: {index: 0, length: 5},
			});
		});

		it("should allow normal levenshtein", function() {
			const options = {useSellers: false};
			const candidates = ["items", "iterator", "itemize", "item", "temperature", "myitem"];
			expect(
				search("item", candidates, options),
			).toEqual(
				["item", "items", "myitem"],
			);

			expect(
				search("345", ["12345"], options),
			).toEqual(
				["12345"],
			);

			expect(
				search("12345", ["345"], options),
			).toEqual(
				["345"],
			);
		});

		it("should allow changing sortBy", function() {
			const candidates = ["hi there", "hello there"];
			expect(
				search("hello there", candidates, {sortBy: sortKind.bestMatch}),
			).toEqual(
				["hello there", "hi there"],
			);
			expect(
				search("hello there", candidates, {sortBy: sortKind.insertOrder}),
			).toEqual(
				["hi there", "hello there"],
			);
		});
	});
});

describe("Searcher", function() {
	it("should return the same results as search", function() {
		const searcher = new Searcher(["hello", "help", "goodbye"]);
		expect(
			search("hello", ["hello", "help", "goodbye"]),
		).toEqual(
			searcher.search("hello"),
		);
	});

	it("should work more than once", function() {
		const searcher = new Searcher(["aaa", "aab", "abb", "bbb"]);
		expect(searcher.search("aaa")).toEqual(["aaa", "aab"]);
		expect(searcher.search("bbb")).toEqual(["bbb", "abb"]);
		expect(searcher.search("ccc")).toEqual([]);
	});

	it("should have different behavior with different options", function() {
		// we only really have to test one option, as the more strict
		// tests are handled in search/fuzzy
		// this is really just making sure the options are set
		expect(new Searcher(["HELLO"], {ignoreCase: false}).search("hello")).toEqual([]);
		expect(
			new Searcher(["HELLO"], {ignoreCase: true}).search("hello"),
		).toEqual(
			["HELLO"],
		);
	});

	it("should allow overriding threshold", function() {
		const searcher = new Searcher(["aaa", "aab", "abb", "bbb"], {threshold: .3});
		expect(
			searcher.search("aaa").length,
		).toBeGreaterThan(
			searcher.search("aaa", {threshold: .7}).length,
		);
	});
});

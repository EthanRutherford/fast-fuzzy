const split = require("graphemesplit");

const whitespaceRegex = /^\s+$/;
const nonWordRegex = /^[`~!@#$%^&*()\-=_+{}[\]\|\\;':",./<>?]+$/;

// the default options, which will be used for any unset option
const defaultOptions = {
	keySelector: (s) => s,
	threshold: .6,
	ignoreCase: true,
	ignoreSymbols: true,
	normalizeWhitespace: true,
	returnMatchData: false,
	useDamerau: true,
};

const arrayWrap = (item) => item instanceof Array ? item : [item];

// return normalized string, with map included
function normalize(string, options) {
	const lower = options.ignoreCase ? string.toLocaleLowerCase() : string;

	// track transformations
	const normal = [];
	const map = [];
	let lastWasWhitespace = true;
	let length = 0;
	for (const grapheme of split(lower)) {
		whitespaceRegex.lastIndex = 0;
		nonWordRegex.lastIndex = 0;
		if (options.normalizeWhitespace && whitespaceRegex.test(grapheme)) {
			if (!lastWasWhitespace) {
				normal.push(" ");
				map.push(length);
				lastWasWhitespace = true;
			}
		} else if (!(options.ignoreSymbols && nonWordRegex.test(grapheme))) {
			normal.push(grapheme.normalize());
			map.push(length);
			lastWasWhitespace = false;
		}

		length += grapheme.length;
	}

	// add the end of the string
	map.push(string.length);

	while (normal[normal.length - 1] === " ") {
		normal.pop();
		map.pop();
	}

	return {original: string, normal, map};
}

// translates a match to the original string
function denormalizeMatchPosition(match, map) {
	return {index: map[match.start], length: map[match.end + 1] - map[match.start]};
}

// walks back up the matrix to find the match index and length
function walkBack(rows, scoreIndex) {
	if (scoreIndex === 0) {
		return {index: 0, length: 0};
	}

	let start = scoreIndex;
	for (let i = rows.length - 2; i > 0 && start > 1; i--) {
		const row = rows[i];
		start = row[start] < row[start - 1] ? start : start - 1;
	}

	return {
		start: start - 1,
		end: scoreIndex - 1,
	};
}

// finds the minimum value of the last row from the levenshtein-sellers matrix
function getScore(rows, length) {
	// search term was empty string, return perfect score
	if (rows.length === 1) {
		return {score: 1, scoreIndex: 0};
	}

	const lastRow = rows[rows.length - 1];
	let minValue = lastRow[0];
	let minIndex = 0;
	for (let i = 1; i < length; i++) {
		const val = lastRow[i];

		if (val < minValue) {
			minValue = val;
			minIndex = i;
		}
	}

	return {
		score: 1 - (minValue / (rows.length - 1)),
		scoreIndex: minIndex,
	};
}

function initSellersRows(rowCount, columnCount) {
	const rows = new Array(rowCount);
	rows[0] = new Array(columnCount).fill(0);
	for (let i = 1; i < rowCount; i++) {
		rows[i] = new Array(columnCount);
		rows[i][0] = i;
	}

	return rows;
}

// the fuzzy scoring algorithm: a modification of levenshtein proposed by Peter H. Sellers
// this essentially finds the substring of "candidate" with the minimum levenshtein distance from "term"
// runtime complexity: O(mn) where m and n are the lengths of term and candidate, respectively
// Note: this method only runs on a single column
function levenshteinSellers(term, candidate, rows, j) {
	for (let i = 0; i < term.length; i++) {
		const rowA = rows[i];
		const rowB = rows[i + 1];

		const cost = term[i] === candidate[j] ? 0 : 1;
		let m;
		let min = rowB[j] + 1; // insertion
		if ((m = rowA[j + 1] + 1) < min) min = m; // deletion
		if ((m = rowA[j] + cost) < min) min = m; // substitution
		rowB[j + 1] = min;
	}
}

// an implementation of the sellers algorithm using damerau-levenshtein as a base
// has all the runtime characteristics of the above, but punishes transpositions less,
// resulting in better tolerance to those types of typos
// Note: this method only runs on a single column
function damerauLevenshteinSellers(term, candidate, rows, j) {
	for (let i = 0; i < term.length; i++) {
		const rowA = rows[i - 1];
		const rowB = rows[i];
		const rowC = rows[i + 1];

		const cost = term[i] === candidate[j] ? 0 : 1;
		let m;
		let min = rowC[j] + 1; // insertion
		if ((m = rowB[j + 1] + 1) < min) min = m; // deletion
		if ((m = rowB[j] + cost) < min) min = m; // substitution
		if (i > 0 && j > 0 && term[i] === candidate[j - 1] && term[i - 1] === candidate[j] && (m = rowA[j - 1] + cost) < min) min = m;
		rowC[j + 1] = min;
	}
}

// method for creating a trie from search candidates
// using a trie can significantly improve search time
function trieInsert(trie, string, item) {
	let walker = trie;
	for (const char of string) {
		// add child node if not already present
		if (walker.children[char] == null) {
			walker.children[char] = {children: {}, candidates: [], depth: 0};
		}

		// log max depth of this subtree
		walker.depth = Math.max(walker.depth, string.length);

		// step into child node
		walker = walker.children[char];
	}

	// log max depth of this subtree
	walker.depth = Math.max(walker.depth, string.length);

	walker.candidates.push(item);
}

// transforms a list of candidates into objects with normalized search keys,
// and inserts them into a trie
// the keySelector is used to pick strings from an object to search by
function createSearchTrie(trie, index, items, options) {
	for (const item of items) {
		const candidates = arrayWrap(options.keySelector(item)).map((key, keyIndex) => ({
			index,
			keyIndex,
			item,
			normalized: normalize(key, options),
		}));

		index++;

		for (const candidate of candidates) {
			trieInsert(trie, candidate.normalized.normal, candidate);
		}
	}
}

// scored item comparator
function compareItems(a, b) {
	const scoreDiff = b.score - a.score;
	if (scoreDiff !== 0) {
		return scoreDiff;
	}

	const keyIndexDiff = a.keyIndex - b.keyIndex;
	if (keyIndexDiff !== 0) {
		return keyIndexDiff;
	}

	const lengthDiff = a.lengthDiff - b.lengthDiff;
	if (lengthDiff !== 0) {
		return lengthDiff;
	}

	return a.index - b.index;
}

// dedupes and adds results to the results list/map
function addResult(results, resultMap, candidate, score, match, lengthDiff) {
	const scoredItem = {
		item: candidate.item,
		normalized: candidate.normalized,
		score,
		match,
		index: candidate.index,
		keyIndex: candidate.keyIndex,
		lengthDiff,
	};

	if (resultMap[candidate.index] == null) {
		resultMap[candidate.index] = results.length;
		results.push(scoredItem);
	} else if (compareItems(scoredItem, results[resultMap[candidate.index]]) < 0) {
		results[resultMap[candidate.index]] = scoredItem;
	}
}

// recursively walk the trie
function searchRecurse(node, string, term, scoreMethod, rows, results, resultMap, options) {
	// build rows
	scoreMethod(term, string, rows, string.length - 1);

	// insert results
	if (node.candidates.length > 0) {
		const lengthDiff = Math.abs(string.length - term.length);
		const scoreResult = getScore(rows, string.length + 1);

		if (scoreResult.score >= options.threshold) {
			const match = options.returnMatchData && walkBack(rows, scoreResult.scoreIndex);

			for (const candidate of node.candidates) {
				addResult(
					results,
					resultMap,
					candidate,
					scoreResult.score,
					match,
					lengthDiff,
				);
			}
		}
	}

	// recurse for children
	for (const key in node.children) {
		// if the search term is sufficiently longer than a candidate,
		// it's impossible to score > threshold.
		// skip any subtrees for which this is true.
		const value = node.children[key];
		if (value.depth / term.length >= options.threshold) {
			searchRecurse(value, string + key, term, scoreMethod, rows, results, resultMap, options);
		}
	}
}

// the core match finder: returns a sorted, filtered list of matches
// this does not normalize input, requiring users to normalize themselves
function searchCore(term, trie, options) {
	const scoreMethod = options.useDamerau ? damerauLevenshteinSellers : levenshteinSellers;

	// walk the trie, scoring and storing the candidates
	const resultMap = {};
	const results = [];

	const rows = initSellersRows(term.length + 1, trie.depth + 1);
	if (options.threshold <= 0 && trie.candidates.length > 0) {
		for (const candidate of trie.candidates) {
			addResult(
				results,
				resultMap,
				candidate,
				0,
				{index: 0, length: 0},
				term.length,
			);
		}
	}
	for (const key in trie.children) {
		const value = trie.children[key];
		searchRecurse(value, key, term, scoreMethod, rows, results, resultMap, options);
	}

	const sorted = results.sort(compareItems);

	if (options.returnMatchData) {
		return sorted.map((candidate) => ({
			item: candidate.item,
			original: candidate.normalized.original,
			key: candidate.normalized.normal.join(""),
			score: candidate.score,
			match: denormalizeMatchPosition(candidate.match, candidate.normalized.map),
		}));
	}

	return sorted.map((candidate) => candidate.item);
}

// wrapper for exporting sellers while allowing options to be passed in
function fuzzy(term, candidate, options) {
	options = {...defaultOptions, ...options};
	const scoreMethod = options.useDamerau ? damerauLevenshteinSellers : levenshteinSellers;
	term = normalize(term, options).normal;
	const normalized = normalize(candidate, options);

	const rows = initSellersRows(term.length + 1, candidate.length + 1);
	for (let j = 0; j < candidate.length; j++) {
		scoreMethod(term, normalized.normal, rows, j);
	}

	const scoreResult = getScore(rows, candidate.length + 1);

	return options.returnMatchData ? {
		item: candidate,
		original: normalized.original,
		key: normalized.normal.join(""),
		score: scoreResult.score,
		match: denormalizeMatchPosition(walkBack(rows, scoreResult.scoreIndex), normalized.map),
	} : scoreResult.score;
}

// simple one-off search. Useful if you don't expect to use the same candidate list again
function search(term, candidates, options) {
	options = Object.assign({}, defaultOptions, options);
	const trie = {children: {}, candidates: [], depth: 0};
	createSearchTrie(trie, 0, candidates, options);
	return searchCore(normalize(term, options).normal, trie, options);
}

// class that improves performance of searching the same set multiple times
// normalizes the strings and caches the result for future calls
class Searcher {
	constructor(candidates, options) {
		this.options = Object.assign({}, defaultOptions, options);
		this.trie = {children: {}, candidates: [], depth: 0};
		createSearchTrie(this.trie, 0, candidates, this.options);
		this.count = candidates.length;
	}
	add(...candidates) {
		createSearchTrie(this.trie, this.count, candidates, this.options);
		this.count += candidates.length;
	}
	search(term, options) {
		options = Object.assign({}, this.options, options);
		return searchCore(normalize(term, this.options).normal, this.trie, options);
	}
}

module.exports = {
	fuzzy,
	search,
	Searcher,
};

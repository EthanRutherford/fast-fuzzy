import split from "graphemesplit";

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
	useSellers: true,
};

const noop = () => {};
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

const levUpdateScore = () => true;
const sellersUpdateScore = (cur, min) => cur < min;

function getLevScore(rows, length) {
	const lastRow = rows[rows.length - 1];
	const lastCell = lastRow[length - 1];
	const scoreLength = Math.max(rows.length, length);
	return {
		score: 1 - (lastCell / (scoreLength - 1)),
		scoreIndex: length - 1,
	};
}
function getSellersScore(rows, length) {
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

function initLevRows(rowCount, columnCount) {
	const rows = new Array(rowCount);
	for (let i = 0; i < rowCount; i++) {
		rows[i] = new Array(columnCount);
		rows[i][0] = i;
	}
	for (let i = 0; i < columnCount; i++) {
		rows[0][i] = i;
	}

	return rows;
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

// the content of the innermost loop of levenshtein
function levCore(term, candidate, rows, i, j) {
	const rowA = rows[i];
	const rowB = rows[i + 1];

	const cost = term[i] === candidate[j] ? 0 : 1;
	let m;
	let min = rowB[j] + 1; // insertion
	if ((m = rowA[j + 1] + 1) < min) min = m; // deletion
	if ((m = rowA[j] + cost) < min) min = m; // substitution
	rowB[j + 1] = min;
}

// runtime complexity: O(mn) where m and n are the lengths of term and candidate, respectively
// Note: this method only runs on a single column
function levenshtein(term, candidate, rows, j) {
	for (let i = 0; i < term.length; i++) {
		levCore(term, candidate, rows, i, j);
	}
}

// has all the runtime characteristics of the above, but punishes transpositions less,
// resulting in better tolerance to those types of typos
// Note: this method only runs on a single column
function damerauLevenshtein(term, candidate, rows, j) {
	// if j === 0, we can't check for transpositions,
	// so use normal levenshtein instead
	if (j === 0) {
		levenshtein(term, candidate, rows, j);
		return;
	}

	// for i === 0, we also can't check for transpositions, so calculate
	// the first row using normal levenshtein as well
	if (term.length > 0) {
		levCore(term, candidate, rows, 0, j);
	}

	for (let i = 1; i < term.length; i++) {
		const rowA = rows[i - 1];
		const rowB = rows[i];
		const rowC = rows[i + 1];

		const cost = term[i] === candidate[j] ? 0 : 1;
		let m;
		// insertion
		let min = rowC[j] + 1;
		// deletion
		if ((m = rowB[j + 1] + 1) < min) min = m;
		// substitution
		if ((m = rowB[j] + cost) < min) min = m;
		// transposition
		if (term[i] === candidate[j - 1] && term[i - 1] === candidate[j] && (m = rowA[j - 1] + cost) < min) min = m;

		rowC[j + 1] = min;
	}
}

// method for creating a trie from search candidates
// using a trie can significantly improve search time
function trieInsert(trie, string, item) {
	let walker = trie;
	for (let i = 0; i < string.length; i++) {
		const char = string[i];

		// add child node if not already present
		if (walker.children[char] == null) {
			walker.children[char] = {children: {}, candidates: [], depth: 0};
		}

		// log max depth of this subtree
		walker.depth = Math.max(walker.depth, string.length - i);

		// step into child node
		walker = walker.children[char];
	}

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

const getLevLength = Math.max;
const getSellersLength = (termLength) => termLength;

// skip any subtrees for which it is impossible to score >= threshold
function levShouldContinue(node, pos, term, threshold, sValue) {
	// earliest point (length) at which sValue could return to 0
	const p1 = pos + sValue;
	// point (length) at which string lengths would match
	const p2 = Math.min(term.length, pos + node.depth + 1);

	// the best score possible is the string which minimizes the value
	// max(sValue, strLenDiff), which is always halfway between p1 and p2
	const length = Math.ceil((p1 + p2) / 2);
	const bestPossibleValue = length - p2;
	return 1 - (bestPossibleValue / length) >= threshold;
}
function sellersShouldContinue(node, _, term, threshold, sValue, lastValue) {
	const bestPossibleValue = Math.min(sValue, lastValue - (node.depth + 1));
	return 1 - (bestPossibleValue / term.length) >= threshold;
}

// recursively walk the trie
function searchRecurse(node, acc, len, term, scoreMethods, rows, results, resultMap, options, sIndex, sValue) {
	if (options.maxRecursions && len > options.maxRecursions) return;
	// build rows
	scoreMethods.score(term, acc, rows, len - 1);

	// track best score and position
	const lastIndex = len;
	const lastValue = rows[rows.length - 1][lastIndex];
	if (scoreMethods.shouldUpdateScore(lastValue, sValue)) {
		sIndex = lastIndex;
		sValue = lastValue;
	}

	// insert results
	if (node.candidates.length > 0) {
		const length = scoreMethods.getLength(term.length, len);
		const score = 1 - (sValue / length);

		if (score >= options.threshold) {
			const match = scoreMethods.walkBack(rows, sIndex);
			const lengthDiff = Math.abs(len - term.length);

			for (const candidate of node.candidates) {
				addResult(
					results,
					resultMap,
					candidate,
					score,
					match,
					lengthDiff,
				);
			}
		}
	}

	// recurse for children
	for (const key in node.children) {
		const child = node.children[key];

		if (scoreMethods.shouldContinue(child, len, term, options.threshold, sValue, lastValue)) {
			acc[len] = key;
			searchRecurse(child, acc, len + 1, term, scoreMethods, rows, results, resultMap, options, sIndex, sValue);
		}
	}
}

// the core match finder: returns a sorted, filtered list of matches
// this does not normalize input, requiring users to normalize themselves
function searchCore(term, trie, options) {
	const initMethod = options.useSellers ? initSellersRows : initLevRows;
	const scoreMethods = {
		score: options.useDamerau ? damerauLevenshtein : levenshtein,
		getLength: options.useSellers ? getSellersLength : getLevLength,
		shouldUpdateScore: options.useSellers ? sellersUpdateScore : levUpdateScore,
		shouldContinue: options.useSellers ? sellersShouldContinue : levShouldContinue,
		walkBack: options.returnMatchData && options.useSellers ? walkBack : noop,
	};

	// walk the trie, scoring and storing the candidates
	const resultMap = {};
	const results = [];

	const rows = initMethod(term.length + 1, trie.depth + 1);
	if (options.threshold <= 0 || term.length === 0) {
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
		const acc = new Array(trie.depth);
		acc[0] = key;
		searchRecurse(value, acc, 1, term, scoreMethods, rows, results, resultMap, options, 0, term.length);
	}

	const sorted = results.sort(compareItems);

	if (options.returnMatchData) {
		const denormalize = options.useSellers ? denormalizeMatchPosition : noop;
		return sorted.map((candidate) => ({
			item: candidate.item,
			original: candidate.normalized.original,
			key: candidate.normalized.normal.join(""),
			score: candidate.score,
			match: denormalize(candidate.match, candidate.normalized.map),
		}));
	}

	return sorted.map((candidate) => candidate.item);
}

// wrapper for exporting sellers while allowing options to be passed in
export function fuzzy(term, candidate, options) {
	options = {...defaultOptions, ...options};
	const initMethod = options.useSellers ? initSellersRows : initLevRows;
	const scoreMethod = options.useDamerau ? damerauLevenshtein : levenshtein;
	const getScore = options.useSellers ? getSellersScore : getLevScore;
	term = normalize(term, options).normal;
	const normalized = normalize(candidate, options);

	const rows = initMethod(term.length + 1, normalized.normal.length + 1);
	for (let j = 0; j < normalized.normal.length; j++) {
		scoreMethod(term, normalized.normal, rows, j);
	}

	const scoreResult = getScore(rows, normalized.normal.length + 1);

	return options.returnMatchData ? {
		item: candidate,
		original: normalized.original,
		key: normalized.normal.join(""),
		score: scoreResult.score,
		match: options.useSellers ? denormalizeMatchPosition(
			walkBack(rows, scoreResult.scoreIndex),
			normalized.map,
		) : noop(),
	} : scoreResult.score;
}

// simple one-off search. Useful if you don't expect to use the same candidate list again
export function search(term, candidates, options) {
	options = {...defaultOptions, ...options};
	const trie = {children: {}, candidates: [], depth: 0};
	createSearchTrie(trie, 0, candidates, options);
	return searchCore(normalize(term, options).normal, trie, options);
}

// class that improves performance of searching the same set multiple times
// normalizes the strings and caches the result for future calls
export class Searcher {
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

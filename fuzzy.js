const nonWordRegex = /[`~!@#$%^&*()\-=_+{}[\]\|\\;':",./<>?]+/g;
const whitespaceRegex = /\s+/g;

const defaultOptions = {
	keySelector: (_) => _,
	threshold: .6,
	ignoreCase: true,
	ignoreSymbols: true,
	normalizeWhitespace: true,
};

//normalize a string according to the options passed in
function normalize(string, options) {
	if (options.ignoreCase) {
		string = string.toLowerCase();
	}
	if (options.ignoreSymbols) {
		string = string.replace(nonWordRegex, "");
	}
	if (options.normalizeWhitespace) {
		string = string.replace(whitespaceRegex, " ").trim();
	}
	return string;
}

//the fuzzy scoring algorithm: a modification of levenshtein proposed by Peter H. Sellers
//this essentially finds the substring of "candidate" with the minimum levenshtein distance from "term"
//runtime complexity: O(mn) where m and n are the lengths of term and candidate, respectively
function sellers(term, candidate) {
	let rowA = new Array(candidate.length + 1).fill(0);

	for (let i = 0; i < term.length; i++) {
		const rowB = [];
		rowB[0] = i + 1;

		for (let j = 0; j < candidate.length; j++) {
			const cost = term[i] === candidate[j] ? 0 : 1;
			rowB[j + 1] = Math.min(rowB[j] + 1, rowA[j + 1] + 1, rowA[j] + cost);
		}

		rowA = rowB;
	}

	return 1 - (Math.min(...rowA) / term.length);
}

//the core match finder: returns a sorted, filtered list of matches
//this does not normalize input, requiring users to normalize themselves
//it also expects candidates in the form {item: any, key: string}
function searchCore(term, candidates, threshold) {
	return candidates.map((candidate) => {
		return {item: candidate.item, key: candidate.key, score: sellers(term, candidate.key)};
	}).filter((candidate) => candidate.score >= threshold).sort((a, b) => {
		if (a.score === b.score) return a.key.length - b.key.length;
		return b.score - a.score;
	}).map((candidate) => candidate.item);
}

//transforms a list of candidates into objects with normalized search keys
//the keySelector is used to pick a string from an object to search by
function createSearchItems(items, options) {
	return items.map((item) => ({item, key: normalize(options.keySelector(item), options)}));
}

//simple one-off search. Useful if you don't expect to use the same candidate list again
function search(term, candidates, options) {
	options = Object.assign({}, defaultOptions, options);
	return searchCore(normalize(term, options), createSearchItems(candidates, options), options.threshold);
}

//class that improves performance of searching the same set multiple times
//normalizes the strings and caches the result for future calls
class Searcher {
	constructor(candidates, options) {
		this.options = Object.assign({}, defaultOptions, options);
		this.candidates = [];
		this.add(...candidates);
	}
	add(...candidates) {
		this.candidates.push(...createSearchItems(candidates, this.options));
	}
	search(term, threshold) {
		if (threshold == null) {
			threshold = this.options.threshold;
		}
		return searchCore(normalize(term, this.options), this.candidates, threshold);
	}
}

module.exports = {
	fuzzy: sellers,
	search,
	Searcher,
};

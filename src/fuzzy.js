const nonWordRegex = /[`~!@#$%^&*()\-=_+{}[\]\|\\;':",./<>?]+/g;
const whitespaceRegex = /\s+/g;

//the default options, which will be used for any unset option
const defaultOptions = {
	keySelector: (_) => _,
	threshold: .6,
	ignoreCase: true,
	ignoreSymbols: true,
	normalizeWhitespace: true,
	returnScores: false,
	useDamerau: true,
};

//normalize a string according to the options passed in
function normalize(string, options) {
	string = string.normalize();
	if (options.ignoreCase) {
		string = string.toLocaleLowerCase();
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
function levenshteinSellers(term, candidate) {
	if (term.length === 0) {
		return 1;
	}

	let rowA = new Array(candidate.length + 1).fill(0);

	for (let i = 0; i < term.length; i++) {
		const rowB = [];
		rowB[0] = i + 1;

		for (let j = 0; j < candidate.length; j++) {
			const cost = term[i] === candidate[j] ? 0 : 1;
			let m;
			let min = rowB[j] + 1; //insertion
			if ((m = rowA[j + 1] + 1) < min) min = m; //deletion
			if ((m = rowA[j] + cost) < min) min = m; //substitution
			rowB[j + 1] = min;
		}

		rowA = rowB;
	}

	return 1 - (Math.min(...rowA) / term.length);
}

//an implementation of the sellers algorithm using damerau-levenshtein as a base
//has all the runtime characteristics of the above, but punishes transpositions less,
//resulting in better tolerance to those types of typos
function damerauLevenshteinSellers(term, candidate) {
	if (term.length === 0) {
		return 1;
	}

	let rowA;
	let rowB = new Array(candidate.length + 1).fill(0);

	for (let i = 0; i < term.length; i++) {
		const rowC = [];
		rowC[0] = i + 1;

		for (let j = 0; j < candidate.length; j++) {
			const cost = term[i] === candidate[j] ? 0 : 1;
			let m;
			let min = rowC[j] + 1; //insertion
			if ((m = rowB[j + 1] + 1) < min) min = m; //deletion
			if ((m = rowB[j] + cost) < min) min = m; //substitution
			if (i > 0 && j > 0 && term[i] === candidate[j - 1] && term[i - 1] === candidate[j] && (m = rowA[j - 1] + cost < min)) min = m;
			rowC[j + 1] = min;
		}

		rowA = rowB;
		rowB = rowC;
	}

	return 1 - (Math.min(...rowB) / term.length);
}

//the core match finder: returns a sorted, filtered list of matches
//this does not normalize input, requiring users to normalize themselves
//it also expects candidates in the form {item: any, key: string}
function searchCore(term, candidates, options) {
	const scoreMethod = options.useDamerau ? damerauLevenshteinSellers : levenshteinSellers;
	let results = candidates.map((candidate) => {
		return {item: candidate.item, key: candidate.key, score: scoreMethod(term, candidate.key)};
	}).filter((candidate) => candidate.score >= options.threshold).sort((a, b) => {
		if (a.score === b.score) {
			return Math.abs(a.key.length - term.length) - Math.abs(b.key.length - term.length);
		}
		return b.score - a.score;
	});

	if (!options.returnScores) {
		results = results.map((candidate) => candidate.item);
	}

	return results;
}

//transforms a list of candidates into objects with normalized search keys
//the keySelector is used to pick a string from an object to search by
function createSearchItems(items, options) {
	return items.map((item) => ({item, key: normalize(options.keySelector(item), options)}));
}

//wrapper for exporting sellers while allowing options to be passed in
function fuzzy(term, candidate, options) {
	options = Object.assign({}, defaultOptions, options);
	const scoreMethod = options.useDamerau ? damerauLevenshteinSellers : levenshteinSellers;
	term = normalize(term, options);
	candidate = normalize(candidate, options);
	return scoreMethod(term, candidate);
}

//simple one-off search. Useful if you don't expect to use the same candidate list again
function search(term, candidates, options) {
	options = Object.assign({}, defaultOptions, options);
	return searchCore(normalize(term, options), createSearchItems(candidates, options), options);
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
	search(term, options) {
		options = Object.assign({}, this.options, options);
		return searchCore(normalize(term, this.options), this.candidates, options);
	}
}

module.exports = {
	fuzzy,
	search,
	Searcher,
};

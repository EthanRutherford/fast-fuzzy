const nonWordRegex = /[`~!@#$%^&*()\-=_+{}[\]\|\\;':",./<>?]+/g;
const whitespaceRegex = /\s+/g;

//the default options, which will be used for any unset option
const defaultOptions = {
	keySelector: (_) => _,
	threshold: .6,
	ignoreCase: true,
	ignoreSymbols: true,
	normalizeWhitespace: true,
	returnMatchData: false,
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

//finds the minimum value of the last row from the levenshtein-sellers matrix
//then walks back up the matrix to find the match index
//runtime complexity: O(m + n) where m and n are the lengths of term and candidate, respectively
function walkBack(rows) {
	const lastRow = rows[rows.length - 1];
	let minValue = lastRow[0];
	let minIndex = 0;
	for (let i = 1; i < lastRow.length; i++) {
		const val = lastRow[i];

		if (val < minValue) {
			minValue = val;
			minIndex = i;
		}
	}

	let start = minIndex;
	for (let i = rows.length - 2; i > 0; i--) {
		//column 1 represents the first character, so break early if we reach 1
		if (start === 1) {
			break;
		}

		const row = rows[i];
		start = row[start] < row[start - 1] ? start : start - 1;
	}

	return {start: start, end: minIndex, value: minValue};
}

//the fuzzy scoring algorithm: a modification of levenshtein proposed by Peter H. Sellers
//this essentially finds the substring of "candidate" with the minimum levenshtein distance from "term"
//runtime complexity: O(mn) where m and n are the lengths of term and candidate, respectively
function levenshteinSellers(term, candidate) {
	if (term.length === 0) {
		return {score: 1, match: {index: 0, length: 0}};
	}

	const rows = new Array(term.length + 1);
	rows[0] = new Array(candidate.length + 1).fill(0);

	for (let i = 0; i < term.length; i++) {
		const rowA = rows[i];
		const rowB = rows[i + 1] = [];
		rowB[0] = i + 1;

		for (let j = 0; j < candidate.length; j++) {
			const cost = term[i] === candidate[j] ? 0 : 1;
			let m;
			let min = rowB[j] + 1; //insertion
			if ((m = rowA[j + 1] + 1) < min) min = m; //deletion
			if ((m = rowA[j] + cost) < min) min = m; //substitution
			rowB[j + 1] = min;
		}
	}

	const results = walkBack(rows);

	return {
		score: 1 - (results.value / term.length),
		match: {
			index: results.start - 1,
			length: (results.end - results.start) + 1,
		},
	};
}

//an implementation of the sellers algorithm using damerau-levenshtein as a base
//has all the runtime characteristics of the above, but punishes transpositions less,
//resulting in better tolerance to those types of typos
function damerauLevenshteinSellers(term, candidate) {
	if (term.length === 0) {
		return {score: 1, match: {index: 0, length: 0}};
	}

	const rows = new Array(term.length + 1);
	rows[0] = new Array(candidate.length + 1).fill(0);

	for (let i = 0; i < term.length; i++) {
		const rowA = rows[i - 1];
		const rowB = rows[i];
		const rowC = rows[i + 1] = [];
		rowC[0] = i + 1;

		for (let j = 0; j < candidate.length; j++) {
			const cost = term[i] === candidate[j] ? 0 : 1;
			let m;
			let min = rowC[j] + 1; //insertion
			if ((m = rowB[j + 1] + 1) < min) min = m; //deletion
			if ((m = rowB[j] + cost) < min) min = m; //substitution
			if (i > 0 && j > 0 && term[i] === candidate[j - 1] && term[i - 1] === candidate[j] && (m = rowA[j - 1] + cost) < min) min = m;
			rowC[j + 1] = min;
		}
	}

	const results = walkBack(rows);

	return {
		score: 1 - (results.value / term.length),
		match: {
			index: results.start - 1,
			length: (results.end - results.start) + 1,
		},
	};
}

//the core match finder: returns a sorted, filtered list of matches
//this does not normalize input, requiring users to normalize themselves
//it also expects candidates in the form {item: any, key: string}
function searchCore(term, candidates, options) {
	const scoreMethod = options.useDamerau ? damerauLevenshteinSellers : levenshteinSellers;
	const results = candidates.map((candidate) => {
		const matchData = scoreMethod(term, candidate.key);
		return {
			item: candidate.item,
			key: candidate.key,
			score: matchData.score,
			match: matchData.match,
		};
	}).filter((candidate) => candidate.score >= options.threshold).sort((a, b) => {
		if (a.score === b.score) {
			return Math.abs(a.key.length - term.length) - Math.abs(b.key.length - term.length);
		}
		return b.score - a.score;
	});

	return options.returnMatchData || options.returnScores ?
		results :
		results.map((candidate) => candidate.item)
	;
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
	const result = scoreMethod(term, candidate);
	return options.returnMatchData ? result : result.score;
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

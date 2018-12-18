const whitespaceRegex = /(\s+)()/g;
const nonWordRegex = /()([`~!@#$%^&*()\-=_+{}[\]\|\\;':",./<>?]+)/g;
const bothRegex = /(\s+)|([`~!@#$%^&*()\-=_+{}[\]\|\\;':",./<>?]+)/g;

// the default options, which will be used for any unset option
const defaultOptions = {
	keySelector: (_) => _,
	threshold: .6,
	ignoreCase: true,
	ignoreSymbols: true,
	normalizeWhitespace: true,
	returnMatchData: false,
	useDamerau: true,
};

const arrayWrap = (item) => item instanceof Array ? item : [item];

// normalize a string according to the options passed in
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

// return normalized string, with original and map included
function normalizeWithMap(string, options) {
	const original = string.normalize();
	let normal = original;
	if (options.ignoreCase) {
		normal = normal.toLocaleLowerCase();
	}

	// track transformations
	const map = [];
	let regex;
	if (options.normalizeWhitespace) {
		const trimStart = normal.match(/^\s+/);
		if (trimStart) {
			map.push({index: 0, offset: trimStart[0].length});
		}
		normal = normal.trim();

		if (options.ignoreSymbols) {
			regex = bothRegex;
		} else {
			regex = whitespaceRegex;
		}
	} else if (options.ignoreSymbols) {
		regex = nonWordRegex;
	} else {
		return {original, normal, map: []};
	}

	let lastInd = 0;
	let built = "";
	let match;
	let prev = map[map.length - 1] || {index: -.1};
	while ((match = regex.exec(normal))) {
		let length = match[0].length;
		built += normal.slice(lastInd, match.index);

		lastInd = match.index + length;
		if (match[1]) {
			built += " ";
			if (length === 1) continue;
			length--;
		}

		const start = built.length;
		if (prev.index === start) {
			prev.offset += length;
		} else {
			map.push(prev = {index: start, offset: length});
		}
	}

	return {original, normal: built + normal.slice(lastInd), map};
}

// translate a match to the original string
function denormalizeMatchPosition(match, map) {
	const start = match.index;
	const end = match.index + match.length;
	let i = 0;
	while (i < map.length && map[i].index <= end) {
		if (map[i].index <= start) {
			match.index += map[i].offset;
		} else {
			match.length += map[i].offset;
		}

		i++;
	}

	return match;
}

// finds the minimum value of the last row from the levenshtein-sellers matrix
// then walks back up the matrix to find the match index
// runtime complexity: O(m + n) where m and n are the lengths of term and candidate, respectively
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
		// column 1 represents the first character, so break early if we reach 1
		if (start === 1) {
			break;
		}

		const row = rows[i];
		start = row[start] < row[start - 1] ? start : start - 1;
	}

	return {start: start, end: minIndex, value: minValue};
}

// the fuzzy scoring algorithm: a modification of levenshtein proposed by Peter H. Sellers
// this essentially finds the substring of "candidate" with the minimum levenshtein distance from "term"
// runtime complexity: O(mn) where m and n are the lengths of term and candidate, respectively
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
			let min = rowB[j] + 1; // insertion
			if ((m = rowA[j + 1] + 1) < min) min = m; // deletion
			if ((m = rowA[j] + cost) < min) min = m; // substitution
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

// an implementation of the sellers algorithm using damerau-levenshtein as a base
// has all the runtime characteristics of the above, but punishes transpositions less,
// resulting in better tolerance to those types of typos
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
			let min = rowC[j] + 1; // insertion
			if ((m = rowB[j + 1] + 1) < min) min = m; // deletion
			if ((m = rowB[j] + cost) < min) min = m; // substitution
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

// the core match finder: returns a sorted, filtered list of matches
// this does not normalize input, requiring users to normalize themselves
// it also expects candidates in the form {item: any, key: string}
function searchCore(term, candidates, options) {
	const scoreMethod = options.useDamerau ? damerauLevenshteinSellers : levenshteinSellers;
	const results = candidates.map((candidate) => {
		const matches = candidate.normalized.map((item) => ({
			...item,
			// if the search term is sufficiently longer than the candidate, it's impossible to score > threshold
			// skip any items for which this is true
			...item.normal.length / term.length < options.threshold ?
				{score: 0, match: {}} :
				scoreMethod(term, item.normal)
			,
		}));

		const bestMatch = matches.reduce((best, cur) => {
			if (best.score === cur.score) {
				const curDiff = Math.abs(cur.normal.length - term.length);
				const bestDiff = Math.abs(best.normal.length - term.length);
				return curDiff < bestDiff ? cur : best;
			}

			return cur.score > best.score ? cur : best;
		});

		return {
			item: candidate.item,
			original: bestMatch.original,
			key: bestMatch.normal,
			score: bestMatch.score,
			match: options.returnMatchData && denormalizeMatchPosition(bestMatch.match, bestMatch.map),
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

// transforms a list of candidates into objects with normalized search keys
// the keySelector is used to pick a string from an object to search by
function createSearchItems(items, options) {
	return items.map((item) => ({
		item,
		normalized: arrayWrap(options.keySelector(item)).map(
			(key) => normalizeWithMap(key, options),
		),
	}));
}

// wrapper for exporting sellers while allowing options to be passed in
function fuzzy(term, candidate, options) {
	options = Object.assign({}, defaultOptions, options);
	const scoreMethod = options.useDamerau ? damerauLevenshteinSellers : levenshteinSellers;
	term = normalize(term, options);
	const normalized = normalizeWithMap(candidate, options);
	const result = scoreMethod(term, normalized.normal);
	return options.returnMatchData ? {
		item: candidate,
		original: normalized.original,
		key: normalized.normal,
		score: result.score,
		match: denormalizeMatchPosition(result.match, normalized.map),
	} : result.score;
}

// simple one-off search. Useful if you don't expect to use the same candidate list again
function search(term, candidates, options) {
	options = Object.assign({}, defaultOptions, options);
	return searchCore(normalize(term, options), createSearchItems(candidates, options), options);
}

// class that improves performance of searching the same set multiple times
// normalizes the strings and caches the result for future calls
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

# fast-fuzzy [![Build Status](https://travis-ci.org/EthanRutherford/fast-fuzzy.svg?branch=master)](https://travis-ci.org/EthanRutherford/fast-fuzzy) [![npm](https://img.shields.io/npm/v/fast-fuzzy.svg)](https://www.npmjs.com/package/fast-fuzzy)
Fast fuzzy-search utility

## methodology
fast-fuzzy is a tiny, lightning-quick on-line fuzzy-searching utility.
The ranking algorithm is a modification of [levenshtein distance](https://en.wikipedia.org/wiki/Levenshtein_distance)
proposed by Peter H. Sellers ([paper](https://pdfs.semanticscholar.org/0517/aa6d420f66f74bd4b281e2ed0e2021f3d359.pdf)).
fast-fuzzy also use the [damerau-levenshtein distance](https://en.wikipedia.org/wiki/Damerau%E2%80%93Levenshtein_distance)
by default, which, compared to normal levenshtein, punishes transpositions less.

Inputs are normalized before search. Normalization consists of standard utf8-normalization,
followed by optionally taking the lowercase of a string,
optionally removing non-word characters,
and optionally flattening/trimming whitespace.

Inputs are scored from `0` to `1`, where a higher score indicates a closer match.
When searching, results are returned in descending order of score.
Ties are broken by favoring the candidate whose length is closest to the length of the search term.
This causes matches which are closer to exact full string matches to be effectively ranked higher in the case of a tie.

## exports
| name | description | signature |
| ---- | --------- | ------------ |
| `fuzzy` | fuzzy ranking algorithm; returns match strength | `(term, candidate, options?) => score` |
| `search` | for one-off searches; returns a sorted array of matches | `(term, candidates, options?) => matches` |
| `Searcher` | for searching the same set of candidates multiple times; caches normalization and key selection | `N/A`

### `Searcher` methods
| name | description | signature |
| ---- | --------- | ------------ |
| `constructor` | supply the options and initial list of candidates | `(candidates?, options?) => searcher` |
| `add` | add new candidates to the list | `(...candidates) => void` |
| `search` | perform a search against the instance's candidates  |`(term, options?) => matches`* |

\* allows overriding the `threshold`, `returnMatchData`, and `useDamerau` options

## options
`Searcher` and `search` both take an options object for configuring behavior.

| option | type | description | default |
| ------ | ---- | ----------- | ------- |
| keySelector | `Function` | selects the string to search (if candidates are objects) | `(_) => _`
| threshold | `Number` | the minimum score that can be returned | `.6`
| ignoreCase | `Bool` | normalize case by calling `toLower` on input and pattern | `true`
| ignoreSymbols | `Bool` | strip non-word symbols* from input | `true`
| normalizeWhitespace | `Bool`| normalize and trim whitespace | `true`
| returnMatchData | `Bool` | return match data** | `false`
| useDamerau | `Bool` | use damerau-levenshtein distance | `true`

\*  `` `~!@#$%^&*()-=_+{}[]\|\;':",./<>? ``

\*\* in the form `{item, original, key, score, match: {index, length}}`

`fuzzy` accepts a subset of these options (excluding keySelector and threshold) with the same defaults.

## examples
You can call `fuzzy` directly to get a match score for a single string

```javascript
const {fuzzy} = require("fast-fuzzy");

fuzzy("hello", "hello world"); //returns 1
fuzzy("word", "hello world"); //returns .75

//pass in custom options
fuzzy("hello world", "hello  world"); //returns 1
fuzzy("hello world", "hello  world", {normalizeWhitespace: false}); //returns .90909090...
```

Use `search` to search a list of strings or objects

```javascript
const {search} = require("fast-fuzzy");

search("abc", ["def", "bcd", "cde", "abc"]); //returns ["abc", "bcd"]

//pass in a keySelector to search for objects
search(
    "abc",
    [{name: "def"}, {name: "bcd"}, {name: "cde"}, {name: "abc"}],
    {keySelector: (obj) => obj.name},
);
//returns [{name: "abc"}, {name: "bcd"}]

//pass returnMatchData to receive the matchData for each result
search("abc", ["def", "bcd", "cde", "abc"], {returnMatchData: true});
/* returns [{
    item: 'abc', original: 'abc', key: 'abc', score: 1,
    match: {index: 0, length: 3},
}, { 
    item: 'bcd', original: 'bcd', key: 'bcd', score: 0.6666666666666667,
    match: {index: 0, length: 2},
}] */
```

Use `Searcher` in much the same way as `search`

```javascript
const {Searcher} = require("fast-fuzzy");

const searcher = new Searcher(["def", "bcd", "cde", "abc"]);
searcher.search("abc"); //returns ["abc", "bcd"]

//options are passed in on construction
const anotherSearcher = new Searcher(
    [{name: "thing1"}, {name: "thing2"}],
    {keySelector: (obj) => obj.name},
);

//some options can be overridden per call
searcher.search("abc", {returnMatchData: true});
/* returns [{
    item: 'abc', original: 'abc', key: 'abc', score: 1,
    match: {index: 0, length: 3},
}, { 
    item: 'bcd', original: 'bcd', key: 'bcd', score: 0.6666666666666667,
    match: {index: 0, length: 2},
}] */
```

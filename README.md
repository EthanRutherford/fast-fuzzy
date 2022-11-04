# fast-fuzzy [![Build Status](https://travis-ci.com/EthanRutherford/fast-fuzzy.svg?branch=master)](https://travis-ci.com/EthanRutherford/fast-fuzzy) [![npm](https://img.shields.io/npm/v/fast-fuzzy.svg)](https://www.npmjs.com/package/fast-fuzzy)
Fast fuzzy-search utility

## methodology
fast-fuzzy is a tiny, lightning-quick fuzzy-searching utility.
The ranking algorithm is a modification of [levenshtein distance](https://en.wikipedia.org/wiki/Levenshtein_distance)
proposed by Peter H. Sellers ([paper](https://pdfs.semanticscholar.org/0517/aa6d420f66f74bd4b281e2ed0e2021f3d359.pdf)).
fast-fuzzy also uses the [damerau-levenshtein distance](https://en.wikipedia.org/wiki/Damerau%E2%80%93Levenshtein_distance)
by default, which, compared to normal levenshtein, punishes transpositions less.

Inputs are normalized before search.
Normalization consists of standard utf8-normalization,
optionally taking the lowercase of a string,
optionally removing non-word characters,
and optionally flattening/trimming whitespace.
Graphemes, such as conjoined emoji 👨‍👩‍👧‍, are treated as single characters.

Inputs are scored from `0` to `1`, where a higher score indicates a closer match.
When searching, results are returned in descending order of score.
Ties in score are broken by earliness of match (when using sellers substring match only).
Further ties are broken by favoring the candidate whose length is closest to the length of the search term.
This causes matches which are closer to exact full string matches to be effectively ranked higher.
Ties in length difference are broken by insertion order.

Lists of candidates are stored in a [trie](https://en.wikipedia.org/wiki/Trie) internally, which
avoids doing redundant work on candidates with common prefixes.
Additionally, when a subtree of the trie can be determined to have no string which could possibly
score >= the threshold, the entire subtree is skipped.
This significantly improves search times compared to a bruteforce search.

While the default options are to use Damerau and Sellers (transposition-friendly substring search),
either of these options can be opted out of if the need arises.

## exports
| name | description | signature |
| ---- | --------- | ------------ |
| `fuzzy` | fuzzy ranking algorithm; returns match strength | `(term, candidate, options?) => score` |
| `search` | for one-off searches; returns a sorted array of matches | `(term, candidates, options?) => matches` |
| `Searcher` | for searching the same set of candidates multiple times; caches the constructed trie<sup>1</sup> | `N/A` |

<sup>1</sup> it is recommended that you use a `Searcher` when searching the same set multiple times.
`search` will create a new trie every time, and while this is relatively cheap, it can have an
impact on responsiveness if you intend to update search results in real time, i.e. while typing.

### `Searcher` methods
| name | description | signature |
| ---- | --------- | ------------ |
| `constructor` | supply the options and initial list of candidates | `(candidates?, options?) => searcher` |
| `add` | add new candidates to the list | `(...candidates) => void` |
| `search` | perform a search against the instance's candidates  |`(term, options?) => matches`<sup>2</sup> |

<sup>2</sup> allows overriding the `threshold`, `returnMatchData`, and `useDamerau` options

## options
`Searcher` and `search` both take an options object for configuring behavior.

| option | type | description | default |
| ------ | ---- | ----------- | ------- |
| keySelector | `Function` | selects the string(s)<sup>3</sup> to search when candidates are objects | `s => s`
| threshold | `Number` | the minimum score that can be returned | `.6`
| ignoreCase | `Bool` | normalize case by calling `toLower` on input and pattern | `true`
| ignoreSymbols | `Bool` | strip non-word symbols<sup>4</sup> from input | `true`
| normalizeWhitespace | `Bool`| normalize and trim whitespace | `true`
| returnMatchData | `Bool` | return match data<sup>5</sup> | `false`
| useDamerau | `Bool` | use damerau-levenshtein distance | `true`
| useSellers | `Bool` | use the Sellers method for substring matching | `true`
| useSeparatedUnicode | `Bool` | use separated unicode | `false`
| sortBy | `sortKind` | defines which order results are returned in<sup>6</sup> | `bestMatch`

<sup>3</sup> if the keySelector returns an array, the candidate will take the score of the highest scoring key.

<sup>4</sup> `` `~!@#$%^&*()-=_+{}[]\|\;':",./<>? ``

<sup>5</sup> in the form `{item, original, key, score, match: {index, length}}`. 
Match index and length are in terms of the original, non-normalized string.
Also note that `match` will be `undefined` if `useSellers` is `false`.

<sup>6</sup> the supported sortKinds are `insertOrder` and `bestMatch`

`fuzzy` accepts a subset of these options (excluding keySelector, threshold, and sortBy) with the same defaults.

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

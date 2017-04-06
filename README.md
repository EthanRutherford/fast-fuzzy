# fast-fuzzy [![Build Status](https://travis-ci.org/EthanRutherford/fast-fuzzy.svg?branch=master)](https://travis-ci.org/EthanRutherford/fast-fuzzy)
Fast fuzzy search utility

### methodology
fast-fuzzy is an on-line fuzzy searching utility that is pretty fast for moderate sized lists of candidates.
The ranking algorithm is a modification of [levenshtein distance](https://en.wikipedia.org/wiki/Levenshtein_distance)
proposed by Peter H. Sellers ([paper](https://pdfs.semanticscholar.org/0517/aa6d420f66f74bd4b281e2ed0e2021f3d359.pdf)).
We also use the [damerau-levenshtein distance](https://en.wikipedia.org/wiki/Damerau%E2%80%93Levenshtein_distance)
as opposed to normal levenshtein in order to get better results.

Inputs are normalized by taking the lowercase of a string, removing non-word characters, reducing all whitespace to single spaces,
and trimming off any leading or trailing whitespace, and calling string.normalize.

### exports
* fuzzy - the core fuzzy search ranking function. returns a number between 0 and 1, with 1 being perfect match and 0 being perfect mismatch.
* search - search function for one-off searches. returns a filtered and sorted copy of the original array.
* Searcher - a class for searching the same set of candidates multiple times. caches normalization and key selection.

### options
`Searcher` and `search` both take an options object for configuring behavior.

* keySelector - a function which selects the string to search (if candidates are objects). Default is `(_) => _`
* threshold - a number from 0 to 1 representing the minimum score. Default is `.6`
* ignoreCase - a boolean specifying whether or not to ignore case. Default is `true`
* ignoreSymbols - a boolean specifying whether or not to ignore ``` `~!@#$%^&*()-=_+{}[]|\\;':",./<>? ```. Default is `true`
* normalizeWhitespace - a boolean specifying whether or not to normalize and trim whitespace. Default is `true`
* returnScores - a boolean specifying whether or not to return the scores. Default is `false`
	* objects are returned in the form `{item, key, score}`
* useDamerau - a boolean specifying whether or not to use the damerau-levenshtein distance. Default is `true`

`fuzzy` accepts a subset of these options (ignoreCase, ignoreSymbols, normalizeWhitespace, useDamerau) with the same defaults.

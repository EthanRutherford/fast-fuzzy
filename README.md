# fast-fuzzy
Fast fuzzy search utility

### methodology
fast-fuzzy is an on-line fuzzy searching utility that is pretty fast for moderate sized lists of candidates.
The ranking algorithm is a modification of [levenshtein distance](https://en.wikipedia.org/wiki/Levenshtein_distance)
proposed by Peter H. Sellers ([paper](https://pdfs.semanticscholar.org/0517/aa6d420f66f74bd4b281e2ed0e2021f3d359.pdf)).

Inputs are normalized by taking the lowercase of a string, removing non-word characters, reducing all whitespace to single spaces,
and trimming off any leading or trailing whitespace.

### exports
* fuzzy - the core fuzzy search ranking function. returns a number between 0 and 1, with 1 being perfect match and 0 being perfect mismatch.
* search - search function for one-off searches. returns a filtered and sorted copy of the original array.
* Searcher - a class for searching the same set of candidates multiple times. caches normalization and key selection.

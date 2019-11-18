# Formulation for subtree short-circuit logic

## Background

This library was initially written to facilitate fast autocomplete for arbitrary
sets of candidates. As such, it initially *only* supported using the Sellers version
of the levenshtein distance, which is specialized for finding **substrings** of
the candidate strings, rather than computing **full matches**. As such, the
formulation of short-circuit logic for the sellers version was done first, and
it also happened to be much easier than the one for normal levenshtein.

This explains why the formulations for sellers and normal levenshtein are so
different. As such, this document will go over the sellers version first, and
then follow with what makes the normal version more difficult, and then how it was
finally solved.

### why short circuit?

Searching through large numbers of candidates is expensive, so it is important
to find ways to reduce the total amount of work needed. One way that this
can be done is to reduce duplicated effort. Strings which share the first few
characters will have identical values in the columns for those shared characters.
Using this knowledge, we can construct a trie, and then compute these columns
once for all words starting with those characters, instead of recomputing them
for every word. This typically avoids a lot of work, and is also an important
component of how the short-circuiting logic works.

## Logic

### the sellers version
At each node in the subtree, we know both what our best diff so far is, and
how deep the subtree this node represents is. Using this knowledge, we can
determine whether or not it is *possible* to score >= the given threshold.
First, if the minimum distance is already good enough, then we continue.
If it's not, then we check by taking the distance at the current point,
and then assuming every remaining character we can get to in the subtree
could be a match, and so reducing the distance value by the remaining depth.
If this new value scores high enough, we continue, and if not we can skip that
whole subtree.

### the normal version
Initially, I assumed this would be almost identical to the sellers version, but
I quickly realized that there's a big difference here. Namely, in the sellers
version the score is normalized to the range 0-1 by dividing by the length of
the search term. This works because we're searching for a substring match.

When searching for a **full** match, the score has to be normalized by using the
greater of the candidate length or the term length. Because otherwise, "he" and
"hello" would be a perfect match in one direction, and a poor match in the other,
depending on which is the term and which is the candidate.

What this means is that there's a tradeoff between how many "points" the candidate
can potentially "win back" if we continue on to longer strings, and what the actual
minimum possible distance is based on the differences in the lengths of the strings.

### finding patterns
The best chance for a good score, unlike in sellers, is *not* the longest string
in the subtree, but rather a point where the two curves of "how many points can
I potentially win back" and "what's the minimum possible distance due to string
length differences" meet. To figure out a way to find that point, I wrote out the
following tables to look for patterns:

#### Table 1

| total depth | term length | current position | distance |
| ----------- | ----------- | ---------------- | -------- |
| 10          | 5           | 3                | 3        |

| position | best distance | length difference | total penalty |
| -------- | ------------- | ----------------- | ------------- |
| 4        | 2             | 1    	           | 2/5           |
| 5        | 1             | 0                 | 1/5           |
| 6        | 0             | 1                 | 1/6           |
| 7        | 0             | 2                 | 2/7           |
| 8        | 0             | 3                 | 3/8           |
| 9        | 0             | 4                 | 4/9           |
| 10       | 0             | 5                 | 5/10          |

#### Table 2

| total depth | term length | current position | distance |
| ----------- | ----------- | ---------------- | -------- |
| 10          | 5           | 4                | 3        |

| position | best distance | length difference | total penalty |
| -------- | ------------- | ----------------- | ------------- |
| 5        | 2             | 0                 | 2/5           |
| 6        | 1             | 1                 | 1/6           |
| 7        | 0             | 2                 | 2/7           |
| 8        | 0             | 3                 | 3/8           |
| 9        | 0             | 4                 | 4/9           |
| 10       | 0             | 5                 | 5/10          |

#### Table 3

| total depth | term length | current position | distance |
| ----------- | ----------- | ---------------- | -------- |
| 10          | 5           | 5                | 3        |

| position | best distance | length difference | total penalty |
| -------- | ------------- | ----------------- | ------------- |
| 6        | 2             | 1                 | 2/6           |
| 7        | 1             | 2                 | 2/7           |
| 8        | 0             | 3                 | 3/8           |
| 9        | 0             | 4                 | 4/9           |
| 10       | 0             | 5                 | 5/10          |

#### Table 4

| total depth | term length | current position | distance |
| ----------- | ----------- | ---------------- | -------- |
| 10          | 5           | 6                | 3        |

| position | best distance | length difference | total penalty |
| -------- | ------------- | ----------------- | ------------- |
| 7        | 2             | 2                 | 2/7           |
| 8        | 1             | 3                 | 3/8           |
| 9        | 0             | 4                 | 4/9           |
| 10       | 0             | 5                 | 5/10          |

### putting it together
Looking at these numbers, I was able to determine that there is a point where
the penalty from the length difference and the potential for better scores
meet. I determined that if you define `p1` as the first point where the "best
distance" column reaches 0, and `p2` as the point at which the "length difference"
column reaches 0 (another way to describe this is the point where the strings are
the same length), the lowest potential penalty is at the position directly in the
middle (rounded up in the case of an odd number).

It is left as an exercise to the reader to prove to themselves that this
is the case.

In addition, I discovered that p1 can be the same or larger than p2, but can
never be less than. This is also left as an exercise to the reader, but the
table below should make it apparent why this is the case.

#### Table 5

| total depth | term length | current position | distance |
| ----------- | ----------- | ---------------- | -------- |
| 10          | 5           | 0                | 5        |

| position | best distance | length difference | total penalty |
| -------- | ------------- | ----------------- | ------------- |
| 0        | 5             | 5    	           | 5/5           |
| 1        | 4             | 4    	           | 4/5           |
| 2        | 3             | 3    	           | 3/5           |
| 3        | 2             | 2    	           | 2/5           |
| 4        | 1             | 1    	           | 1/5           |
| 5        | 0             | 0                 | 0/5           |
| 6        | 0             | 1                 | 1/6           |
| 7        | 0             | 2                 | 2/7           |
| 8        | 0             | 3                 | 3/8           |
| 9        | 0             | 4                 | 4/9           |
| 10       | 0             | 5                 | 5/10          |

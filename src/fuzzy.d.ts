declare module 'fast-fuzzy' {
	export enum sortKind {
		insertOrder = "insertOrder",
		bestMatch = "bestMatch",
	}

	interface FuzzyOptions {
		ignoreCase?: boolean,
		ignoreSymbols?: boolean,
		normalizeWhitespace?: boolean,
		useDamerau?: boolean,
		useSellers?: boolean,
		useSeparatedUnicode?: boolean,
		returnMatchData?: boolean,
		sortBy?: sortKind,
	}

	interface AdditionalOptions<T> {
		keySelector?: (s: T) => string | string[],
		threshold?: number,
	}

	export type FullOptions<T> = FuzzyOptions & AdditionalOptions<T>;

	export interface MatchData<T> {
		item: T,
		original: string,
		key: string,
		score: number,
		match: {
			index: number,
			length: number,
		},
	}

	export function fuzzy<T extends FuzzyOptions>(term: string, candidate: string, options?: T): T["returnMatchData"] extends true ? MatchData<string> : number;
	export function search<T extends (string | object), U extends FullOptions<T>>(term: string, candidates: T[], options?: U):
		U["returnMatchData"] extends true ? MatchData<T>[] : T[];
	export class Searcher<T extends (string | object), U extends FullOptions<T>> {
		constructor(candidates?: T[], options?: U);
		add(...candidates: T[]): void;
		search<V extends FullOptions<T>>(term: string, options?: V):
			V["returnMatchData"] extends true ? MatchData<T>[]
			: V["returnMatchData"] extends false ? T[]
			: U["returnMatchData"] extends true ? MatchData<T>[]
			: T[];
	}
}

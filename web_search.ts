import { Plugin } from "@opencode/plugin";

const TAVILY_API_URL = "https://api.tavily.com/search";
const REQUEST_TIMEOUT_MS = 120_000;

type SearchDepth = "basic" | "advanced" | "fast" | "ultra-fast";
type TimeRange = "day" | "week" | "month" | "year";
type Topic = "general" | "news" | "finance";
type IncludeAnswer = "basic" | "advanced";

interface WebSearchArgs {
	query: string;
	max_results?: number;
	search_depth?: SearchDepth;
	topic?: Topic;
	time_range?: TimeRange;
	start_date?: string;
	end_date?: string;
	include_answer?: boolean | IncludeAnswer;
	include_domains?: string[];
	exclude_domains?: string[];
}

interface TavilyResult {
	title: string;
	url: string;
	content?: string;
	score?: number;
	published_date?: string;
}

interface TavilyResponse {
	query: string;
	answer?: string | null;
	results?: TavilyResult[];
	response_time?: number;
	images?: unknown[];
}

const DESCRIPTION =
	'Searches the live web using Tavily. Use this whenever you need current information that is not in the project or your training data. Returns ranked web results with source links and content snippets. For real-time news and current events, use topic "news" together with time_range. Uses a Tavily API key if TAVILY_API_KEY is set, otherwise falls back to Tavily\'s free keyless search.';

function buildHeaders(): Record<string, string> {
	const apiKey = process.env.TAVILY_API_KEY;
	if (apiKey) {
		return {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		};
	}
	return {
		"Content-Type": "application/json",
		"X-Tavily-Access-Mode": "keyless",
	};
}

function formatResults(data: TavilyResponse): string {
	const lines: string[] = [];

	if (data.answer) {
		lines.push(data.answer.trim());
		lines.push("");
	}

	const results = data.results ?? [];
	if (results.length === 0) {
		lines.push("No search results returned.");
		return lines.join("\n");
	}

	lines.push("Sources:");
	for (const [index, result] of results.entries()) {
		const published = result.published_date
			? ` (published: ${result.published_date})`
			: "";
		lines.push(`${index + 1}. [${result.title}](${result.url})${published}`);
		if (result.content) {
			lines.push(`   ${result.content.trim()}`);
		}
	}

	return lines.join("\n");
}

async function callTavilySearch(
	body: unknown,
	signal?: AbortSignal,
): Promise<TavilyResponse> {
	const controller = new AbortController();
	const abortFromCaller = () => controller.abort(signal?.reason);
	if (signal) {
		if (signal.aborted) controller.abort(signal.reason);
		else signal.addEventListener("abort", abortFromCaller, { once: true });
	}
	const timeout = setTimeout(
		() => controller.abort(new Error("request timed out")),
		REQUEST_TIMEOUT_MS,
	);

	try {
		const response = await fetch(TAVILY_API_URL, {
			method: "POST",
			headers: buildHeaders(),
			body: JSON.stringify(body),
			signal: controller.signal,
		});

		if (!response.ok) {
			let detail = `${response.status} ${response.statusText}`;
			try {
				const errorJson = (await response.json()) as {
					detail?: { error?: string } | string;
				};
				if (errorJson.detail) {
					detail =
						typeof errorJson.detail === "string"
							? errorJson.detail
							: errorJson.detail.error ?? detail;
				}
			} catch {
				// Ignore parse errors and fall back to status text.
			}
			throw new Error(detail);
		}

		return (await response.json()) as TavilyResponse;
	} finally {
		clearTimeout(timeout);
		signal?.removeEventListener("abort", abortFromCaller);
	}
}

export default Plugin.define({
	id: "tavily-web-search",
	async setup(ctx) {
		await ctx.tool.transform((editor) => {
			editor.add({
				name: "web_search",
				description: DESCRIPTION,
				input: {
					type: "object",
					properties: {
						query: {
							type: "string",
							description: "The web search query",
						},
						max_results: {
							type: "number",
							description: "Maximum number of results to return (default: 5)",
						},
						search_depth: {
							type: "string",
							enum: ["basic", "advanced", "fast", "ultra-fast"],
							description: "Latency vs. relevance tradeoff (default: advanced)",
						},
						topic: {
							type: "string",
							enum: ["general", "news", "finance"],
							description:
								"Search category: general (default), news (real-time updates), or finance",
						},
						time_range: {
							type: "string",
							enum: ["day", "week", "month", "year"],
							description: "Limit results to a recent time range",
						},
						start_date: {
							type: "string",
							description:
								"Only return results published or updated after this date (YYYY-MM-DD)",
						},
						end_date: {
							type: "string",
							description:
								"Only return results published or updated before this date (YYYY-MM-DD)",
						},
						include_answer: {
							anyOf: [
								{ type: "boolean" },
								{ type: "string", enum: ["basic", "advanced"] },
							],
							description:
								'Include an LLM-generated answer in the response: true/"basic" for a quick answer, "advanced" for a detailed one (default: false)',
						},
						include_domains: {
							type: "array",
							items: { type: "string" },
							description:
								'Only return results from these domains (e.g. ["arxiv.org"])',
						},
						exclude_domains: {
							type: "array",
							items: { type: "string" },
							description: "Exclude results from these domains",
						},
					},
					required: ["query"],
					additionalProperties: false,
				},
				async execute(
					input: unknown,
					context: { signal?: AbortSignal },
				): Promise<{ content: string }> {
					const args = input as WebSearchArgs;
					const body: Record<string, unknown> = {
						query: args.query,
						max_results: args.max_results ?? 5,
						search_depth: args.search_depth ?? "advanced",
						include_answer: args.include_answer ?? false,
					};

					if (args.topic) {
						body.topic = args.topic;
					}
					if (args.time_range) {
						body.time_range = args.time_range;
					}
					if (args.start_date) {
						body.start_date = args.start_date;
					}
					if (args.end_date) {
						body.end_date = args.end_date;
					}
					if (args.include_domains) {
						body.include_domains = args.include_domains;
					}
					if (args.exclude_domains) {
						body.exclude_domains = args.exclude_domains;
					}

					try {
						const data = await callTavilySearch(body, context?.signal);
						return { content: formatResults(data) };
					} catch (error) {
						const message =
							error instanceof Error ? error.message : String(error);
						return { content: `Tavily web search failed: ${message}` };
					}
				},
			});
		});
	},
});

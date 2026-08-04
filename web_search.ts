import { tool } from "@opencode-ai/plugin";

const TAVILY_API_URL = "https://api.tavily.com/search";
const REQUEST_TIMEOUT_MS = 120_000;

type SearchDepth = "basic" | "advanced" | "fast" | "ultra-fast";
type TimeRange = "day" | "week" | "month" | "year";

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
		lines.push(`${index + 1}. [${result.title}](${result.url})`);
		if (result.content) {
			lines.push(`   ${result.content.trim()}`);
		}
	}

	return lines.join("\n");
}

async function callTavilySearch(body: unknown): Promise<TavilyResponse> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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
	}
}

export default tool({
	description:
		"Searches the live web using Tavily. Use this whenever you need current information that is not in the project or your training data. Returns ranked web results with source links and content snippets. Uses a Tavily API key if TAVILY_API_KEY is set, otherwise falls back to Tavily's free keyless search.",
	args: {
		query: tool.schema.string().describe("The web search query"),
		max_results: tool.schema
			.number()
			.optional()
			.describe("Maximum number of results to return (default: 5)"),
		search_depth: tool.schema
			.enum(["basic", "advanced", "fast", "ultra-fast"] as SearchDepth[])
			.optional()
			.describe("Latency vs. relevance tradeoff (default: advanced)"),
		time_range: tool.schema
			.enum(["day", "week", "month", "year"] as TimeRange[])
			.optional()
			.describe("Limit results to a recent time range"),
		include_answer: tool.schema
			.boolean()
			.optional()
			.describe(
				"Include an LLM-generated answer in the response (default: false)",
			),
	},
	async execute(args) {
		const body: Record<string, unknown> = {
			query: args.query,
			max_results: args.max_results ?? 5,
			search_depth: args.search_depth ?? "advanced",
			include_answer: args.include_answer ?? false,
		};

		if (args.time_range) {
			body.time_range = args.time_range;
		}

		try {
			const data = await callTavilySearch(body);
			return formatResults(data);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return `Tavily web search failed: ${message}`;
		}
	},
});

# opencode-tavily-web-search

A custom [OpenCode](https://opencode.ai/) tool that brings live web search to OpenCode through the [Tavily](https://tavily.com) API.

This tool only uses Tavily's **web search** endpoint. It does not enable Extract, Crawl, Map, or Research.

## What it does

The tool exposes a `web_search` function to OpenCode. When called, it sends a request directly to `https://api.tavily.com/search` and returns ranked results with source links and content snippets.

## Authentication

The tool prefers an explicit API key and falls back to Tavily's free keyless mode.

- Set `TAVILY_API_KEY` in your environment to use your Tavily account and its higher rate limits.
- If `TAVILY_API_KEY` is not set, the tool sends `X-Tavily-Access-Mode: keyless` and works without any account or key. Keyless mode is rate-limited; if you hit the cap, Tavily returns a natural-language message explaining what happened, so the agent can tell you. Sign up for a free Tavily API key at https://app.tavily.com and set `TAVILY_API_KEY` to keep going - no code changes needed.

## Requirements

- [OpenCode](https://opencode.ai/) installed
- An environment variable `TAVILY_API_KEY` (optional but recommended)

## Installation

1. Copy the tool file into your global OpenCode tools directory:

   ```bash
   mkdir -p ~/.config/opencode/tools
   cp web_search.ts ~/.config/opencode/tools/web_search.ts
   ```

2. Restart OpenCode.

After restart, the `web_search` tool will appear alongside built-in tools like `webfetch` and `bash`.

## Usage

Ask OpenCode anything that needs live web data:

```
What is the latest stable Linux kernel version?
```

OpenCode can call `web_search` with a `query` argument. Optional arguments include:

- `max_results` - Maximum number of results (default: 5, API max: 20)
- `search_depth` - `basic`, `advanced`, `fast`, or `ultra-fast` (default: `advanced`; note `advanced` costs 2 API credits, the others cost 1)
- `topic` - `general` (default), `news` (real-time updates), or `finance`
- `time_range` - `day`, `week`, `month`, or `year`
- `start_date` / `end_date` - Precise date window in `YYYY-MM-DD` format, based on publish or last-updated date
- `include_answer` - Request an LLM-generated answer in addition to sources: `true`/`"basic"` for a quick answer, `"advanced"` for a detailed one (default: `false`)
- `include_domains` - Only return results from these domains
- `exclude_domains` - Exclude results from these domains

Results include each source's publish date when available, which helps judge freshness.

Examples:

```
Search the web for recent Rust release notes, max_results=3, time_range=month.
```

```
Search for today's tech news, topic=news, time_range=day.
```

```
Search arxiv.org for papers on mixture-of-experts routing, include_domains=["arxiv.org"].
```

## Project-local install

To make the tool available only inside a specific project, copy `web_search.ts` to `.opencode/tools/web_search.ts` at the project root instead of the global directory.

## Files

- `web_search.ts` - OpenCode tool definition. Discovered automatically from `~/.config/opencode/tools/` or `.opencode/tools/`.
- `README.md` - This file.

## Notes

- No `opencode.json` changes are required. OpenCode auto-discovers tools placed in `~/.config/opencode/tools/` or `.opencode/tools/`.
- The tool uses `fetch` directly, so no extra Python dependencies or backend scripts are needed.
- Tavily recommends `search_depth: "advanced"` for agent use; this tool uses that default.
- If you need Tavily's Extract, Crawl, Map, or Research features, use the official [opencode-tavily](https://github.com/tavily-ai/opencode-tavily) plugin instead.

# opencode-tavily-web-search

A live web search plugin for [OpenCode](https://opencode.ai/) **v2**, powered by the [Tavily](https://tavily.com) API.

It registers a `web_search` tool that OpenCode can call whenever it needs current information that is not in the project or its training data. It uses Tavily's **web search** endpoint only - not Extract, Crawl, Map, or Research.

> **Requires OpenCode v2.** OpenCode v2 replaced the v1 plugin/tool APIs, and v1 tool files no longer load. This revision is a v2 plugin. For OpenCode v1, use the previous revision - see [OpenCode v1](#opencode-v1).

## What it does

The plugin exposes a `web_search` function to OpenCode. When called, it sends a request directly to `https://api.tavily.com/search` and returns ranked results with source links and content snippets.

## Authentication

The tool prefers an explicit API key and falls back to Tavily's free keyless mode.

- Set `TAVILY_API_KEY` in your environment to use your Tavily account and its higher rate limits.
- If `TAVILY_API_KEY` is not set, the tool sends `X-Tavily-Access-Mode: keyless` and works without any account or key. Keyless mode is rate-limited; if you hit the cap, Tavily returns a natural-language message explaining what happened, so the agent can tell you. Sign up for a free Tavily API key at https://app.tavily.com and set `TAVILY_API_KEY` to keep going - no code changes needed.

## Requirements

- [OpenCode](https://opencode.ai/) **v2** (`opencode --version` reports `2.x`)
- [Node.js](https://nodejs.org/) and npm, to install the plugin's single dependency
- An environment variable `TAVILY_API_KEY` (optional but recommended)

## Installation

1. Clone the plugin and install its dependency:

   ```bash
   git clone git@github.com:mdchia/opencode-tavily-web-search.git
   cd opencode-tavily-web-search
   npm install
   ```

   `npm install` fetches `@opencode/plugin`, the v2 plugin SDK. It has to resolve from the plugin directory, because OpenCode loads local plugins with the host's module resolution.

   > If your npm enforces a minimum release age and the current `@opencode/plugin` is too new, install with `npm install --min-release-age=0`.

2. Register the plugin **directory** in your `opencode.json` (global `~/.config/opencode/opencode.json`, or a project file):

   ```jsonc
   {
     "$schema": "https://opencode.ai/config.json",
     "plugins": ["/absolute/path/to/opencode-tavily-web-search"]
   }
   ```

   The path must point at the directory, not a file, and the directory needs an `index.ts` entry point (this repo has one).

3. Restart OpenCode. The `web_search` tool then appears alongside the built-in tools.

### Project-local install

Copy the whole directory (including `node_modules`, or run `npm install` inside it afterwards) into `.opencode/plugins/` at the project root. OpenCode discovers plugin package directories there automatically, so no `opencode.json` entry is needed.

## Verify it loaded

```bash
opencode plugin list
# tavily-web-search  local  /path/to/opencode-tavily-web-search/index.ts
```

Or query the running server: `opencode api get /api/plugin`.

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

## Files

- `index.ts` - plugin entry point for the directory (re-exports the plugin).
- `web_search.ts` - plugin implementation; registers the `web_search` tool through `ctx.tool.transform`.
- `package.json` - plugin package metadata; depends on `@opencode/plugin`.
- `README.md` - this file.

## How this changed for v2

The v1 version was a **tool file** - `export default tool({ ... })` from `@opencode-ai/plugin`, dropped into `~/.config/opencode/tools/`. OpenCode v2 removed directory-based custom tools, so this is now a **plugin**:

```ts
import { Plugin } from "@opencode/plugin"

export default Plugin.define({
  id: "tavily-web-search",
  async setup(ctx) {
    await ctx.tool.transform((editor) => {
      editor.add({ name: "web_search", description, input, async execute(input, context) { ... } })
    })
  },
})
```

The tool name, arguments, behavior, and Tavily backend are unchanged. The plugin also forwards the session's abort signal to the request, so stopping a session cancels an in-flight search.

## OpenCode v1

The last v1-compatible revision is commit [`6e9303e`](https://github.com/mdchia/opencode-tavily-web-search/commit/6e9303e). Check that out (and copy `web_search.ts` into `~/.config/opencode/tools/`) if you are still on OpenCode v1.

## Notes

- The tool uses `fetch` directly, so no extra Python dependencies or backend scripts are needed.
- Tavily recommends `search_depth: "advanced"` for agent use; this tool uses that default.
- If you need Tavily's Extract, Crawl, Map, or Research features, use the official [opencode-tavily](https://github.com/tavily-ai/opencode-tavily) plugin instead.

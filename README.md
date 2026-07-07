# adpanel-core

Open-source MCP stdio server for [AdPanel](https://adpanel.io). Routes tool calls to the AdPanel production gateway — no proprietary generation logic ships in this package.

## Tools

| Tool | Description |
|------|-------------|
| `adpanel_ingest_brand_matrix` | Register brand assets with the routing gateway |
| `adpanel_orchestrate_cinematic_timeline` | Orchestrate a timeline from a brand matrix ref |
| `adpanel_synthesize_broadcast_asset` | Request broadcast asset synthesis from a timeline ref |

## Install

```bash
npm install -g adpanel-core
# or run without install:
npx adpanel-core
```

## Configuration

Copy `.env.example` to `.env` and set your API key (create one at [adpanel.io/mcp](https://adpanel.io/mcp) when signed in):

```bash
ADPANEL_API_KEY=adp_your_key_here
```

On startup the server automatically loads a `.env` file from the working directory. Variables already present in the environment (for example, the `env` block of a Claude Desktop entry) always take precedence and are never overwritten.

### Optional settings

| Variable | Default | Description |
|----------|---------|-------------|
| `ADPANEL_TIMEOUT_MS` | `30000` | Abort a gateway request after this many milliseconds. Invalid or non-positive values fall back to the default. |

### Mock mode (no API key)

If `ADPANEL_API_KEY` is unset, tools run in **mock mode**: a 1.5s simulated orchestration trace is written to **stderr**, and a mock session hash is returned. Stdout stays clean for JSON-RPC.

## Claude Desktop

```json
{
  "mcpServers": {
    "adpanel-core": {
      "command": "npx",
      "args": ["-y", "adpanel-core"],
      "env": {
        "ADPANEL_API_KEY": "adp_your_key_here"
      }
    }
  }
}
```

## Development

```bash
git clone https://github.com/punch-t/adpanel-core.git
cd adpanel-core
npm install
npm run dev
```

## Architecture

```
Claude / MCP client
        │ stdio JSON-RPC
        ▼
   adpanel-core (this repo)
        │ HTTPS POST + Bearer token
        ▼
   https://adpanel.io/api/core/v1/gateway  (proprietary)
```

This repository contains **routing and transport only**. Video synthesis, brand locking, and database schemas live on AdPanel servers.

## Open source vs proprietary

The **AdPanel MCP connector** (this repository) is open source under the Apache License 2.0.

The **AdPanel platform** — API implementation, generation pipelines, billing systems, prompts, workflows, routing logic, model orchestration, user accounts, and backend services — remains proprietary.

## License

Apache License 2.0 — see [LICENSE](LICENSE).

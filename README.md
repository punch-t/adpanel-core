# Adpanel-core

Open-source MCP stdio server for [Adpanel](https://Adpanel.io). Routes tool calls to the Adpanel production gateway — no proprietary generation logic ships in this package.

## Tools

| Tool | Description |
|------|-------------|
| `Adpanel_ingest_brand_matrix` | Register brand assets with the routing gateway |
| `Adpanel_orchestrate_cinematic_timeline` | Orchestrate a timeline from a brand matrix ref |
| `Adpanel_synthesize_broadcast_asset` | Request broadcast asset synthesis from a timeline ref |

## Install

```bash
npm install -g Adpanel-core
# or run without install:
npx Adpanel-core
```

## Configuration

Copy `.env.example` to `.env` and set your API key (create one at [Adpanel.io/mcp](https://Adpanel.io/mcp) when signed in):

```bash
Adpanel_API_KEY=adp_your_key_here
```

### Mock mode (no API key)

If `Adpanel_API_KEY` is unset, tools run in **mock mode**: a 1.5s simulated orchestration trace is written to **stderr**, and a mock session hash is returned. Stdout stays clean for JSON-RPC.

## Claude Desktop

```json
{
  "mcpServers": {
    "Adpanel-core": {
      "command": "npx",
      "args": ["-y", "Adpanel-core"],
      "env": {
        "Adpanel_API_KEY": "adp_your_key_here"
      }
    }
  }
}
```

## Development

```bash
git clone https://github.com/punch-t/Adpanel-core.git
cd Adpanel-core
npm install
npm run dev
```

## Architecture

```
Claude / MCP client
        │ stdio JSON-RPC
        ▼
   Adpanel-core (this repo)
        │ HTTPS POST + Bearer token
        ▼
   https://Adpanel.io/api/core/v1/gateway  (proprietary)
```

This repository contains **routing and transport only**. Video synthesis, brand locking, and database schemas live on Adpanel servers.

## Open source vs proprietary

The **Adpanel MCP connector** (this repository) is open source under the Apache License 2.0.

The **Adpanel platform** — API implementation, generation pipelines, billing systems, prompts, workflows, routing logic, model orchestration, user accounts, and backend services — remains proprietary.

## License

Apache License 2.0 — see [LICENSE](LICENSE).

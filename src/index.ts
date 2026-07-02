#!/usr/bin/env node
/**
 * AdPanel Core — MCP stdio server.
 * Registers routing tools and delegates to the HTTP gateway or local mock router.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

import {
  hasValidatedApiKey,
  postToolRequest,
  type GatewayToolName,
} from './client.js'
import { executeMockTool } from './mock.js'

const SERVER_VERSION = '0.1.0'

const ingestBrandMatrixSchema = {
  brandName: z
    .string()
    .min(1)
    .max(128)
    .describe('Human-readable brand label for routing'),
  matrixVersion: z
    .string()
    .regex(/^\d+\.\d+$/)
    .default('1.0')
    .describe('Brand matrix schema version'),
  sourceAssets: z
    .array(
      z.object({
        url: z.string().url().describe('Public URL of a brand or reference asset'),
        role: z
          .enum(['logo', 'palette', 'typography', 'reference', 'other'])
          .describe('Asset role within the brand matrix'),
        label: z.string().max(64).optional().describe('Optional asset label'),
      })
    )
    .min(1)
    .max(32)
    .describe('Ordered list of brand source assets'),
  tags: z
    .array(z.string().min(1).max(32))
    .max(20)
    .optional()
    .describe('Optional routing tags'),
}

const orchestrateCinematicTimelineSchema = {
  brandMatrixRef: z
    .string()
    .min(8)
    .max(128)
    .describe('Routing reference returned from ingest_brand_matrix'),
  sessionId: z
    .string()
    .uuid()
    .optional()
    .describe('Optional session identifier to chain orchestration'),
  timeline: z
    .object({
      durationSeconds: z
        .number()
        .int()
        .min(5)
        .max(120)
        .describe('Target timeline duration in seconds'),
      aspectRatio: z
        .enum(['9:16', '16:9', '1:1'])
        .describe('Output aspect ratio'),
      sceneCount: z
        .number()
        .int()
        .min(1)
        .max(24)
        .describe('Number of scenes in the cinematic timeline'),
    })
    .describe('High-level timeline specification'),
  narrativeBrief: z
    .string()
    .max(4000)
    .optional()
    .describe('Optional creative brief for orchestration routing'),
}

const synthesizeBroadcastAssetSchema = {
  sessionId: z
    .string()
    .uuid()
    .describe('Active orchestration session identifier'),
  timelineRef: z
    .string()
    .min(8)
    .max(128)
    .describe('Routing reference returned from orchestrate_cinematic_timeline'),
  output: z
    .object({
      format: z.enum(['mp4', 'mov', 'webm']).describe('Container format'),
      resolution: z
        .enum(['720p', '1080p', '4k'])
        .optional()
        .describe('Target output resolution'),
      profile: z
        .enum(['social', 'broadcast', 'cinema'])
        .optional()
        .describe('Delivery profile for synthesis routing'),
    })
    .describe('Broadcast output envelope'),
  publishTargets: z
    .array(z.string().min(1).max(64))
    .max(10)
    .optional()
    .describe('Optional downstream publish target identifiers'),
}

const getSessionStatusSchema = {
  sessionId: z
    .string()
    .uuid()
    .describe('Active orchestration or synthesis session identifier'),
}

async function routeTool<T extends Record<string, unknown>>(
  tool: GatewayToolName,
  args: T
): Promise<unknown> {
  if (!hasValidatedApiKey()) {
    return executeMockTool(tool, args)
  }
  return postToolRequest(tool, args, SERVER_VERSION)
}

function jsonToolResult(data: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  }
}

const server = new McpServer({
  name: 'adpanel-core',
  version: SERVER_VERSION,
})

server.tool(
  'adpanel_ingest_brand_matrix',
  'Ingest a brand matrix envelope and register source assets with the AdPanel routing gateway.',
  ingestBrandMatrixSchema,
  async (args) => jsonToolResult(await routeTool('adpanel_ingest_brand_matrix', args))
)

server.tool(
  'adpanel_orchestrate_cinematic_timeline',
  'Orchestrate a cinematic timeline from a brand matrix routing reference.',
  orchestrateCinematicTimelineSchema,
  async (args) =>
    jsonToolResult(await routeTool('adpanel_orchestrate_cinematic_timeline', args))
)

server.tool(
  'adpanel_synthesize_broadcast_asset',
  'Synthesize a broadcast-ready asset from an orchestrated timeline routing reference.',
  synthesizeBroadcastAssetSchema,
  async (args) =>
    jsonToolResult(await routeTool('adpanel_synthesize_broadcast_asset', args))
)

server.tool(
  'adpanel_get_session_status',
  'Retrieve the current status of an orchestration or synthesis session.',
  getSessionStatusSchema,
  async (args) =>
    jsonToolResult(await routeTool('adpanel_get_session_status', args))
)

async function main(): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`[adpanel-core] fatal: ${message}\n`)
  process.exit(1)
})

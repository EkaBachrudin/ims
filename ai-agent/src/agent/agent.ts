import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import type { BaseMessage } from "@langchain/core/messages";
import { env, requireOpenAIKey } from "../config/env";
import { buildTools } from "./tools";
import { buildAgentPrompt } from "./prompt";

let cachedLlm: ChatOpenAI | null = null;

function getLlm(): ChatOpenAI {
  if (!cachedLlm) {
    cachedLlm = new ChatOpenAI({
      model: env.OPENAI_MODEL,
      temperature: env.LLM_TEMPERATURE,
      apiKey: requireOpenAIKey(),
    });
  }
  return cachedLlm;
}

export interface AgentRunResult {
  output: string;
  toolName: string | null;
  toolPayload: unknown;
  toolResult: unknown;
}

interface IntermediateStep {
  action: { tool: string; toolInput: unknown };
  observation: unknown;
}

/**
 * Jalankan agent dengan function calling untuk satu pesan.
 * Tools dibuat per-panggilan agar `chatId` ter-inject untuk endpoint internal.
 */
export async function runAgent(input: {
  chatId: string;
  message: string;
  history: BaseMessage[];
}): Promise<AgentRunResult> {
  const tools = buildTools(input.chatId);
  const executor = new AgentExecutor({
    agent: createToolCallingAgent({
      llm: getLlm(),
      tools,
      prompt: buildAgentPrompt(),
    }),
    tools,
    maxIterations: 8,
    returnIntermediateSteps: true,
  });

  const result = await executor.invoke({
    input: input.message,
    chat_history: input.history,
  });

  const steps = (result.intermediateSteps ?? []) as IntermediateStep[];
  const last = steps[steps.length - 1];

  return {
    output: String(result.output ?? ""),
    toolName: last?.action?.tool ?? null,
    toolPayload: last?.action?.toolInput ?? null,
    toolResult: last?.observation ?? null,
  };
}

import dotenv from 'dotenv';
import { ToolLoopAgent, stepCountIs, tool } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import z from 'zod';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

dotenv.config({ path: '.env.local' });

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

const cwd = process.argv[2] || process.cwd();

const read = tool({
    description: `Read a file from the project. Return numbered lines.
    WHEN TO USE: Viewing file contents, checking configs, reading source code.
    WHEN NOT TO USE: Searching across files (Use grep instead).`,
    inputSchema: z.object({
        path: z.string().describe('File path relative to working directory'),
        offset: z.number().optional().describe("Start line (1-indexed)"),
        limit: z.number().optional().describe('Max lines to return'),
    }),
    execute: async ({path: filePath, offset, limit}) => {
        const abs = resolve(cwd, filePath);
        const content = readFileSync(abs, 'utf-8');

        let lines = content.split('\n');

        if (offset) lines = lines.slice(offset - 1);
        if (limit) lines = lines.slice(0, limit);

        const MAX_LINES = 500;
        const truncated = lines.length > MAX_LINES;

        if(truncated) lines = lines.slice(0, MAX_LINES);

        const numbered = lines.map((l,i) => `${(offset || 1) + i}: ${l}`);

        return truncated ? numbered.join('\n') + `\n...(truncated at ${MAX_LINES} lines)` : numbered.join('\n');
    }
});

const agent = new ToolLoopAgent({
    model: openrouter.chat('openrouter/free'),
    instructions: `You are a coding agent.\nWorking directory: ${cwd}`,
    tools: { read },
    stopWhen: stepCountIs(10),
})

const prompt = process.argv.slice(2).join(" ") || "Hello!";
console.log('prompt ', prompt, process.argv.slice(2));
const {text, steps} = await agent.generate({prompt});

console.log(text);
console.log(`\n(${steps.length} steps)`);
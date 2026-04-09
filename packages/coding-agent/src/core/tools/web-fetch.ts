import { fetch } from "undici";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition } from "../extensions/types.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

const NAME = "web_fetch";
const DEFAULT_MAX_CHARS = 20_000;
const DEFAULT_TIMEOUT_MS = 15_000;
const USER_AGENT =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const webFetchSchema = Type.Object({
	url: Type.String({
		description: "The HTTP or HTTPS URL to fetch content from.",
	}),
	prompt: Type.Optional(
		Type.String({
			description: "Optional hint about what information you need from the page.",
		}),
	),
	maxChars: Type.Optional(
		Type.Number({
			description: "Maximum characters to return (default " + DEFAULT_MAX_CHARS + ").",
			minimum: 100,
		}),
	),
});

export type WebFetchInput = Static<typeof webFetchSchema>;

function ok(text: string): AgentToolResult<undefined> {
	return { content: [{ type: "text", text }], details: undefined };
}

function err(text: string): AgentToolResult<undefined> {
	return { content: [{ type: "text", text }], details: undefined };
}

function htmlToText(html: string): { title?: string; content: string } {
	const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
	const title = titleMatch ? titleMatch[1].trim() : undefined;

	let text = html
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
		.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "");

	text = text.replace(/<\/(p|div|li|h[1-6]|tr|blockquote|pre|article|section)>/gi, "\n");
	text = text.replace(/<br\s*\/?>/gi, "\n");
	text = text.replace(/<[^>]+>/g, "");
	text = text
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));
	text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

	return { title, content: text };
}

async function doFetch(input: WebFetchInput): Promise<AgentToolResult<undefined>> {
	const { url, maxChars = DEFAULT_MAX_CHARS, prompt } = input;

	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return err('Error: Invalid URL "' + url + '".');
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		return err("Error: Only HTTP/HTTPS URLs are supported.");
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

	let rawText: string;
	let contentType = "";
	try {
		const res = await fetch(url, {
			headers: { "User-Agent": USER_AGENT },
			signal: controller.signal,
		});
		clearTimeout(timer);
		contentType = res.headers.get("content-type") ?? "";
		if (!res.ok) {
			return err("Error: HTTP " + res.status + " " + res.statusText + " for " + url);
		}
		rawText = await res.text();
	} catch (e: unknown) {
		clearTimeout(timer);
		const msg = e instanceof Error ? e.message : String(e);
		return err("Error fetching " + url + ": " + msg);
	}

	let title: string | undefined;
	let content: string;
	if (contentType.includes("text/html")) {
		const extracted = htmlToText(rawText);
		title = extracted.title;
		content = extracted.content;
	} else {
		content = rawText;
	}

	if (content.length > maxChars) {
		content = content.slice(0, maxChars) + "\n\n[... truncated at " + maxChars + " chars]";
	}

	const headerParts: string[] = ["URL: " + url];
	if (title) headerParts.push("Title: " + title);
	if (prompt) headerParts.push("Query: " + prompt);
	headerParts.push("---");
	return ok(headerParts.join("\n") + "\n\n" + content);
}

const webFetchDefinition: ToolDefinition<typeof webFetchSchema, undefined> = {
	name: NAME,
	label: "Fetch URL",
	description:
		"Fetch the content of a URL and return it as readable text.\n" +
		"Use this to retrieve web pages, API responses, or documentation.\n" +
		"IMPORTANT: This tool WILL FAIL for authenticated or private URLs.\n" +
		"Inputs: url (required), prompt (optional hint), maxChars (optional, default " +
		DEFAULT_MAX_CHARS +
		").",
	parameters: webFetchSchema,
	async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
		return doFetch(params);
	},
};

export const webFetchToolDefinition: ToolDefinition<typeof webFetchSchema, undefined> =
	webFetchDefinition;

export const webFetchTool: AgentTool<typeof webFetchSchema> = wrapToolDefinition(webFetchDefinition);

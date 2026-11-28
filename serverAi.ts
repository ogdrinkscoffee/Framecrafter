import { GoogleGenAI, Type } from '@google/genai';
import type { AiEditElementPayload } from './src/utils/serverValidation.ts';

export type EditElementWithGeminiResult =
  | {
      ok: true;
      updatedCode: string;
      explanation: string;
    }
  | {
      ok: false;
      status: 502 | 503 | 429 | 504;
      error: string;
    };

const GEMINI_MODEL = 'gemini-4-hydrogen';
const GEMINI_TIMEOUT_MS = 30_000;

function stripOptionalMarkdownFences(code: string): string {
  const trimmed = code.trim();
  const fenceMatch = /^```[a-zA-Z0-9_-]*\r?\n([\s\S]*?)\r?\n```$/.exec(trimmed);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

function buildSystemInstruction(fileType: AiEditElementPayload['fileType']): string {
  const languageGuidance =
    fileType === 'html'
      ? 'Return valid, clean HTML for ONLY the targeted element (no <html>, <head>, or <body> wrapper unless the target itself is one).'
      : fileType === 'css'
        ? 'Return valid, clean CSS for ONLY the targeted rule block or declarations.'
        : `Return valid, clean ${fileType.toUpperCase()} JSX for ONLY the targeted element (preserve React className/style object conventions and existing event handlers or prop bindings unless asked to change them).`;

  return [
    'You are Framecraft AI Co-Pilot, a precise UI code editor.',
    languageGuidance,
    'Preserve existing data-* attributes (such as data-ve-id or data-ve-node) if present on the root target element.',
    'Do not wrap updatedCode in markdown code fences.',
    'Use the provided :root designTokens CSS variables when appropriate to keep visual consistency.',
    'Return a concise, plain-language 1-sentence explanation describing the edit.',
  ].join(' ');
}

function buildUserPrompt(input: AiEditElementPayload): string {
  const parts: string[] = [
    `File Type: ${input.fileType}`,
    `Edit Instruction: ${input.prompt}`,
  ];

  if (input.designTokens && Object.keys(input.designTokens).length > 0) {
    const tokenLines = Object.entries(input.designTokens)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n');
    parts.push(`Design Tokens (:root CSS variables):\n:root {\n${tokenLines}\n}`);
  }

  if (input.surroundingContext) {
    parts.push(`Surrounding Context (reference only — do NOT include outside code in updatedCode):\n${input.surroundingContext}`);
  }

  parts.push(`Target Code to Replace:\n${input.targetCode}`);
  return parts.join('\n\n');
}

export async function editElementWithGemini(
  input: AiEditElementPayload
): Promise<EditElementWithGeminiResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim() || '';
  // Deliberately only ever logs whether the key exists, never its value or the
  // surrounding environment (that would leak GITHUB_CLIENT_SECRET and friends
  // into server logs).
  console.error('[Gemini] GEMINI_API_KEY configured:', apiKey ? 'yes' : 'no');
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      error:
        'AI Co-Pilot is unavailable because GEMINI_API_KEY is not configured on the server.',
    };
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
      // Enforced by the SDK on the actual request. A bare AbortController would
      // only set a local flag and never cancel the call.
      timeout: GEMINI_TIMEOUT_MS,
    },
  });

  try {
    console.error('[Gemini] generateContent call starting: model=' + GEMINI_MODEL + ' timeoutMs=' + GEMINI_TIMEOUT_MS);
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: buildUserPrompt(input),
      config: {
        systemInstruction: buildSystemInstruction(input.fileType),
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            updatedCode: {
              type: Type.STRING,
              description:
                'The updated replacement code snippet for only the target element or CSS block, without markdown fences.',
            },
            explanation: {
              type: Type.STRING,
              description: 'A brief one-sentence summary of the visual or code change.',
            },
          },
          required: ['updatedCode', 'explanation'],
        },
      },
    });

    const rawText = (response.text ?? '').trim();
    console.error('[Gemini] generateContent response received; rawTextLen=' + rawText.length);

    if (!rawText) {
      return {
        ok: false,
        status: 502,
        error: 'AI Co-Pilot returned an empty response. Please try rephrasing your prompt.',
      };
    }

    let parsed: { updatedCode?: unknown; explanation?: unknown } | null = null;
    try {
      parsed = JSON.parse(rawText) as { updatedCode?: unknown; explanation?: unknown };
    } catch {
      return {
        ok: false,
        status: 502,
        error: 'AI Co-Pilot returned an invalid structured response. Please retry.',
      };
    }

    const updatedCode =
      typeof parsed?.updatedCode === 'string'
        ? stripOptionalMarkdownFences(parsed.updatedCode)
        : '';
    const explanation =
      typeof parsed?.explanation === 'string' && parsed.explanation.trim()
        ? parsed.explanation.trim().slice(0, 400)
        : 'Updated selected element.';

    if (!updatedCode) {
      return {
        ok: false,
        status: 502,
        error: 'AI Co-Pilot did not produce updated element code. Please try again.',
      };
    }

    console.error('[Gemini] generateContent success: updatedCodeLen=' + updatedCode.length);
    return {
      ok: true,
      updatedCode,
      explanation,
    };
  } catch (err) {
    const statusCode =
      typeof (err as { status?: unknown })?.status === 'number'
        ? ((err as { status: number }).status)
        : 0;
    const message = err instanceof Error ? err.message : '';
    const errName = err instanceof Error ? err.name : '';
    console.error('Gemini edit-element error: status=' + (statusCode || 'n/a') + ' name=' + (errName || 'n/a') + ' message=' + (message || 'n/a'));

    // The SDK raises a timeout/abort error when httpOptions.timeout elapses.
    if (
      errName === 'AbortError' ||
      errName === 'TimeoutError' ||
      /timed? ?out|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT/i.test(message)
    ) {
      return {
        ok: false,
        status: 504,
        error: 'AI Co-Pilot request timed out. Please try again.',
      };
    }

    if (statusCode === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(message)) {
      return {
        ok: false,
        status: 429,
        error: 'AI Co-Pilot rate limit reached. Please wait a moment and try again.',
      };
    }

    if (
      statusCode === 400 ||
      statusCode === 401 ||
      statusCode === 403 ||
      /API_KEY_INVALID|PERMISSION_DENIED/i.test(message)
    ) {
      return {
        ok: false,
        status: 503,
        error:
          'Server Gemini API key is invalid or lacks permission. Check GEMINI_API_KEY in Settings > Secrets.',
      };
    }

    return {
      ok: false,
      status: 502,
      error: 'Unable to complete AI edit right now. Please try again.',
    };
  }
}

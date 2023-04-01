import { IncomingMessage } from "http";
import https from "https";
import { Message, truncateMessages, countTokens } from "./Message";
import { getModelInfo } from "./Model";
import axios from "axios";

export function assertIsError(e: any): asserts e is Error {
  if (!(e instanceof Error)) {
    throw new Error("Not an error");
  }
}

async function fetchFromAPI(endpoint: string) {
  try {
    const res = await axios.get(endpoint, {
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
      },
    });
    return res;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      console.error(e.response?.data);
    }
    throw e;
  }
}

export async function testKey(): Promise<boolean | undefined> {
  try {
    const res = await fetchFromAPI("https://api.openai.com/v1/models");
    return res.status === 200;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      if (e.response!.status === 401) {
        return false;
      }
    }
  }
}

export async function fetchModels(): Promise<string[]> {
  try {
    const res = await fetchFromAPI("https://api.openai.com/v1/models");
    console.log(res.data.data);
    return res.data.data.map((model: any) => model.id);
  } catch (e) {
    return [];
  }
}

export async function _streamCompletion(
  payload: string,
  abortController?: AbortController,
  callback?: ((res: IncomingMessage) => void) | undefined,
  errorCallback?: ((res: IncomingMessage, body: string) => void) | undefined
) {
  const req = https.request(
    {
      hostname: "api.openai.com",
      port: 443,
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
      },
      signal: abortController?.signal,
    },
    (res) => {
      if (res.statusCode !== 200) {
        let errorBody = "";
        res.on("data", (chunk) => {
          errorBody += chunk;
        });
        res.on("end", () => {
          errorCallback?.(res, errorBody);
        });
        return;
      }
      callback?.(res);
    }
  );

  req.write(payload);

  req.end();
}

interface ChatCompletionParams {
  model: string;
  temperature: number;
  top_p: number;
  n: number;
  stop: string;
  max_tokens: number;
  presence_penalty: number;
  frequency_penalty: number;
  logit_bias: string;
}

const paramKeys = [
  "model",
  "temperature",
  "top_p",
  "n",
  "stop",
  "max_tokens",
  "presence_penalty",
  "frequency_penalty",
  "logit_bias",
];

export async function streamCompletion(
  messages: Message[],
  params: ChatCompletionParams,
  abortController?: AbortController,
  callback?: ((res: IncomingMessage) => void) | undefined,
  endCallback?: ((tokensUsed: number) => void) | undefined,
  errorCallback?: ((res: IncomingMessage, body: string) => void) | undefined
) {
  const modelInfo = getModelInfo(params.model);
  const submitMessages = truncateMessages(
    messages,
    modelInfo.maxTokens,
    params.max_tokens
  );
  console.log(`Sending ${submitMessages.length} messages:`);
  console.log(submitMessages.map((m) => m.content.slice(0, 50)).join("\n"));

  // Pick all params in paramKeys
  const submitParams = Object.fromEntries(
    Object.entries(params).filter(([key]) => paramKeys.includes(key))
  );

  const payload = JSON.stringify({
    messages: submitMessages.map(({ role, content }) => ({ role, content })),
    stream: true,
    ...{
      ...submitParams,
      logit_bias: JSON.parse(params.logit_bias || "{}"),
      // 0 == unlimited
      max_tokens: params.max_tokens || undefined,
    },
  });

  let buffer = "";
  const successCallback = (res: IncomingMessage) => {
    res.on("data", (chunk) => {
      if (abortController?.signal.aborted) {
        res.destroy();
        endCallback?.(0);
        return;
      }

      const allMessages = chunk.toString().split("\n\n");
      for (const message of allMessages) {
        const cleaned = message.toString().slice(5);
        if (cleaned === "[DONE]") {
          return;
        }

        let parsed;
        try {
          parsed = JSON.parse(cleaned);
        } catch (e) {
          return;
        }

        const content = parsed.choices[0]?.delta?.content;
        if (content === undefined) {
          continue;
        }
        buffer += content;
        callback?.(content);
      }
    });

    res.on("end", () => {
      const tokensUsed =
        countTokens(submitMessages.map((m) => m.content).join("\n")) +
        countTokens(buffer);
      endCallback?.(tokensUsed);
    });
  };

  return _streamCompletion(
    payload,
    abortController,
    successCallback,
    errorCallback
  );
}

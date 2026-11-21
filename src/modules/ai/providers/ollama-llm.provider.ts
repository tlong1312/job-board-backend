import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LlmProvider } from "./llm.provider";

/**
 * Gọi LLM chạy trong Ollama qua /api/chat. Cấu hình bằng biến môi trường:
 *   OLLAMA_URL         (mặc định http://localhost:11434, dùng chung với embedding)
 *   LLM_MODEL          (mặc định qwen2.5:3b, phải đã `ollama pull` trước)
 *   LLM_TIMEOUT_MS     (mặc định 120000)
 *   LLM_NUM_CTX        (mặc định 4096, số token ngữ cảnh)
 */
@Injectable()
export class OllamaLlmProvider implements LlmProvider {
  readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly numCtx: number;

  constructor(config: ConfigService) {
    this.baseUrl = config
      .get<string>("OLLAMA_URL", "http://localhost:11434")
      .replace(/\/+$/, "");
    this.model = config.get<string>("LLM_MODEL", "qwen2.5:3b");
    this.timeoutMs = Number(config.get("LLM_TIMEOUT_MS", 120000));
    this.numCtx = Number(config.get("LLM_NUM_CTX", 4096));
  }

  async completeJson(system: string, user: string): Promise<string> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          format: "json",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          // nhiệt độ 0 để cùng một CV luôn ra cùng một kết quả (dễ đo, dễ lặp lại)
          options: { temperature: 0, num_ctx: this.numCtx },
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new ServiceUnavailableException(
        `Không gọi được Ollama tại ${this.baseUrl}: ${msg}`,
      );
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ServiceUnavailableException(
        `Ollama trả lỗi ${res.status} (model ${this.model}): ${body.slice(0, 200)}`,
      );
    }

    const data = (await res.json()) as { message?: { content?: unknown } };
    const content = data.message?.content;
    if (typeof content !== "string" || content.trim() === "") {
      throw new ServiceUnavailableException("Ollama trả về nội dung rỗng");
    }
    return content;
  }
}

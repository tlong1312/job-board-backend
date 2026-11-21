/**
 * Cổng chung để gọi một mô hình ngôn ngữ lớn (LLM). Hiện có một cài đặt là Ollama
 * (ollama-llm.provider.ts). Tách cổng ra để sau này đổi mô hình hoặc nhà cung cấp
 * mà không phải sửa nơi dùng, giống cách làm với EMBEDDING_PROVIDER.
 */
export const LLM_PROVIDER = "LLM_PROVIDER";

export interface LlmProvider {
  readonly model: string;
  /** Gửi một cặp system/user, nhận về chuỗi JSON do mô hình sinh ra. */
  completeJson(system: string, user: string): Promise<string>;
}

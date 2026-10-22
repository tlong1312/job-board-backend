import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingProvider } from './embedding.provider';

@Injectable()
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.baseUrl = config
      .get<string>('OLLAMA_URL', 'http://localhost:11434')
      .replace(/\/+$/, '');
    this.model = config.get<string>('EMBEDDING_MODEL', 'bge-m3');
    this.dimensions = Number(config.get('EMBEDDING_DIM', 1024));
    this.timeoutMs = Number(config.get('EMBEDDING_TIMEOUT_MS', 60000));
  }

  async embed(text: string): Promise<number[]> {
    const [vector] = await this.embedBatch([text]);
    return vector;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, input: texts }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new ServiceUnavailableException(
        `Không gọi được Ollama tại ${this.baseUrl}: ${msg}`,
      );
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ServiceUnavailableException(
        `Ollama trả lỗi ${res.status}: ${body.slice(0, 200)}`,
      );
    }

    const data = (await res.json()) as { embeddings?: number[][] };
    const out = data.embeddings;
    if (!Array.isArray(out) || out.length !== texts.length) {
      throw new ServiceUnavailableException(
        'Ollama trả về số vector không khớp số văn bản gửi lên',
      );
    }
    for (const v of out) {
      if (v.length !== this.dimensions) {
        throw new ServiceUnavailableException(
          `Vector có ${v.length} chiều, nhưng cấu hình EMBEDDING_DIM=${this.dimensions}. ` +
            `Kiểm tra EMBEDDING_MODEL và số chiều trong ai-init.sql.`,
        );
      }
    }
    return out;
  }
}

import { Inject, Injectable } from "@nestjs/common";
import {
  EMBEDDING_PROVIDER,
  EmbeddingProvider,
} from "./providers/embedding.provider";

@Injectable()
export class AiService {
  constructor(
    @Inject(EMBEDDING_PROVIDER) private readonly provider: EmbeddingProvider,
  ) {}

  get model(): string {
    return this.provider.model;
  }

  get dimensions(): number {
    return this.provider.dimensions;
  }

  embed(text: string): Promise<number[]> {
    return this.provider.embed(text);
  }

  embedBatch(texts: string[]): Promise<number[][]> {
    return this.provider.embedBatch(texts);
  }

  static toVectorLiteral(vector: number[]): string {
    return `[${vector.join(",")}]`;
  }

  async health() {
    const v = await this.embed("kiểm tra kết nối");
    return { ok: true, model: this.model, dimensions: v.length };
  }
}

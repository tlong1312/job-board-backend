import { DynamicModule, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ClientsModule } from "@nestjs/microservices";
import { AiController } from "./ai.controller";
import { AiSearchController } from "./search/ai-search.controller";
import { AiSearchService } from "./search/ai-search.service";
import { AiService } from "./ai.service";
import {
  AI_QUEUE_CLIENT,
  aiRmqOptions,
  isAiEnabled,
  rabbitUrl,
} from "./ai.config";
import { AiJobsConsumer } from "./jobs/ai-jobs.consumer";
import { AiJobsProducer } from "./jobs/ai-jobs.producer";
import { AiJobsService } from "./jobs/ai-jobs.service";
import { EMBEDDING_PROVIDER } from "./providers/embedding.provider";
import { OllamaEmbeddingProvider } from "./providers/ollama-embedding.provider";

@Module({})
export class AiModule {
  static register(): DynamicModule {
    if (!isAiEnabled()) return { module: AiModule };

    return {
      module: AiModule,
      global: true,
      imports: [
        ConfigModule,
        ClientsModule.registerAsync([
          {
            name: AI_QUEUE_CLIENT,
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) =>
              aiRmqOptions(rabbitUrl(config)),
          },
        ]),
      ],
      controllers: [AiController, AiSearchController, AiJobsConsumer],
      providers: [
        { provide: EMBEDDING_PROVIDER, useClass: OllamaEmbeddingProvider },
        AiService,
        AiJobsService,
        AiJobsProducer,
        AiSearchService,
      ],
      exports: [
        AiService,
        EMBEDDING_PROVIDER,
        AiJobsService,
        AiJobsProducer,
        AiSearchService,
      ],
    };
  }
}

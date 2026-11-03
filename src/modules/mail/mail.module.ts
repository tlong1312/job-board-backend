import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ClientsModule } from "@nestjs/microservices";
import { MAIL_QUEUE_CLIENT, mailRmqOptions } from "./mail.config";
import { MailConsumer } from "./mail.consumer";
import { MailProducer } from "./mail.producer";
import { MailService } from "./mail.service";

@Module({
  imports: [
    ConfigModule,
    ClientsModule.registerAsync([
      {
        name: MAIL_QUEUE_CLIENT,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) =>
          mailRmqOptions(
            config.get<string>("rabbitmq.url", "amqp://localhost:5673"),
            "producer",
          ),
      },
    ]),
  ],
  controllers: [MailConsumer],
  providers: [MailService, MailProducer],
  exports: [MailProducer],
})
export class MailModule {}

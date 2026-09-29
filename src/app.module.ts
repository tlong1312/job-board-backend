import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/users/users.module';
import { MaterialsModule } from './modules/materials/materials.module';
import { ChatsModule } from './modules/chats/chats.module';

@Module({
  imports: [UsersModule, MaterialsModule, ChatsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

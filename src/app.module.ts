import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { VendorModule } from './modules/vendor/vendor.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [VendorModule, UsersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

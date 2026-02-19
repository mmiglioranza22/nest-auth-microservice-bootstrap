import { Module } from '@nestjs/common';
import { SeedService } from './seed.service';
import { SeedController } from './seed.controller';
import { SharedAttributesModule } from 'src/resources/shared/shared-attributes.module';

@Module({
  imports: [SharedAttributesModule],
  controllers: [SeedController],
  providers: [SeedService],
})
export class SeedModule {}

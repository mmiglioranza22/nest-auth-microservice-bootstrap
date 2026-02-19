import { Module } from '@nestjs/common';
import { AuthUserService } from './auth-user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthUser } from './entities/auth-user.entity';
import { RoleModule } from 'src/resources/auth/modules/role/role.module';

@Module({
  imports: [TypeOrmModule.forFeature([AuthUser]), RoleModule],
  providers: [AuthUserService],
  exports: [AuthUserService],
})
export class AuthUserModule {}

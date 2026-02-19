import { Module } from '@nestjs/common';
import { RoleModule } from 'src/resources/auth/modules/role/role.module';
import { AuthUserModule } from 'src/resources/auth/modules/auth-user/auth-user.module';

@Module({
  imports: [RoleModule, AuthUserModule],
  exports: [RoleModule, AuthUserModule],
})
export class SharedAttributesModule {}

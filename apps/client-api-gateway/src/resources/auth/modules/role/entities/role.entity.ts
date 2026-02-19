import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { UserRole } from '../enum/user-role.enum';

@Entity()
// Todo used only in user entity, remove when converted to shared lib
export class Role {
  @PrimaryGeneratedColumn('identity')
  id: number;

  @ApiProperty({
    enum: UserRole,
    description: 'UserRole',
  })
  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;
}

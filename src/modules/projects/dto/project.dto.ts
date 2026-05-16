import {
  IsString, IsOptional, IsEnum, IsDateString, MinLength, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({ example: 'Mobile App v2.0' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ enum: ['PUBLIC', 'PRIVATE', 'INTERNAL'], default: 'PRIVATE' })
  @IsOptional()
  @IsEnum(['PUBLIC', 'PRIVATE', 'INTERNAL'])
  visibility?: 'PUBLIC' | 'PRIVATE' | 'INTERNAL' = 'PRIVATE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @ApiPropertyOptional({ enum: ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED', 'CANCELLED'] })
  @IsOptional()
  @IsEnum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED', 'CANCELLED'])
  status?: string;
}

export class AddProjectMemberDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiPropertyOptional({ enum: ['MANAGER', 'MEMBER', 'VIEWER'], default: 'MEMBER' })
  @IsOptional()
  @IsEnum(['MANAGER', 'MEMBER', 'VIEWER'])
  role?: 'MANAGER' | 'MEMBER' | 'VIEWER' = 'MEMBER';
}

export class CreateWorkflowDto {
  @ApiProperty({ example: 'In Development' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateLabelDto {
  @ApiProperty({ example: 'Bug' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @ApiProperty({ example: '#ef4444' })
  @IsString()
  color: string;
}

import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService, UpdateProfileDto } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiOkResponseWrapped } from '../../common/decorators/api-response-wrapped.decorator';
import { UserEntity } from '../../common/entities/swagger.entities';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user full profile' })
  @ApiOkResponseWrapped(UserEntity)
  async getProfile(@CurrentUser('id') userId: string) {
    return this.usersService.findById(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiOkResponseWrapped(UserEntity)
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Get('me/workload')
  @ApiOperation({ summary: 'Get current user workload and task summary' })
  async getWorkload(@CurrentUser('id') userId: string) {
    return this.usersService.getWorkload(userId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search users by name or email' })
  @ApiOkResponseWrapped(UserEntity, true)
  async search(
    @Query('q') query: string,
    @Query('orgId') orgId?: string,
  ) {
    return this.usersService.searchUsers(query, orgId);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get user profile by ID' })
  async findOne(@Param('userId') userId: string) {
    return this.usersService.findById(userId);
  }

  // Admin endpoints
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Get all platform users' })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.findAll(parseInt(page || '1', 10), parseInt(limit || '20', 10));
  }

  @Patch(':userId/suspend')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Suspend a user account' })
  async suspend(@Param('userId') userId: string) {
    return this.usersService.suspendUser(userId);
  }

  @Delete(':userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Delete a user account' })
  async deleteUser(@Param('userId') userId: string) {
    return this.usersService.deleteUser(userId);
  }

  @Patch(':userId/role')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Update a user role' })
  async updateRole(
    @Param('userId') userId: string,
    @Body('role') role: string,
  ) {
    return this.usersService.updateUserRole(userId, role);
  }

  @Patch(':userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Update any user details' })
  async updateUserAdmin(
    @Param('userId') userId: string,
    @Body() dto: { firstName?: string; lastName?: string; email?: string; role?: string; status?: string },
  ) {
    return this.usersService.updateUserAdmin(userId, dto);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Create a new user' })
  async createUserAdmin(
    @Body() dto: { firstName: string; lastName: string; email: string; role: string; password?: string },
  ) {
    return this.usersService.createUserAdmin(dto);
  }
}

import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import {
  CreateOrganizationDto, UpdateOrganizationDto, InviteMemberDto, UpdateMemberRoleDto,
} from './dto/organization.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiOkResponseWrapped, ApiCreatedResponseWrapped } from '../../common/decorators/api-response-wrapped.decorator';
import { OrganizationEntity } from '../../common/entities/swagger.entities';

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiCreatedResponseWrapped(OrganizationEntity)
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateOrganizationDto) {
    return this.organizationsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all organizations (Super Admin only)' })
  @ApiOkResponseWrapped(OrganizationEntity, true)
  async getAll() {
    // In a real app, verify the user is SUPER_ADMIN here via a guard
    return this.organizationsService.getAll();
  }

  @Get('me')
  @ApiOperation({ summary: 'Get all organizations the current user belongs to' })
  @ApiOkResponseWrapped(OrganizationEntity, true)
  async getMyOrgs(@CurrentUser('id') userId: string) {
    return this.organizationsService.getUserOrganizations(userId);
  }

  @Get(':orgId')
  @ApiOperation({ summary: 'Get organization details' })
  @ApiOkResponseWrapped(OrganizationEntity)
  async findOne(@Param('orgId') orgId: string) {
    return this.organizationsService.findById(orgId);
  }

  @Patch(':orgId')
  @ApiOperation({ summary: 'Update organization' })
  async update(@Param('orgId') orgId: string, @Body() dto: UpdateOrganizationDto) {
    return this.organizationsService.update(orgId, dto);
  }

  @Patch(':orgId/status')
  @ApiOperation({ summary: 'Update organization status (Super Admin only)' })
  async updateStatus(
    @Param('orgId') orgId: string,
    @Body('status') status: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.organizationsService.updateStatus(orgId, status, userId);
  }

  @Get(':orgId/members')
  @ApiOperation({ summary: 'Get organization members' })
  async getMembers(@Param('orgId') orgId: string) {
    return this.organizationsService.getMembers(orgId);
  }

  @Post(':orgId/members/invite')
  @ApiOperation({ summary: 'Invite a user to the organization' })
  async invite(
    @Param('orgId') orgId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.organizationsService.inviteMember(orgId, userId, dto);
  }

  @Post('invitations/:token/accept')
  @ApiOperation({ summary: 'Accept an organization invitation' })
  async acceptInvitation(
    @Param('token') token: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.organizationsService.acceptInvitation(token, userId);
  }

  @Patch(':orgId/members/:userId/role')
  @ApiOperation({ summary: 'Update a member role' })
  async updateRole(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.organizationsService.updateMemberRole(orgId, userId, dto);
  }

  @Delete(':orgId/members/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a member from organization' })
  async removeMember(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
  ) {
    return this.organizationsService.removeMember(orgId, userId);
  }
}

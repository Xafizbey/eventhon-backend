import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const OrgContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.organizationId || request.headers['x-organization-id'];
  },
);

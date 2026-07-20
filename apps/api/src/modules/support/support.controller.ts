import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/jwt-payload.interface';
import { SupportService } from './support.service';

@ApiTags('Support')
@ApiBearerAuth()
@Controller('support')
export class SupportController {
  constructor(private readonly svc: SupportService) {}

  @Post('conversations')
  @ApiOperation({ summary: 'Start a new support conversation' })
  start(
    @CurrentUser() user: AuthUser,
    @Body() body: { type: 'visit' | 'info_request' | 'report' | 'faq'; propertyId?: string },
  ) {
    return this.svc.startConversation(user.id, body.type, body.propertyId);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List user conversations' })
  list(@CurrentUser() user: AuthUser) {
    return this.svc.getConversations(user.id);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Get conversation messages' })
  messages(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.getMessages(user.id, id);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Add message to conversation' })
  addMessage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { content: string; nodeId?: string; options?: any[] },
  ) {
    return this.svc.addMessage(id, 'user', body.content, body.nodeId, body.options);
  }

  @Patch('conversations/:id/resolve')
  @ApiOperation({ summary: 'Resolve a conversation' })
  resolve(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.resolveConversation(user.id, id);
  }

  @Post('visit-requests')
  @ApiOperation({ summary: 'Create a visit request' })
  createVisit(
    @CurrentUser() user: AuthUser,
    @Body() body: { propertyId: string; date: string; time: string; message?: string },
  ) {
    return this.svc.createVisitRequest(user.id, body.propertyId, body.date, body.time, body.message);
  }

  @Get('visit-requests')
  @ApiOperation({ summary: 'List visit requests (buyer or owner)' })
  listVisits(@CurrentUser() user: AuthUser) {
    return this.svc.getVisitRequests(user.id, user.active_role);
  }

  @Patch('visit-requests/:id')
  @ApiOperation({ summary: 'Confirm or reject a visit request (owner)' })
  updateVisit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: 'confirmed' | 'rejected' },
  ) {
    return this.svc.updateVisitStatus(user.id, id, body.status);
  }

  @Get('active-requests')
  @ApiOperation({ summary: 'Check active requests for a property' })
  activeRequests(
    @CurrentUser() user: AuthUser,
    @Query('propertyId') propertyId: string,
  ) {
    return this.svc.getActiveRequests(user.id, propertyId);
  }

  @Post('advisor-requests')
  @ApiOperation({ summary: 'Request a human advisor to sell/rent your property for you' })
  requestAdvisor(
    @CurrentUser() user: AuthUser,
    @Body() body: { need: string; details?: string; contactName: string; contactPhone: string },
  ) {
    return this.svc.createAdvisorRequest(user.id, body);
  }

  @Post('reports')
  @ApiOperation({ summary: 'Report a property issue' })
  report(
    @CurrentUser() user: AuthUser,
    @Body() body: { propertyId: string; reportType: string; description: string },
  ) {
    return this.svc.createReport(user.id, body.propertyId, body.reportType, body.description);
  }
}

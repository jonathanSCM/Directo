import { Module } from '@nestjs/common';
import { AdminNotificationsController } from './admin-notifications.controller';
import { NotificationsCleanupCron } from './notifications-cleanup.cron';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController, AdminNotificationsController],
  providers: [NotificationsService, NotificationsCleanupCron],
  exports: [NotificationsService],
})
export class NotificationsModule {}

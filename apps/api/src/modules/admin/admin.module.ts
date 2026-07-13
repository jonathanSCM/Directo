import { Module } from '@nestjs/common';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminLogsController } from './admin-logs.controller';
import { AdminSupportController } from './admin-support.controller';
import { AdminService } from './admin.service';

@Module({
  controllers: [AdminDashboardController, AdminLogsController, AdminSupportController],
  providers: [AdminService],
})
export class AdminModule {}

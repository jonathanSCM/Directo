import { Module } from '@nestjs/common';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminLogsController } from './admin-logs.controller';
import { AdminService } from './admin.service';

@Module({
  controllers: [AdminDashboardController, AdminLogsController],
  providers: [AdminService],
})
export class AdminModule {}

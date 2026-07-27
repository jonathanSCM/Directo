import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, propertyId: string, dto: CreateReportDto) {
    const property = await this.prisma.properties.findUnique({
      where: { id: propertyId },
      select: { id: true, owner_id: true },
    });
    if (!property) throw new NotFoundException('Propiedad no encontrada');
    if (property.owner_id === userId) {
      throw new ForbiddenException('No puedes reportar tu propia propiedad');
    }

    const existing = await this.prisma.property_reports.findFirst({
      where: { property_id: propertyId, reporter_id: userId, status: 'pending' },
    });
    if (existing) {
      throw new BadRequestException(
        'Ya reportaste esta propiedad, tu reporte está pendiente de revisión',
      );
    }

    return this.prisma.property_reports.create({
      data: {
        property_id: propertyId,
        reporter_id: userId,
        reason: dto.reason,
        message: dto.message,
      },
    });
  }

  adminList(status?: string) {
    return this.prisma.property_reports.findMany({
      where: status ? { status: status as never } : {},
      include: {
        properties: { select: { id: true, title: true, slug: true, status: true } },
        users: { select: { id: true, name: true, email: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async resolve(id: string, adminId: string, status: 'reviewed' | 'dismissed') {
    const report = await this.prisma.property_reports.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Reporte no encontrado');
    return this.prisma.property_reports.update({
      where: { id },
      data: { status, reviewed_by: adminId, reviewed_at: new Date() },
    });
  }
}

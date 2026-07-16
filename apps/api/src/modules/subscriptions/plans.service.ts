import { Injectable, NotFoundException } from '@nestjs/common';
import { slugify, uniqueSlug } from '../../common/utils/slug.util';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  list(onlyActive = true) {
    return this.prisma.subscription_plans.findMany({
      where: onlyActive ? { is_active: true } : undefined,
      orderBy: { price: 'asc' },
    });
  }

  async create(dto: CreatePlanDto) {
    const base = slugify(dto.name) || 'plan';
    const exists = await this.prisma.subscription_plans.findUnique({
      where: { slug: base },
    });
    const slug = exists ? uniqueSlug(dto.name, 'plan') : base;

    return this.prisma.subscription_plans.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        price: dto.price,
        currency: dto.currency ?? 'USD',
        duration_days: dto.duration_days,
        included_properties: dto.included_properties ?? 1,
        extra_property_price: dto.extra_property_price ?? 0,
        allows_featured: dto.allows_featured ?? false,
        includes_statistics: dto.includes_statistics ?? false,
        priority_in_results: dto.priority_in_results ?? false,
        publication_duration_days: dto.publication_duration_days,
        is_active: dto.is_active ?? true,
      },
    });
  }

  async update(id: string, dto: UpdatePlanDto) {
    await this.findOrThrow(id);
    return this.prisma.subscription_plans.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        currency: dto.currency,
        duration_days: dto.duration_days,
        included_properties: dto.included_properties,
        extra_property_price: dto.extra_property_price,
        allows_featured: dto.allows_featured,
        includes_statistics: dto.includes_statistics,
        priority_in_results: dto.priority_in_results,
        publication_duration_days: dto.publication_duration_days,
        is_active: dto.is_active,
      },
    });
  }

  async remove(id: string) {
    await this.findOrThrow(id);
    const refs = await this.prisma.subscriptions.count({
      where: { plan_id: id },
    });
    if (refs > 0) {
      // No se puede borrar un plan con suscripciones (FK RESTRICT): se desactiva.
      await this.prisma.subscription_plans.update({
        where: { id },
        data: { is_active: false },
      });
      return { message: 'Plan desactivado (tiene suscripciones asociadas)' };
    }
    await this.prisma.subscription_plans.delete({ where: { id } });
    return { message: 'Plan eliminado' };
  }

  private async findOrThrow(id: string) {
    const plan = await this.prisma.subscription_plans.findUnique({
      where: { id },
    });
    if (!plan) {
      throw new NotFoundException('Plan no encontrado');
    }
    return plan;
  }
}

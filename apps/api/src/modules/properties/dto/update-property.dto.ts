import { PartialType } from '@nestjs/swagger';
import { CreatePropertyDto } from './create-property.dto';

/** Todos los campos opcionales para edición parcial (§6.1). */
export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {}

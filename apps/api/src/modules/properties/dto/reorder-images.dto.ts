import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class ReorderImagesDto {
  @ApiProperty({
    type: [String],
    description: 'IDs de las imágenes en el nuevo orden deseado.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  imageIds: string[];
}

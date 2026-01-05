import { ApiProperty } from '@nestjs/swagger';

export class UploadAvatarResponseDto {
  @ApiProperty({ description: 'Indica si la operación fue exitosa' })
  success: boolean;

  @ApiProperty({ description: 'URL del avatar principal (tamaño medio)' })
  avatarUrl: string;

  @ApiProperty({ description: 'URL del thumbnail (tamaño pequeño)' })
  thumbnailUrl: string;

  @ApiProperty({
    description: 'URLs de todos los tamaños disponibles',
    example: {
      thumbnail: 'https://...',
      small: 'https://...',
      medium: 'https://...',
      large: 'https://...',
    },
  })
  sizes: Record<string, string>;
}
























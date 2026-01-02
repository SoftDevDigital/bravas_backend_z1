import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { AvatarController } from '../avatar.controller';
import { AvatarService } from '../../services/avatar.service';
import { UserService } from '../../user.service';
import { getUserFromToken } from '../../helpers/auth.helper';

// Mock getUserFromToken
jest.mock('../../helpers/auth.helper', () => ({
  getUserFromToken: jest.fn(),
}));

describe('AvatarController', () => {
  let controller: AvatarController;
  let avatarService: AvatarService;
  let userService: UserService;

  const mockFile = {
    buffer: Buffer.from('mock-image-data'),
    mimetype: 'image/jpeg',
    size: 1024 * 1024, // 1MB
    originalname: 'test.jpg',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AvatarController],
      providers: [
        {
          provide: AvatarService,
          useValue: {
            uploadAvatar: jest.fn(),
            deleteAvatar: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            updateMyProfile: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AvatarController>(AvatarController);
    avatarService = module.get<AvatarService>(AvatarService);
    userService = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadAvatar', () => {
    it('should upload avatar successfully', async () => {
      (getUserFromToken as jest.Mock).mockResolvedValue({
        userId: 'user123',
        email: 'test@example.com',
      });

      const mockResult = {
        success: true,
        avatarUrl: 'https://s3.amazonaws.com/avatar.jpg',
        thumbnailUrl: 'https://s3.amazonaws.com/thumbnail.jpg',
        sizes: {
          thumbnail: 'https://s3.amazonaws.com/thumbnail.jpg',
          small: 'https://s3.amazonaws.com/small.jpg',
          medium: 'https://s3.amazonaws.com/medium.jpg',
          large: 'https://s3.amazonaws.com/large.jpg',
        },
      };

      (avatarService.uploadAvatar as jest.Mock).mockResolvedValue(mockResult);
      (userService.updateMyProfile as jest.Mock).mockResolvedValue({
        success: true,
        data: { avatarUrl: mockResult.avatarUrl },
      });

      const req = { token: 'mock-token' };
      const result = await controller.uploadAvatar(req as any, mockFile);

      expect(result).toEqual(mockResult);
      expect(avatarService.uploadAvatar).toHaveBeenCalledWith('user123', mockFile);
    });

    it('should throw BadRequestException if file is missing', async () => {
      const req = { token: 'mock-token' };
      
      await expect(controller.uploadAvatar(req as any, null as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('deleteAvatar', () => {
    it('should delete avatar successfully', async () => {
      (getUserFromToken as jest.Mock).mockResolvedValue({
        userId: 'user123',
        email: 'test@example.com',
      });

      (avatarService.deleteAvatar as jest.Mock).mockResolvedValue(undefined);
      (userService.updateMyProfile as jest.Mock).mockResolvedValue({
        success: true,
      });

      const req = { token: 'mock-token' };
      await controller.deleteAvatar(req as any);

      expect(avatarService.deleteAvatar).toHaveBeenCalledWith('user123');
    });
  });
});


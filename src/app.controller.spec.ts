import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return message and pod name', () => {
      const result = appController.getHello();
      expect(result.message).toBe('Hello World!');
      expect(result.pod).toBeDefined();
    });
  });

  describe('health', () => {
    it('should return status ok and pod name', () => {
      const result = appController.getHealth();
      expect(result.status).toBe('ok');
      expect(result.pod).toBeDefined();
    });
  });

  describe('greeting', () => {
    it('should return greeting message with name and pod', () => {
      const result = appController.getGreeting('John');
      expect(result.message).toBe('Hello, John!');
      expect(result.pod).toBeDefined();
    });
  });
});

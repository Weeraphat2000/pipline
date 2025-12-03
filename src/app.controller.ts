import { Controller, Get, Param } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    console.log('hellowwwwww');
    return this.appService.getHello();
  }

  @Get(':name')
  getGreeting(@Param('name') name: string): string {
    console.log(`Greeting requested for: ${name}`);
    return `Hello, ${name}!`;
  }
}

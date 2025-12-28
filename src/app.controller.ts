import { Controller, Get, Param } from '@nestjs/common';
import { AppService } from './app.service';
import * as os from 'os';

@Controller()
export class AppController {
  private readonly podName: string;

  constructor(private readonly appService: AppService) {
    this.podName = process.env.HOSTNAME || os.hostname();
  }

  @Get()
  getHello(): { message: string; pod: string } {
    console.log(`Request handled by pod: ${this.podName}`);
    console.log('update 1.1');
    return {
      message: this.appService.getHello(),
      pod: this.podName,
    };
  }

  @Get('health')
  getHealth(): { status: string; pod: string } {
    return {
      status: 'ok',
      pod: this.podName,
    };
  }

  @Get(':name')
  getGreeting(@Param('name') name: string): { message: string; pod: string } {
    console.log(
      `Greeting requested for: ${name} - handled by pod: ${this.podName}`,
    );
    return {
      message: `Hello, ${name}! Welcome back!`,
      pod: this.podName,
    };
  }
}

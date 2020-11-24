import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { UserEntity } from './user.entity';
import { AuthGuard } from '@nestjs/passport';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {
    this.userService = userService;
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async list(): Promise<Array<UserEntity>> {
    return this.userService.listAll();
  }
}

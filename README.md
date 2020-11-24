> 功能说明：
> 1. client端使用用户名和用户密码登录，登录成功后server端发送JWT；
> 2. client在header中携带JWT访问server，server端对client端携带的JWT进行认证；

# 初始化项目

创建项目并初始化User，Auth模块，terminal执行：
```
 # 新建nestjs工程: auth-jwt
 nest new auth-jwt
 # 初始化UserModule，AuthModule
 cd auth-jwt
 nest g module auth
 nest g service auth
 nest g controller auth
 
 nest g module user
 nest g service user
 nest g controller user
 ```
 
 工程结构：
 ```
├── nest-cli.json
├── package.json
├── package-lock.json
├── README.md
├── src
│   ├── app.controller.spec.ts
│   ├── app.controller.ts
│   ├── app.module.ts
│   ├── app.service.ts
│   ├── auth
│   │   ├── auth.controller.spec.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.module.ts
│   │   └── auth.service.ts
│   ├── main.ts
│   └── user
│       ├── user.controller.ts
│       ├── user.module.ts
│       └── user.service.ts
├── test
│   ├── app.e2e-spec.ts
│   └── jest-e2e.json
├── tsconfig.build.json
└── tsconfig.json
```
# User Module
1. 通过用户名获取用户；
2. 获取用户列表；
3. 导出 User Service以便Auth Service引用；

*user.entity.ts*：
```typescript
export interface UserEntity {
  id: number;
  username: string;
  password?: string;
}
```

*user.service.ts*：
```typescripy
import { Injectable } from '@nestjs/common';
import { UserEntity } from './user.entity';

@Injectable()
export class UserService {
  private readonly users: Array<UserEntity>;

  constructor() {
    this.users = [
      { id: 1, username: 'admin', password: 'admin' },
      { id: 2, username: 'tester', password: 'tester' },
    ];
  }

  /**
   * find user by username
   * @param username
   */
  async find(username: string): Promise<UserEntity> {
    const user = this.users.find((user) => user.username === username);
    if (user) return user;
    else return null;
  }

  /**
   * list all users
   */
  async listAll(): Promise<Array<UserEntity>> {
    return this.users.map((user) => {
      const { password, ...info } = user;
      return info;
    });
  }
}
```

*user.controller.ts*：
```typescript
import { Controller, Get } from '@nestjs/common';
import { UserService } from './user.service';
import { UserEntity } from './user.entity';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {
    this.userService = userService;
  }

  @Get()
  async list(): Promise<Array<UserEntity>> {
    return this.userService.listAll();
  }
}
```

User Module中导出UserService，*user.module.ts*
```typescript
import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';

@Module({
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
```

# Auth Module，实现用户登录
安装登录认证所需依赖passport, passport-local, @nestjs/passport, @types/passport-local, terminal中执行：
```bash
npm i passport passport-local @nestjs/passport
npm i @types/passport-local -D
```

## 账户、密码认证策略实现
### AuthService实现用户身份认证
*auth.service.ts*，用户名密码验证：

```typescript
import { Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { UserEntity } from '../user/user.entity';

@Injectable()
export class AuthService {
  constructor(private readonly userService: UserService) {
    this.userService = userService;
  }

  /**
   * validate user name and password
   * @param username
   * @param password
   */
  async validate(username: string, password: string): Promise<UserEntity> {
    const user = await this.userService.find(username);
    // 注：实际中的密码处理应通过加密措施
    if (user && user.password === password) {
      const { password, ...userInfo } = user;
      return userInfo;
    } else {
      return null;
    }
  }
}
```
### LocalStrategy，实现账户、密码认证策略。
auth目录下新建*local.strategy.ts*：
```typescript
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserEntity } from '../user/user.entity';
import { AuthService } from './auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super();
    this.authService = authService;
  }

  async validate(username: string, password: string): Promise<UserEntity> {
    const user = await this.authService.validate(username, password);
    if (user) return user;
    else throw new UnauthorizedException('incorrect username or password');
  }
}
```

validate方法为默认的用户身份认证的实现，passport-local守卫将自动调用。

### 用户登录API
AuthController中实现login API，使用passport-local守卫。
*auth.controller.ts*：
```typescript
import { Controller, Post, Request, UseGuards } from '@nestjs/common';
import { UserEntity } from '../user/user.entity';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  @UseGuards(AuthGuard('local'))
  @Post('/login')
  async login(@Request() request): Promise<UserEntity> {
    return request.user;
  }
}
```

`@UseGuards(AuthGuard('local'))`守卫将从body中提取username、password，然后调用LocalStrategy中的validate方法，若认证通过，则将User信息赋值给request.user。

*auth.module.ts*：
```typescript
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { UserModule } from '../user/user.module';
import { LocalStrategy } from './local.strategy';

@Module({
  imports: [UserModule, PassportModule],
  providers: [AuthService, LocalStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
```

`npm run start`启动服务，使用POST请求访问`http://127.0.0.1:3000/auth/login`，若用户名、密码正确，则获得用户信息，否则response code为401。curl命令如下： 
```bash
curl -X POST http://127.0.0.1:3000/auth/login -d '{"username": "admin", "password": "123456"}' -H "Content-Type: application/json"

{"statusCode":401,"message":"incorrect username or password","error":"Unauthorized"}
```

# JWT Strategy实现
至此，使用Local Strategy用户认证守卫完成了用户登录功能.现在我们来实现：
1. 当用户登录成功后下发access_token；
2. User List服务使用jwt认证。

## 安装依赖
terminal执行：
> npm i passport-jwt @nestjs/jwt
> npm i @types/passport-jwt -D

## 重写login，登录成功下发access_token
*auth.service.ts*添加login方法：
```typescript
import { Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { UserEntity } from '../user/user.entity';
import { JwtService } from '@nestjs/jwt';
import { TokenEntity } from './token.entity';

@Injectable()
export class AuthService {
  private readonly userService: UserService;
  private readonly jwtService: JwtService;
  constructor(userService: UserService, jwtService: JwtService) {
    this.userService = userService;
    this.jwtService = jwtService;
  }

  /**
   * validate user name and password
   * @param username
   * @param password
   */
  async validate(username: string, password: string): Promise<UserEntity> {
    const user = await this.userService.find(username);
    // 注：实际中的密码处理应通过加密措施
    if (user && user.password === password) {
      const { password, ...userInfo } = user;
      return userInfo;
    } else {
      return null;
    }
  }

  /**
   * user login
   * @param user
   */
  async login(user: UserEntity): Promise<TokenEntity> {
    const { id, username } = user;
    return {
      token: this.jwtService.sign({ username, sub: id }),
    };
  }
}

```

*auth.controller.ts*：
```typescript
import { Controller, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { TokenEntity } from './token.entity';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {
    this.authService = authService;
  }
  @UseGuards(AuthGuard('local'))
  @Post('/login')
  async login(@Request() request): Promise<TokenEntity> {
    return this.authService.login(request.user);
  }
}

```

## AuthModule 中注册 JwtModule
auth目录下新建*jwt.contants.ts*：
```typescript
export const jwtContants = {
  secret: 'json_web_token_secret_key',
};
```

注册JwtModule，*auth.module.ts*：
```typescript
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { UserModule } from '../user/user.module';
import { LocalStrategy } from './local.strategy';
import { JwtModule } from '@nestjs/jwt';
import { jwtContants } from './jwt.contants';

@Module({
  imports: [
    UserModule,
    PassportModule,
    JwtModule.register({
      secret: jwtContants.secret,
    }),
  ],
  providers: [AuthService, LocalStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
```

启动服务，访问登录服务，认证通过后将返回token：
```
curl -X POST http://127.0.0.1:3000/auth/login -d '{"username": "admin", "password": "admin"}' -H "Content-Type: application/json"
{"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwic3ViIjoxLCJpYXQiOjE2MDYxNDQwMjF9.IIOMnGgjMmaqVB4RhNGBxS_rEKuSLsr40yG_ooTuFVU"}
```

## JWT access_token认证
auth下新建*jwt.strategy.ts*：
```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { jwtContants } from './jwt.contants';
import { UserEntity } from '../user/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // 获取请求header token值
      jwtFromRequest: ExtractJwt.fromHeader('token'),
      secretOrKey: jwtContants.secret,
    });
  }

  async validate(payload: any): Promise<UserEntity> {
    //payload：jwt-passport认证jwt通过后解码的结果
    return { username: payload.username, id: payload.sub };
  }
}
```

*auth.module.ts*：
```typescript
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { UserModule } from '../user/user.module';
import { LocalStrategy } from './local.strategy';
import { JwtModule } from '@nestjs/jwt';
import { jwtContants } from './jwt.contants';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    UserModule,
    PassportModule,
    JwtModule.register({
      secret: jwtContants.secret,
    }),
  ],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
```

*user.controller.ts* 添加jwt认证守卫：
```typescript
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
```

启动服务，访问http://127.0.0.1:3000/user，token认证通过将获得用户列表：
```
curl http://127.0.0.1:3000/user -H "token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwic3ViIjoxLCJpYXQiOjE2MDYxODA4MjR9.y9xt_rn6nORS5MEU18MeNB0brnGHvZLxe7sAYNkz0KY"
## 返回
[{"id":1,"username":"admin"},{"id":2,"username":"tester"}]
```

> 1. demo工程源码 https://github.com/louie-001/nestjs-auth-jwt.git；
> 2. NestJS 官方https://nestjs.com/。

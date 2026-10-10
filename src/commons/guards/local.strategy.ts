import { Injectable } from "@nestjs/common";
import { Strategy } from "passport-local";
import { PassportStrategy } from "@nestjs/passport";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "src/modules/users/entities/user.entity";
import { Repository } from "typeorm";
import { ForBiddenException, UnAuthorizedException } from "commons/error";
import * as bcrypt from "bcrypt";

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({ usernameField: "email" });
  }

  async validate(email: string, password: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { email: email.trim().toLowerCase() },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        passwordHash: true,
      },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnAuthorizedException("Email hoặc mật khẩu không đúng");
    }
    if (!user.isActive) {
      throw new ForBiddenException("Tài khoản đã bị khoá");
    }
    return user;
  }
}

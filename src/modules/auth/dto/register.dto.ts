import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsString,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";
import { CreateUserDto } from "src/modules/users/dto/create-user.dto";

@ValidatorConstraint({ name: "matchPassword", async: false })
class MatchPasswordConstraint implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments): boolean {
    const body = args.object as { password?: string };
    return value === body.password;
  }

  defaultMessage(): string {
    return "Mật khẩu nhập lại không khớp";
  }
}

export class RegisterDto extends CreateUserDto {
  @ApiProperty({
    example: "Matkhau123",
    description: "Nhập lại mật khẩu, phải giống password",
  })
  @IsString({ message: "Nhập lại mật khẩu phải là chuỗi" })
  @IsNotEmpty({ message: "Vui lòng nhập lại mật khẩu" })
  @Validate(MatchPasswordConstraint)
  confirmPassword: string;
}

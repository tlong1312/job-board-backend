import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "candidate@jobboard.local" })
  @IsEmail({}, { message: "Email không hợp lệ" })
  email: string;

  @ApiProperty({ example: "Password@123" })
  @IsString()
  @IsNotEmpty({ message: "Mật khẩu không được để trống" })
  password: string;
}

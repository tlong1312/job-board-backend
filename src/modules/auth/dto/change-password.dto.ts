import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class ChangePasswordDto {
  @ApiProperty({ description: "Mật khẩu hiện tại" })
  @IsString()
  @IsNotEmpty({ message: "Mật khẩu hiện tại không được để trống" })
  currentPassword: string;

  @ApiProperty({
    example: "Matkhaumoi123",
    description: "Tối thiểu 8 ký tự, có cả chữ và số",
  })
  @IsString({ message: "Mật khẩu mới phải là chuỗi" })
  @MinLength(8, { message: "Mật khẩu tối thiểu 8 ký tự" })
  @MaxLength(64, { message: "Mật khẩu tối đa 64 ký tự" })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: "Mật khẩu phải có cả chữ và số",
  })
  newPassword: string;
}

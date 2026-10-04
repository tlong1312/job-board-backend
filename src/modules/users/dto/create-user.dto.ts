import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateUserDto {
  @ApiProperty({
    example: "nguyenvana@gmail.com",
    description: "Email đăng nhập, không được trùng",
    maxLength: 255,
  })
  @IsEmail({}, { message: "Email không hợp lệ" })
  @MaxLength(255, { message: "Email tối đa 255 ký tự" })
  email: string;

  @ApiProperty({
    example: "Matkhau123",
    description: "Tối thiểu 8 ký tự, có cả chữ và số",
    minLength: 8,
    maxLength: 64,
  })
  @IsString({ message: "Mật khẩu phải là chuỗi" })
  @MinLength(8, { message: "Mật khẩu tối thiểu 8 ký tự" })
  @MaxLength(64, { message: "Mật khẩu tối đa 64 ký tự" })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: "Mật khẩu phải có cả chữ và số",
  })
  password: string;

  @ApiProperty({
    example: "Nguyễn Văn A",
    description: "Họ và tên",
    maxLength: 150,
  })
  @IsString()
  @IsNotEmpty({ message: "Họ tên không được để trống" })
  @MaxLength(150, { message: "Họ tên tối đa 150 ký tự" })
  fullName: string;

  @ApiPropertyOptional({
    example: "0901234567",
    description: "Số điện thoại Việt Nam (0xxxxxxxxx hoặc +84xxxxxxxxx)",
  })
  @IsOptional()
  @Matches(/^(0|\+84)\d{9}$/, { message: "Số điện thoại không hợp lệ" })
  phone?: string;

  @ApiPropertyOptional({
    enum: ["candidate", "employer"],
    default: "candidate",
    description: "Vai trò. Admin không tạo qua API này.",
  })
  @IsOptional()
  @IsIn(["candidate", "employer"], {
    message: "Vai trò chỉ được là candidate hoặc employer",
  })
  role?: "candidate" | "employer";
}

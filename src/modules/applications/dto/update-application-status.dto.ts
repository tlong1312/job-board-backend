import {
  ApiProperty,
  ApiPropertyOptional,
} from "@nestjs/swagger";

import {
  IsIn,
  IsOptional,
  IsString,
} from "class-validator";

export class UpdateApplicationStatusDto {
  @ApiProperty({
    example: "viewed",
    enum: ["viewed", "interview", "rejected"],
    description: "Trạng thái mới của hồ sơ ứng tuyển",
  })
  @IsIn(["viewed", "interview", "rejected"])
  status: string;

  @ApiPropertyOptional({
    example: "Hồ sơ phù hợp, chuyển sang vòng phỏng vấn",
    description: "Ghi chú của nhà tuyển dụng",
  })
  @IsOptional()
  @IsString()
  note?: string;
}
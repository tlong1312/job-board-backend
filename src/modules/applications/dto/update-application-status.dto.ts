import {
  IsIn,
  IsOptional,
  IsString,
} from "class-validator";

export class UpdateApplicationStatusDto {
  @IsIn(["viewed", "interview", "rejected"])
  status: string;

  @IsOptional()
  @IsString()
  note?: string;
}
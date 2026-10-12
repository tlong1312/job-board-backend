import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class UpdateApplicationStatusDto {
  @IsIn(["viewed", "interview", "rejected"])
  status: string;

  @IsInt()
  @Min(1)
  changedBy: number;

  @IsOptional()
  @IsString()
  note?: string;
}
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class CreateApplicationDto {
  @IsInt()
  @Min(1)
  jobId: number;

  @IsInt()
  @Min(1)
  candidateId: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  resumeId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  coverLetter?: string;
}
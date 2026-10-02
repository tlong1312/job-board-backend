import { IsInt, IsNotEmpty, IsString, Min } from "class-validator";

export class CreateApplicationDto {
  @IsInt()
  @Min(1)
  jobId: number;

  @IsString()
  @IsNotEmpty()
  candidateName: string;
}

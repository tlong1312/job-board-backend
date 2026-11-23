import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { SEARCH_MODES, SearchMode } from "./ai-search.service";

export class SearchQueryDto {
  @ApiProperty({ example: "việc làm cho người mới ra trường muốn làm backend" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  q: string;

  @ApiPropertyOptional({ enum: SEARCH_MODES, default: "hybrid" })
  @IsOptional()
  @IsIn(SEARCH_MODES)
  mode?: SearchMode;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

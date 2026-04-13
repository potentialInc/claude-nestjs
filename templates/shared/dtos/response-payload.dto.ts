import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ErrorDetailDto {
    @ApiProperty({
        example: 'email',
        description: 'Field name related to the error (if applicable)',
    })
    field?: string;

    @ApiProperty({
        example: 'Invalid format',
        description: 'Human readable reason for the error',
    })
    reason?: string;

    @ApiPropertyOptional({
        example: { minLength: 'Must be at least 8 characters' },
        description: 'Constraint keys and messages (from class-validator)',
    })
    constraints?: Record<string, string>;

    @ApiPropertyOptional({
        example: 'INVALID_EMAIL',
        description: 'Machine-friendly error code',
    })
    code?: string;
}

export class ResponsePayloadDto<T = unknown> {
    @ApiProperty({ example: true, description: 'Request success indicator' })
    success: boolean;

    @ApiProperty({ example: 200, description: 'HTTP status code' })
    statusCode: number;

    @ApiProperty({ example: 'Operation completed successfully' })
    message: string;

    @ApiPropertyOptional({ description: 'Response data' })
    data?: T;

    @ApiPropertyOptional({
        description: 'Error details (only on error responses)',
        type: [ErrorDetailDto],
    })
    error?: ErrorDetailDto[];

    @ApiPropertyOptional({ example: '2024-11-02T10:30:00.000Z' })
    timestamp?: string;

    @ApiPropertyOptional({ example: '/api/v1/users' })
    path?: string;

    constructor(partial: Partial<ResponsePayloadDto<T>>) {
        Object.assign(this, partial);
        this.timestamp = this.timestamp || new Date().toISOString();
    }
}

export class SuccessResponseDto<T = unknown> extends ResponsePayloadDto<T> {
    constructor(
        data: T,
        message: string = 'Success',
        statusCode: number = 200,
    ) {
        super({
            success: true,
            statusCode,
            message,
            data,
            timestamp: new Date().toISOString(),
        });
    }
}

export class ErrorResponseDto extends ResponsePayloadDto {
    constructor(
        message: string,
        statusCode: number = 500,
        error?: ErrorDetailDto[],
        path?: string,
    ) {
        super({
            success: false,
            statusCode,
            message,
            error,
            path,
            timestamp: new Date().toISOString(),
        });
    }
}

export class PaginationMetaDto {
    @ApiProperty({ example: 1 })
    page: number;

    @ApiProperty({ example: 10 })
    limit: number;

    @ApiProperty({ example: 100 })
    total: number;

    @ApiProperty({ example: 10 })
    totalPages: number;

    @ApiProperty({ example: true })
    hasNextPage: boolean;

    @ApiProperty({ example: false })
    hasPreviousPage: boolean;

    constructor(page: number, limit: number, total: number) {
        this.page = page;
        this.limit = limit;
        this.total = total;
        this.totalPages = Math.ceil(total / limit);
        this.hasNextPage = page < this.totalPages;
        this.hasPreviousPage = page > 1;
    }
}

export class PaginatedResponseDto<T = unknown> extends ResponsePayloadDto<T[]> {
    @ApiProperty({ description: 'Pagination metadata' })
    meta: PaginationMetaDto;

    constructor(
        data: T[],
        page: number,
        limit: number,
        total: number,
        message: string = 'Data retrieved successfully',
    ) {
        super({
            success: true,
            statusCode: 200,
            message,
            data,
            timestamp: new Date().toISOString(),
        });
        this.meta = new PaginationMetaDto(page, limit, total);
    }
}

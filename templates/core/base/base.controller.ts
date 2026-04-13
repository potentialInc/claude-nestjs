import {
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    HttpCode,
    HttpStatus,
    ParseUUIDPipe,
} from '@nestjs/common';
import {
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiQuery,
} from '@nestjs/swagger';
import { BaseService } from './base.service';
import { BaseEntity } from './base.entity';
import { DeepPartial } from 'typeorm';

export abstract class BaseController<
    T extends BaseEntity,
    CreateDto extends DeepPartial<T> = DeepPartial<T>,
    UpdateDto extends DeepPartial<T> = DeepPartial<T>,
> {
    constructor(protected readonly service: BaseService<T>) {}

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a new resource' })
    @ApiResponse({ status: 201, description: 'Resource created successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    async create(@Body() createDto: CreateDto): Promise<T> {
        return this.service.create(createDto);
    }

    @Get()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get all resources' })
    @ApiResponse({ status: 200, description: 'Resources retrieved successfully' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async findAll(
        @Query('page') page?: number,
        @Query('limit') limit?: number,
    ): Promise<T[]> {
        const options =
            page && limit ? { skip: (page - 1) * limit, take: limit } : {};
        return this.service.findAll(options);
    }

    @Get(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get a resource by ID' })
    @ApiParam({ name: 'id', type: String, description: 'Resource UUID' })
    @ApiResponse({ status: 200, description: 'Resource retrieved successfully' })
    @ApiResponse({ status: 404, description: 'Resource not found' })
    async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<T> {
        return this.service.findByIdOrFail(id);
    }

    @Patch(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Update a resource' })
    @ApiParam({ name: 'id', type: String, description: 'Resource UUID' })
    @ApiResponse({ status: 200, description: 'Resource updated successfully' })
    @ApiResponse({ status: 404, description: 'Resource not found' })
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateDto: UpdateDto,
    ): Promise<T | null> {
        return this.service.update(id, updateDto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Delete a resource' })
    @ApiParam({ name: 'id', type: String, description: 'Resource UUID' })
    @ApiResponse({ status: 200, description: 'Resource deleted successfully' })
    @ApiResponse({ status: 404, description: 'Resource not found' })
    async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
        return this.service.remove(id);
    }
}

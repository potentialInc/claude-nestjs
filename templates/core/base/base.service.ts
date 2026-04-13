import { NotFoundException } from '@nestjs/common';
import { FindManyOptions, DeepPartial, FindOptionsRelations } from 'typeorm';
import { BaseRepository } from './base.repository';
import { BaseEntity } from './base.entity';

export abstract class BaseService<T extends BaseEntity> {
    constructor(
        protected readonly repository: BaseRepository<T>,
        protected readonly entityName: string,
    ) {}

    protected defaultRelations?: FindOptionsRelations<T>;

    async findByIdOrFail(
        id: string,
        relations?: FindOptionsRelations<T>,
    ): Promise<T> {
        const entity = await this.repository.findById(
            id,
            relations || this.defaultRelations,
        );
        if (!entity) {
            throw new NotFoundException(
                `${this.entityName} with ID ${id} not found`,
            );
        }
        return entity;
    }

    async findAll(options?: FindManyOptions<T>): Promise<T[]> {
        return this.repository.findAll({
            ...options,
            relations:
                (options?.relations as FindOptionsRelations<T>) ||
                this.defaultRelations,
        });
    }

    async create(data: DeepPartial<T>): Promise<T> {
        return this.repository.create(data);
    }

    async update(id: string, data: DeepPartial<T>): Promise<T | null> {
        await this.findByIdOrFail(id);
        return this.repository.update(id, data);
    }

    async remove(id: string): Promise<void> {
        await this.findByIdOrFail(id);
        await this.repository.softDelete(id);
    }

    async delete(id: string): Promise<void> {
        await this.findByIdOrFail(id);
        await this.repository.delete(id);
    }
}

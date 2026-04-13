import {
    Repository,
    FindManyOptions,
    FindOneOptions,
    DeepPartial,
    FindOptionsRelations,
    QueryDeepPartialEntity,
} from 'typeorm';
import { BaseEntity } from './base.entity';

export abstract class BaseRepository<T extends BaseEntity> {
    constructor(protected readonly repository: Repository<T>) {}

    async findAll(options?: FindManyOptions<T>): Promise<T[]> {
        return this.repository.find(options);
    }

    async findById(
        id: string,
        relations?: FindOptionsRelations<T>,
    ): Promise<T | null> {
        return this.repository.findOne({
            where: { id } as unknown as FindOneOptions<T>['where'],
            relations,
        });
    }

    async findOne(options: FindOneOptions<T>): Promise<T | null> {
        return this.repository.findOne(options);
    }

    async create(data: DeepPartial<T>): Promise<T> {
        const entity = this.repository.create(data);
        return this.repository.save(entity);
    }

    async update(id: string, data: DeepPartial<T>): Promise<T | null> {
        await this.repository.update(id, data as QueryDeepPartialEntity<T>);
        return this.findById(id);
    }

    async softDelete(id: string): Promise<void> {
        await this.repository.softDelete(id);
    }

    async delete(id: string): Promise<void> {
        await this.repository.delete(id);
    }

    async count(options?: FindManyOptions<T>): Promise<number> {
        return this.repository.count(options);
    }
}

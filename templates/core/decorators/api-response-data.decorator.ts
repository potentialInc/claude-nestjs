import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ResponsePayloadDto } from '../../shared/dtos';

export function ApiResponseData<T extends Type<any>>(
    dto: T,
    status = 200,
    isArray = false,
) {
    return applyDecorators(
        ApiExtraModels(ResponsePayloadDto, dto),
        ApiResponse({
            status,
            description: 'Successful response',
            schema: {
                allOf: [
                    { $ref: getSchemaPath(ResponsePayloadDto) },
                    {
                        properties: {
                            data: isArray
                                ? {
                                      type: 'array',
                                      items: { $ref: getSchemaPath(dto) },
                                  }
                                : { $ref: getSchemaPath(dto) },
                        },
                    },
                ],
            },
        }),
    );
}

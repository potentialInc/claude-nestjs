import { applyDecorators, Type } from "@nestjs/common";
import {
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiExtraModels,
  ApiParam,
  ApiQuery,
  getSchemaPath,
} from "@nestjs/swagger";
import { ResponsePayloadDto, ErrorDetailDto } from "../../shared/dtos";
import { ApiResponseData } from "./api-response-data.decorator";

export interface ErrorResponseConfig {
  status: number;
  description?: string;
}

export type ApiOperationType =
  | "create"
  | "getAll"
  | "getOne"
  | "update"
  | "delete"
  | "search"
  | "count"
  | "custom";

export interface ApiSwaggerOptions {
  /** Resource name (e.g., 'User', 'Product') */
  resourceName: string;
  /** Request body DTO */
  requestDto?: Type<any>;
  /** Response data DTO (used in ResponsePayloadDto.data) */
  responseDto?: Type<any>;
  /** HTTP success status code (default: 200) */
  successStatus?: number;
  /** If true, response data is an array */
  isArray?: boolean;
  /** Whether endpoint requires bearer auth (default: true) */
  requiresAuth?: boolean;
  /** Array of error responses to document */
  errors?: ErrorResponseConfig[];
  /** Operation type for auto-generating summary and common errors */
  operation?: ApiOperationType;
  /** Custom operation summary (overrides auto-generated) */
  summary?: string;
  /** ID parameter name for getOne/update/delete (default: 'id') */
  paramName?: string;
  /** Add pagination query params for getAll (default: false) */
  withPagination?: boolean;
}

export function ApiSwagger(options: ApiSwaggerOptions) {
  const config: Required<
    Pick<
      ApiSwaggerOptions,
      | "successStatus"
      | "isArray"
      | "requiresAuth"
      | "withPagination"
      | "paramName"
      | "operation"
    >
  > &
    ApiSwaggerOptions = {
    successStatus: 200,
    isArray: false,
    requiresAuth: true,
    withPagination: false,
    paramName: "id",
    operation: "custom",
    ...options,
  };

  const decorators: Array<
    ClassDecorator | MethodDecorator | PropertyDecorator
  > = [];

  decorators.push(ApiExtraModels(ResponsePayloadDto, ErrorDetailDto));

  // Auto-generate summary from operation type
  let summary = config.summary;
  if (!summary && config.operation) {
    const resourceLower = config.resourceName.toLowerCase();
    switch (config.operation) {
      case "create":
        summary = `Create a new ${resourceLower}`;
        break;
      case "getAll":
        summary = `Get all ${resourceLower}`;
        break;
      case "getOne":
        summary = `Get ${resourceLower} by ${config.paramName}`;
        break;
      case "update":
        summary = `Update ${resourceLower}`;
        break;
      case "delete":
        summary = `Delete ${resourceLower}`;
        break;
      case "search":
        summary = `Search ${resourceLower}`;
        break;
      case "count":
        summary = `Count ${resourceLower}`;
        break;
      default:
        summary = config.resourceName;
    }
  }

  decorators.push(ApiOperation({ summary }));

  // Add param decorator for single-resource operations
  if (["getOne", "update", "delete"].includes(config.operation)) {
    decorators.push(
      ApiParam({
        name: config.paramName,
        type: String,
        format: "uuid",
        description: `${config.resourceName} ${config.paramName}`,
      }),
    );
  }

  // Add pagination query params
  if (config.operation === "getAll" && config.withPagination) {
    decorators.push(
      ApiQuery({ name: "page", required: false, type: Number, example: 1 }),
      ApiQuery({ name: "limit", required: false, type: Number, example: 10 }),
      ApiQuery({ name: "search", required: false, type: String }),
      ApiQuery({
        name: "sortBy",
        required: false,
        type: String,
        example: "createdAt",
      }),
      ApiQuery({
        name: "sortOrder",
        required: false,
        enum: ["ASC", "DESC"],
        example: "DESC",
      }),
    );
  }

  // Auth decorators
  if (config.requiresAuth) {
    decorators.push(ApiBearerAuth());
    // TODO: CUSTOMIZE — Match this to your AUTH_TOKEN_COOKIE_NAME env var
    decorators.push(ApiCookieAuth("access_token"));
    decorators.push(
      ApiResponse({
        status: 401,
        description: "Unauthorized - Invalid or missing authentication token",
        schema: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            statusCode: { type: "number", example: 401 },
            message: { type: "string", example: "Unauthorized" },
            data: { type: "null", nullable: true, example: null },
            error: {
              type: "array",
              items: { $ref: getSchemaPath(ErrorDetailDto) },
            },
          },
        },
      }),
    );
  }

  if (config.requestDto) {
    decorators.push(ApiBody({ type: config.requestDto }));
  }

  // Success response
  if (config.responseDto) {
    decorators.push(
      ApiResponseData(
        config.responseDto,
        config.successStatus,
        config.isArray,
      ) as any,
    );
  } else {
    decorators.push(
      ApiResponse({
        status: config.successStatus,
        description: "Successful response",
        schema: { $ref: getSchemaPath(ResponsePayloadDto) },
      }),
    );
  }

  // Auto-generate common error responses based on operation
  const autoErrors: ErrorResponseConfig[] = [];
  if (config.operation === "create") {
    autoErrors.push(
      { status: 400, description: "Validation failed" },
      { status: 409, description: `${config.resourceName} already exists` },
    );
  } else if (["getOne", "update", "delete"].includes(config.operation)) {
    autoErrors.push({
      status: 404,
      description: `${config.resourceName} not found`,
    });
    if (config.operation === "update") {
      autoErrors.push({ status: 400, description: "Validation failed" });
    }
  }

  const allErrors = [...autoErrors, ...(config.errors || [])];
  const uniqueErrors = Array.from(
    new Map(allErrors.map((e) => [e.status, e])).values(),
  );

  uniqueErrors.forEach((error) => {
    decorators.push(
      ApiResponse({
        status: error.status,
        description: error.description || `Error ${error.status}`,
      }),
    );
  });

  return applyDecorators(...decorators);
}

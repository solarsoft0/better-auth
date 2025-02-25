import { APIError as EncoreAPIError, ErrCode } from "encore.dev/api";


export const statusCode = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  MULTIPLE_CHOICES: 300,
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  SEE_OTHER: 303,
  NOT_MODIFIED: 304,
  TEMPORARY_REDIRECT: 307,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  NOT_ACCEPTABLE: 406,
  PROXY_AUTHENTICATION_REQUIRED: 407,
  REQUEST_TIMEOUT: 408,
  CONFLICT: 409,
  GONE: 410,
  LENGTH_REQUIRED: 411,
  PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413,
  URI_TOO_LONG: 414,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RANGE_NOT_SATISFIABLE: 416,
  EXPECTATION_FAILED: 417,
  "I'M_A_TEAPOT": 418,
  MISDIRECTED_REQUEST: 421,
  UNPROCESSABLE_ENTITY: 422,
  LOCKED: 423,
  FAILED_DEPENDENCY: 424,
  TOO_EARLY: 425,
  UPGRADE_REQUIRED: 426,
  PRECONDITION_REQUIRED: 428,
  TOO_MANY_REQUESTS: 429,
  REQUEST_HEADER_FIELDS_TOO_LARGE: 431,
  UNAVAILABLE_FOR_LEGAL_REASONS: 451,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  HTTP_VERSION_NOT_SUPPORTED: 505,
  VARIANT_ALSO_NEGOTIATES: 506,
  INSUFFICIENT_STORAGE: 507,
  LOOP_DETECTED: 508,
  NOT_EXTENDED: 510,
  NETWORK_AUTHENTICATION_REQUIRED: 511,
} as const;

type Status = keyof typeof statusCode;
type ErrDetails = Record<string, any>;

/**
 * Extends EncoreAPIError to match the signature of better-call APIError.
 */
export class APIError extends EncoreAPIError {
  status: Status;
  body: Record<string, any>;
  headers: Headers;

  constructor(
    status: Status,
    body: Record<string, any> = {},
    headers: Headers = new Headers()
  ) {
    // Map the status code to the corresponding error code
    const code = mapErrorStatusToCode(status);

    // Default message if not provided in the body
    const message = body.message || "An unexpected error occurred.";

    // Infer cause and details from body
    const cause = body.cause;
    const details = { ...body };
    delete details.message;  // Remove message as it is already used as the message for the error
    delete details.cause;    // Remove cause as it is passed separately

    // Call the super constructor with the mapped error code, message, cause, and details
    super(ErrCode[code], message, cause, details);

    // Set up custom properties for the error object
    this.status = status;
    this.body = {
      code: formatErrorCode(message) || code,  // Format error code
      message,
      ...body,  // Include any other details from the body
    };


    // toodo i don't think this is needed
    this.headers = headers;
    if (!this.headers.has("Content-Type")) {
      this.headers.set("Content-Type", "application/json");
    }

  }
}

/**
 * Maps Status codes to ErrCode (error status).
 * 
 * If a status code is not mapped, it will default to "Internal" error.
 */
function mapErrorStatusToCode(status: keyof typeof statusCode): keyof typeof ErrCode {
  // Mapping only for a subset of status codes
  const mapping: Partial<Record<keyof typeof statusCode, keyof typeof ErrCode>> = {
    ACCEPTED: "OK",
    BAD_REQUEST: "Canceled",
    INTERNAL_SERVER_ERROR: "Unknown",
    REQUEST_TIMEOUT: "DeadlineExceeded",
    NOT_FOUND: "NotFound",
    CONFLICT: "AlreadyExists",
    FORBIDDEN: "PermissionDenied",
    TOO_MANY_REQUESTS: "ResourceExhausted",
    PRECONDITION_FAILED: "FailedPrecondition",
    RANGE_NOT_SATISFIABLE: "OutOfRange",
    NOT_IMPLEMENTED: "Unimplemented",
    SERVICE_UNAVAILABLE: "Unavailable",
    UNAUTHORIZED: "Unauthenticated",
  };

  // If the status is not in the mapping, default to "Internal"
  return mapping[status] || "Internal";
}
/**
 * Formats the error code from the message.
 */
function formatErrorCode(message: string): string {
  return message
    .toUpperCase()
    .replace(/ /g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}
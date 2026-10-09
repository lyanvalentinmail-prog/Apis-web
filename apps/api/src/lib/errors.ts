/** Errores HTTP tipificados para que el middleware los serialice igual siempre. */
export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message = 'Petición inválida', details?: unknown) {
    return new ApiError(400, 'bad_request', message, details);
  }

  static unauthorized(message = 'No autenticado') {
    return new ApiError(401, 'unauthorized', message);
  }

  static forbidden(message = 'Sin permisos') {
    return new ApiError(403, 'forbidden', message);
  }

  static notFound(message = 'No encontrado') {
    return new ApiError(404, 'not_found', message);
  }

  static conflict(message = 'Conflicto', details?: unknown) {
    return new ApiError(409, 'conflict', message, details);
  }

  static tooManyRequests(message = 'Límite de peticiones excedido', details?: unknown) {
    return new ApiError(429, 'rate_limited', message, details);
  }

  static notImplemented(message = 'Función no configurada en este despliegue') {
    return new ApiError(501, 'not_implemented', message);
  }

  static internal(message = 'Error interno del servidor') {
    return new ApiError(500, 'internal_error', message);
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

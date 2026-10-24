// Thrown by services and middleware; errorHandler turns it into the JSON error shape.
export class HttpError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const badRequest = (message, fields) => new HttpError(400, 'VALIDATION_FAILED', message, fields);
export const unauthorized = (message = 'Please log in') => new HttpError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'You do not have access to this record') =>
  new HttpError(403, 'FORBIDDEN', message);
export const notFound = (what) => new HttpError(404, 'NOT_FOUND', `${what} not found`);
export const conflict = (code, message) => new HttpError(409, code, message);

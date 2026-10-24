import { badRequest } from '../utils/httpError.js';

/**
 * Parses req[part] with a zod schema. On success the cleaned value is stored in req.valid
 * (Express 5 makes req.query read-only, so it is not written back). On failure: 400 with
 * one message per field.
 */
export function validate(schema, part = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[part] ?? {});
    if (!result.success) {
      const fields = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || part;
        fields[key] ??= issue.message;
      }
      throw badRequest('Some fields need fixing', fields);
    }
    req.valid = { ...req.valid, [part]: result.data };
    next();
  };
}

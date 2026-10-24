// Schema plugin: API responses use the data-dictionary key names (userId, planId ...) instead
// of Mongo's _id, drop __v, and never include hidden fields such as passwordHash.
export function toJSON(idName, hidden = []) {
  return (schema) => {
    schema.set('toJSON', {
      versionKey: false,
      transform(_doc, ret) {
        const { _id, ...rest } = ret;
        for (const field of hidden) delete rest[field];
        return { [idName]: _id, ...rest };
      },
    });
  };
}

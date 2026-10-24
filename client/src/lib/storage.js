// localStorage can throw (private mode, blocked storage), so every access is guarded.
export const storage = {
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      if (value === null || value === undefined) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch {
      /* the app still works, it just won't remember */
    }
  },
};

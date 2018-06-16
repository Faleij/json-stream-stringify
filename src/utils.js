export default {};

export function isReadableStream(obj) {
  return obj &&
    typeof obj.pipe === 'function' &&
    typeof obj._read === 'function' &&
    typeof obj._readableState === 'object';
}

export function isPromise(value) {
  return value && (value.then instanceof Function);
}

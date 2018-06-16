export default {};

export function isReadableStream(obj) {
  return obj &&
    typeof obj.pipe === 'function' &&
    typeof obj._read === 'function' &&
    typeof obj._readableState === 'object';
}

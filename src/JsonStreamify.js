import {
  Transform,
  PassThrough,
} from 'stream';
import CoStream from './CoStream';
import RecursiveIterable from './RecursiveIterable';
import { isReadableStream } from './utils';

class JSONStreamify extends CoStream {
  constructor(value, replacer, space, _visited, _stack) {
    super(value, replacer, space, _visited, _stack);
    const replacedValue = replacer instanceof Function ? replacer(undefined, value) : value;
    this._iter = new RecursiveIterable(replacedValue, replacer, space, _visited, _stack);
  }

  * _makeGenerator() {
    let insertSeparator = false;
    // eslint-disable-next-line no-restricted-syntax
    for (const obj of this._iter) {
      if (obj.state === 'close') {
        insertSeparator = true;
        yield this.push(obj.type === Object ? '}' : ']');
        continue;
      }

      if (obj.state === 'open') {
        insertSeparator = false;
        yield this.push(obj.type === Object ? '{' : '[');
        continue;
      }

      if (insertSeparator) {
        yield this.push(',');
      }

      if (obj.key && obj.ctxType !== Array) {
        yield this.push(`${JSON.stringify(obj.key)}:`);
      }

      if (isReadableStream(obj.value)) {
        if (!obj.value._readableState.objectMode) {
          // Non Object Mode are emitted as a concatinated string
          yield this.push('"');
          yield obj.value.pipe(new Transform({
            transform: (data, enc, next) => {
              this.push(JSON.stringify(data.toString()).slice(1, -1));
              next(null);
            },
          }));
          yield this.push('"');
          continue;
        }

        // Object Mode Streams are emitted as arrays
        let first = true;
        const arrayStream = new PassThrough();
        let index = 0;
        obj.value.pipe(new Transform({
          objectMode: true,
          transform: (data, enc, next) => {
            if (!first) {
              arrayStream.push(',');
            }
            first = false;
            const stream = new JSONStreamify(
              data,
              this._iter.replacer,
              this._iter.space,
              this._iter.visited,
            );
            stream._iter._stack = obj.stack.concat(index);
            index += 1;
            stream._iter._parentCtxType = Array;
            // pipe to arrayStream but don't close arrayStream on end
            stream.once('end', () => next(null, undefined));
            stream.pipe(arrayStream, { end: false });
          },
        })).once('end', () => arrayStream.end()).resume();

        yield this.push('[');
        yield arrayStream;
        yield this.push(']');

        continue;
      }

      if (obj.state === 'circular') {
        yield this.push(JSON.stringify({ $ref: `$${obj.value.map(v => `[${JSON.stringify(v)}]`).join('')}` }));
      }

      if (obj.value && obj.value.then instanceof Function) {
        const childIterator = new RecursiveIterable(
          yield obj.value,
          this._iter.replacer,
          this._iter.space,
          this._iter.visited,
          obj.stack.concat(obj.key || []),
        )[Symbol.iterator]();
        obj.value = obj.attachChild(childIterator, obj.key);
        insertSeparator = false;
        continue;
      }

      if (obj.state === 'value') {
        yield this.push(JSON.stringify(obj.value));
      }

      insertSeparator = true;
    }
    this._iter = undefined;
  }
}

const fakeMap = {
  has: () => false,
  set: () => undefined,
};

function jsonStreamStringify(value, replacer, space, noDecycle) {
  return new JSONStreamify(value, replacer, space, noDecycle ? fakeMap : undefined);
}

export default jsonStreamStringify;

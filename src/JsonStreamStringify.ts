/* eslint-disable max-classes-per-file */
import { Readable } from 'stream';

// eslint-disable-next-line no-control-regex, no-misleading-character-class
const rxEscapable = /[\\"\u0000-\u001f\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;

// table of character substitutions
const meta = {
  '\b': '\\b',
  '\t': '\\t',
  '\n': '\\n',
  '\f': '\\f',
  '\r': '\\r',
  '"': '\\"',
  '\\': '\\\\',
};

function isReadableStream(value): boolean {
  return typeof value.read === 'function'
      && typeof value.pause === 'function'
      && typeof value.resume === 'function'
      && typeof value.pipe === 'function'
      && typeof value.once === 'function'
      && typeof value.removeListener === 'function';
}

enum Types {
  Array,
  Object,
  ReadableString,
  ReadableObject,
  Primitive,
  Promise,
}

function getType(value): Types {
  if (!value) return Types.Primitive;
  if (typeof value.then === 'function') return Types.Promise;
  if (isReadableStream(value)) return value._readableState.objectMode ? Types.ReadableObject : Types.ReadableString;
  if (Array.isArray(value)) return Types.Array;
  if (typeof value === 'object' || value instanceof Object) return Types.Object;
  return Types.Primitive;
}

const stackItemOpen = [];
stackItemOpen[Types.Array] = '[';
stackItemOpen[Types.Object] = '{';
stackItemOpen[Types.ReadableString] = '"';
stackItemOpen[Types.ReadableObject] = '[';

const stackItemEnd = [];
stackItemEnd[Types.Array] = ']';
stackItemEnd[Types.Object] = '}';
stackItemEnd[Types.ReadableString] = '"';
stackItemEnd[Types.ReadableObject] = ']';

function escapeString(string) {
  // Modified code, original code by Douglas Crockford
  // Original: https://github.com/douglascrockford/JSON-js/blob/master/json2.js

  // If the string contains no control characters, no quote characters, and no
  // backslash characters, then we can safely slap some quotes around it.
  // Otherwise we must also replace the offending characters with safe escape
  // sequences.

  return string.replace(rxEscapable, (a) => {
    const c = meta[a];
    return typeof c === 'string' ? c : `\\u${a.charCodeAt(0).toString(16).padStart(4, '0')}`;
  });
}

let primitiveToJSON: (value: any) => string;

if (global?.JSON?.stringify instanceof Function) {
  let canSerializeBigInt = true;
  try {
    if (JSON.stringify(global.BigInt ? global.BigInt('123') : '') !== '123') throw new Error();
  } catch (err) {
    canSerializeBigInt = false;
  }
  if (canSerializeBigInt) {
    primitiveToJSON = JSON.parse;
  } else {
    // eslint-disable-next-line no-confusing-arrow
    primitiveToJSON = (value) => typeof value === 'bigint' ? String(value) : JSON.stringify(value);
  }
} else {
  primitiveToJSON = (value) => {
    switch (typeof value) {
      case 'string':
        return `"${escapeString(value)}"`;
      case 'number':
        return Number.isFinite(value) ? String(value) : 'null';
      case 'bigint':
        return String(value);
      case 'boolean':
        return value ? 'true' : 'false';
      case 'object':
        if (!value) {
          return 'null';
        }
      // eslint-disable-next-line no-fallthrough
      default:
        // This should never happen, I can't imagine a situation where this executes.
        // If you find a way, please open a ticket or PR
        throw Object.assign(new Error(`Not a primitive "${typeof value}".`), { value });
    }
  };
}

/*
function quoteString(string: string) {
  return primitiveToJSON(String(string));
}
*/

const cache = new Map();
function quoteString(string: string) {
  const useCache = string.length < 10_000;
  // eslint-disable-next-line no-lonely-if
  if (useCache && cache.has(string)) {
    return cache.get(string);
  }
  const str = primitiveToJSON(String(string));
  if (useCache) cache.set(string, str);
  return str;
}

function readAsPromised(stream, size) {
  const value = stream.read(size);
  if (value === null) {
    return new Promise((resolve, reject) => {
      if (stream.readableEnded) {
        resolve(null);
        return;
      }
      const endListener = () => resolve(null);
      stream.once('end', endListener);
      stream.once('error', reject);
      stream.once('readable', () => {
        stream.removeListener('end', endListener);
        stream.removeListener('error', reject);
        resolve(stream.read());
      });
    });
  }
  return Promise.resolve(value);
}

interface Item {
  read(size?: number): Promise<void> | void;
  depth?: number;
  value?: any;
  indent?: string;
  path?: (string | number)[];
}

enum ReadState {
  NotReading = 0,
  Reading,
  ReadMore,
  Consumed,
}

export class JsonStreamStringify extends Readable {
  item?: Item;
  indent?: string;
  root: Item;
  include: string[];
  replacer: Function;
  visited: [] | WeakMap<any, string[]>;

  constructor(
    input: any,
    replacer?: Function | any[] | undefined,
    spaces?: number | string | undefined,
    private cycle = false,
    private bufferSize = 512,
  ) {
    super({ encoding: 'utf8' });

    const spaceType = typeof spaces;
    if (spaceType === 'number') {
      this.indent = ' '.repeat(<number>spaces);
    } else if (spaceType === 'string') {
      this.indent = <string>spaces;
    }

    const replacerType = typeof replacer;
    if (replacerType === 'object') {
      this.include = replacer as string[];
    } else if (replacerType === 'function') {
      this.replacer = replacer as Function;
    }

    this.visited = cycle ? new WeakMap() : [];

    this.root = <any>{
      value: { '': input },
      depth: 0,
      indent: '',
      path: [],
    };
    this.setItem(input, this.root, '');
  }

  setItem(value, parent: Item, key: string | number = '') {
    // call toJSON where applicable
    if (
      value
      && typeof value === 'object'
      && typeof value.toJSON === 'function'
    ) {
      value = value.toJSON(key);
    }

    // use replacer if applicable
    if (this.replacer) {
      value = this.replacer.call(parent.value, key, value);
    }

    // coerece functions and symbols into undefined
    if (value instanceof Function || typeof value === 'symbol') {
      value = undefined;
    }

    const type = getType(value);
    let path;

    // check for circular structure
    if (!this.cycle && type !== Types.Primitive) {
      if ((this.visited as any[]).some((v) => v === value)) {
        this.destroy(Object.assign(new Error('Converting circular structure to JSON'), {
          value,
          key,
        }));
        return;
      }
      (this.visited as any[]).push(value);
    } else if (this.cycle && type !== Types.Primitive) {
      path = (this.visited as WeakMap<any, string[]>).get(value);
      if (path) {
        this._push(`{"$ref":"$${path.map((v) => `[${(Number.isInteger(v as number) ? v : escapeString(quoteString(v as string)))}]`).join('')}"}`);
        this.item = parent;
        return;
      }
      path = parent === this.root ? [] : parent.path.concat(key);
      (this.visited as WeakMap<any, string[]>).set(value, path);
    }

    if (type === Types.Object) {
      this.setObjectItem(value, parent);
    } else if (type === Types.Array) {
      this.setArrayItem(value, parent);
    } else if (type === Types.Primitive) {
      if (parent !== this.root && typeof key === 'string') {
        // (<any>parent).write(key, primitiveToJSON(value));
        if (value === undefined) {
          // clear prePush buffer
          // this.prePush = '';
        } else {
          this._push(primitiveToJSON(value));
        }
        // undefined values in objects should be rejected
      } else if (value === undefined && typeof key === 'number') {
        // undefined values in array should be null
        this._push('null');
      } else if (value === undefined) {
        // undefined values should be ignored
      } else {
        this._push(primitiveToJSON(value));
      }
      this.item = parent;
      return;
    } else if (type === Types.Promise) {
      this.setPromiseItem(value, parent, key);
    } else if (type === Types.ReadableString) {
      this.setReadableStringItem(value, parent);
    } else if (type === Types.ReadableObject) {
      this.setReadableObjectItem(value, parent);
    }

    this.item.value = value;
    this.item.depth = parent.depth + 1;
    if (this.indent) this.item.indent = this.indent.repeat(this.item.depth);
    this.item.path = path;
  }

  setReadableStringItem(input: Readable, parent: Item) {
    if (input.readableEnded || (input as any)._readableState?.endEmitted) {
      this.emit('error', new Error('Readable Stream has ended before it was serialized. All stream data have been lost'), input, parent.path);
    } else if (input.readableFlowing || (input as any)._readableState?.flowing) {
      input.pause();
      this.emit('error', new Error('Readable Stream is in flowing mode, data may have been lost. Trying to pause stream.'), input, parent.path);
    }
    const that = this;
    this._push('"');
    input.once('end', () => {
      this._push('"');
      this.item = parent;
      this.emit('readable');
    });
    this.item = <any>{
      type: 'readable string',
      async read(size: number) {
        try {
          const data = await readAsPromised(input, size);
          if (data) that._push(escapeString(data.toString()));
        } catch (err) {
          that.emit('error', err);
          that.destroy();
        }
      },
    };
  }

  setReadableObjectItem(input: Readable, parent: Item) {
    if (input.readableEnded || (input as any)._readableState?.endEmitted) {
      this.emit('error', new Error('Readable Stream has ended before it was serialized. All stream data have been lost'), input, parent.path);
    } else if (input.readableFlowing || (input as any)._readableState?.flowing) {
      input.pause();
      this.emit('error', new Error('Readable Stream is in flowing mode, data may have been lost. Trying to pause stream.'), input, parent.path);
    }
    const that = this;
    this._push('[');
    let first = true;
    let i = 0;
    const item = <any>{
      type: 'readable object',
      async read(size: number) {
        try {
          let out = '';
          const data = await readAsPromised(input, size);
          if (data === null) {
            if (i && that.indent) {
              out += `\n${parent.indent}`;
            }
            out += ']';
            that._push(out);
            that.item = parent;
            that.unvisit(input);
            return;
          }
          if (first) first = false;
          else out += ',';
          if (that.indent) out += `\n${item.indent}`;
          that._push(out);
          that.setItem(data, item, i);
          i += 1;
        } catch (err) {
          that.emit('error', err);
          that.destroy();
        }
      },
    };
    this.item = item;
  }

  setPromiseItem(input: Promise<any>, parent: Item, key) {
    const that = this;
    let read = false;
    this.item = {
      async read() {
        if (read) return;
        try {
          read = true;
          that.setItem(await input, parent, key);
        } catch (err) {
          that.emit('error', err);
          that.destroy();
        }
      },
    };
  }

  setArrayItem(input: any[], parent: any) {
    // const entries = input.slice().reverse();
    let i = 0;
    const len = input.length;
    let first = true;
    const that = this;
    const item: Item = {
      read() {
        let out = '';
        let wasFirst = false;
        if (first) {
          first = false;
          wasFirst = true;
          if (!len) {
            that._push('[]');
            that.unvisit(input);
            that.item = parent;
            return;
          }
          out += '[';
        }
        const entry = input[i];
        if (i === len) {
          if (that.indent) out += `\n${parent.indent}`;
          out += ']';
          that._push(out);
          that.item = parent;
          that.unvisit(input);
          return;
        }
        if (!wasFirst) out += ',';
        if (that.indent) out += `\n${item.indent}`;
        that._push(out);
        that.setItem(entry, item, i);
        i += 1;
      },
    };
    this.item = item;
  }

  unvisit(item) {
    if (this.cycle) return;
    const _i = (this.visited as any[]).indexOf(item);
    if (_i > -1) (this.visited as any[]).splice(_i, 1);
  }

  objectItem?: any;
  setObjectItem(input: Record<any, any>, parent = undefined) {
    const keys = Object.keys(input);
    let i = 0;
    const len = keys.length;
    let first = true;
    const that = this;
    const { include } = this;
    let hasItems = false;
    let key;
    const item: Item = <any>{
      read() {
        if (i === 0) that._push('{');
        if (i === len) {
          that.objectItem = undefined;
          if (!hasItems) {
            that._push('}');
          } else {
            that._push(`${that.indent ? `\n${parent.indent}` : ''}}`);
          }
          that.item = parent;
          that.unvisit(input);
          return;
        }
        key = keys[i];
        if (include?.indexOf?.(key) === -1) {
          // replacer array excludes this key
          i += 1;
          return;
        }
        that.objectItem = item;
        i += 1;
        that.setItem(input[key], item, key);
      },
      write() {
        const out = `${hasItems && !first ? ',' : ''}${item.indent ? `\n${item.indent}` : ''}${quoteString(key)}:${that.indent ? ' ' : ''}`;
        first = false;
        hasItems = true;
        that.objectItem = undefined;
        return out;
      },
    };
    this.item = item;
  }

  prePush?: Function = undefined;
  buffer = '';
  bufferLength = 0;
  pushCalled = false;

  readSize = 0;
  private _push(data) {
    this.buffer += (this.objectItem ? this.objectItem.write() : '') + data;
    this.prePush = undefined;
    if (this.buffer.length >= this.bufferSize) {
      this.pushCalled = !this.push(this.buffer);
      this.buffer = '';
      this.bufferLength = 0;
      return false;
    }
    return true;
  }

  reading = false;
  readMore = false;
  readState: ReadState = ReadState.NotReading;
  async _read(size?: number) {
    if (this.readState === ReadState.Consumed) return;
    if (this.readState !== ReadState.NotReading) {
      this.readState = ReadState.ReadMore;
      return;
    }
    this.readState = ReadState.Reading;
    this.pushCalled = false;
    let p;
    while (!this.pushCalled && this.item !== this.root && !this.destroyed) {
      p = this.item.read(size);
      // eslint-disable-next-line no-await-in-loop
      if (p) await p;
    }
    if (this.item === this.root) {
      if (this.buffer.length) this.push(this.buffer);
      this.push(null);
      this.readState = ReadState.Consumed;
      this.cleanup();
    }
    if (this.readState === <any>ReadState.ReadMore) {
      this.readState = ReadState.NotReading;
      this._read(size);
    }
    this.readState = ReadState.NotReading;
  }

  private cleanup() {
    this.buffer = undefined;
    this.visited = undefined;
    this.item = undefined;
    this.root = undefined;
    this.prePush = undefined;
  }

  destroy(error?: Error): this {
    if (error) this.emit('error', error);
    super.destroy?.();
    this.cleanup();
    return this;
  }
}

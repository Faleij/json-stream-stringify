'use strict';

const Transform = require('stream').Transform;
const PassThrough = require('stream').PassThrough;
const CoStream = require('./coStream');
const RecursiveIterable = require('./recursiveIterable');
const isReadableStream = require('./utils').isReadableStream;

class JSONStreamify extends CoStream {
    constructor(value, replacer, space, _visited, _stack) {
        super(arguments);
        this._iter = new RecursiveIterable(replacer instanceof Function ? replacer(undefined, value) : value, replacer, space, _visited, _stack);
    }

    * _makeGenerator(value, replacer) {
        let insertSeparator = false;
        for (let obj of this._iter) {
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
                yield this.push(JSON.stringify(obj.key) + ':');
            }

            if (isReadableStream(obj.value)) {
                if (!obj.value._readableState.objectMode) {
                    // Non Object Mode are emitted as a concatinated string
                    yield this.push('"');
                    yield obj.value.pipe(new Transform({
                        transform: (data, enc, next) => {
                            this.push(JSON.stringify(data.toString()).slice(1, -1));
                            next(null);
                        }
                    }));
                    yield this.push('"');
                    continue;
                }

                // Object Mode Streams are emitted as arrays
                yield this.push('[');
                let first = true;
                const pass = new PassThrough();
                let i = 0;
                obj.value.pipe(new Transform({
                    objectMode: true,
                    transform: (data, enc, next) => {
                        if (!first) {
                            pass.push(',');
                        }
                        first = false;
                        let stream = new JSONStreamify(data, this._iter.replacer, this._iter.space, this._iter.visited);
                        stream._iter._stack = obj.stack.concat(i++);
                        stream._iter._parentCtxType = Array;
                        stream.once('end', () => next(null, undefined)).pipe(pass, {
                            end: false
                        });
                    }
                })).once('end', () => pass.end()).resume();
                yield pass;
                yield this.push(']');
                continue;
            }

            if (obj.state === 'circular') {
                yield this.push(JSON.stringify({ $ref: `$${obj.value.map(v => `[${JSON.stringify(v)}]`).join('')}` }));
            }

            if (obj.value instanceof Promise) {
                let childIterator = new RecursiveIterable(yield obj.value, this._iter.replacer, this._iter.space, this._iter.visited, obj.stack.concat(obj.key || []))[Symbol.iterator]();
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

module.exports = function (value, replacer, space, noDecycle) {
    return new JSONStreamify(value, replacer, space, noDecycle ? { has: () => false, set: () => undefined } : undefined);
};

'use strict';

const Readable = require('stream').Readable;
const isReadableStream = require('./utils').isReadableStream;

class RecursiveIterable {
    constructor(obj) {
        // Save a copy of the root object so we can be memory effective
        if (obj && typeof obj.toJSON === 'function') {
            obj = obj.toJSON();
        }
        this.exclude = [Promise, {
            __shouldExclude: isReadableStream
        }];
        this.obj = this._shouldIterate(obj) ? Array.isArray(obj) ? obj.slice(0) : Object.assign({}, obj) : obj;
    }

    _shouldIterate(val) {
        return val && typeof val === 'object' && !(this.exclude.some(v => v.__shouldExclude instanceof Function ? v.__shouldExclude(val) : val instanceof v));
    }

    static _getType(obj) {
        return Array.isArray(obj) ? Array : obj instanceof Object ? Object : undefined
    }

    [Symbol.iterator]() {
        let isObject = this._shouldIterate(this.obj);
        let nextIndex = 0;
        let keys = isObject && Object.keys(this.obj);
        let childIterator;

        let closed = !isObject;
        let opened = closed;

        const attachIterator = iterator => childIterator = iterator;
        const ctx = {
            depth: 0,
            type: RecursiveIterable._getType(this.obj),
            next: () => {
                let child = childIterator && childIterator.next();
                if (child) {
                    if (!child.done) {
                        return child;
                    }
                    childIterator = undefined;
                }

                let state;
                let key;
                let val;

                if (!opened) {
                    state = 'open';
                    opened = true;
                } else if (!closed && !keys.length) {
                    state = 'close';
                    closed = true;
                } else if (keys && keys.length) {
                    state = 'value';
                    key = keys.shift();
                    val = this.obj[key];

                    if (val && typeof val.toJSON === 'function') {
                        val = val.toJSON();
                    }

                    if (this._shouldIterate(val)) {
                        state = 'child';
                        childIterator = new RecursiveIterable(val)[Symbol.iterator]();
                        childIterator.ctxType = ctx.type;
                        childIterator.depth = ctx.depth + 1;
                        childIterator.type = RecursiveIterable._getType(val);
                    }

                    // Dereference iterated object
                    this.obj[key] = undefined;
                } else if (!isObject && !ctx.done) {
                    state = 'value';
                    val = this.obj;
                    ctx.done = true;
                }

                return {
                    value: {
                        depth: ctx.depth,
                        key: key,
                        value: val,
                        state: state,
                        ctxType: ctx.type,
                        attachChild: attachIterator
                    },
                    done: !state
                };
            }
        };

        return ctx;
    }
}

module.exports = RecursiveIterable;

'use strict';

const Readable = require('stream').Readable;
const isReadableStream = require('./utils').isReadableStream;

class RecursiveIterable {
    constructor(obj, replacer, space, visited, stack) {
        // Save a copy of the root object so we can be memory effective
        if (obj && typeof obj.toJSON === 'function') {
            obj = obj.toJSON();
        }
        this.exclude = [Promise, {
            __shouldExclude: isReadableStream
        }];
        this._stack = stack || [];
        this.visited = visited || new WeakMap();
        if (this._shouldIterate(obj)) {
            this.isVisited = this.visited.has(obj);
            if (!this.isVisited) {
                // Save only unvisited stack to weakmap
                this.visited.set(obj, this._stack.slice(0));
            }
        }
        this.obj = this._shouldIterate(obj) && !this.isVisited ? (Array.isArray(obj) ? obj.slice(0) : Object.assign({}, obj)) : obj;
        this.replacerIsArray = Array.isArray(replacer);
        this.replacer = replacer instanceof Function || this.replacerIsArray ? replacer : undefined;
        this.space = space;
    }

    _shouldIterate(val) {
        return val && typeof val === 'object' && !(this.exclude.some(v => v.__shouldExclude instanceof Function ? v.__shouldExclude(val) : val instanceof v));
    }

    static _getType(obj) {
        return Array.isArray(obj) ? Array : obj instanceof Object ? Object : undefined
    }

    [Symbol.iterator]() {
        let isObject = this._shouldIterate(this.obj);
        let ctxType = RecursiveIterable._getType(this.obj);
        let nextIndex = 0;
        let keys = isObject && (Array.isArray(this.obj) ? Array.from(Array(this.obj.length).keys()) : Object.keys(this.obj));
        let childIterator;
        let closed = !isObject;
        let opened = closed;

        const attachIterator = (iterator, addToStack) => {
            childIterator = iterator;
            childIterator._stack = this._stack.concat(addToStack || []);
        };

        const ctx = {
            depth: 0,
            type: ctxType,
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
                let type;

                if (!opened) {
                    if (this.isVisited) {
                        state = 'circular';
                        val = this.visited.get(this.obj);
                        opened = closed = true;
                        keys.length = 0;
                    } else {
                        state = 'open';
                        type = ctxType;
                        opened = true;
                    }
                } else if (!closed && !keys.length) {
                    state = 'close';
                    type = ctxType;
                    closed = true;
                } else if (keys && keys.length) {
                    state = 'value';
                    key = keys.shift();
                    val = this.obj[key];

                    if (this.replacerIsArray && this.replacer.indexOf(key) === -1) {
                        return ctx.next();
                    }
                } else if (!isObject && !ctx.done) {
                    state = 'value';
                    val = this.obj;
                    ctx.done = true;
                }

                if (state === 'value') {
                    if (this.replacer && !this.replacerIsArray) {
                        val = this.replacer(key, val);
                    }

                    if (val && typeof val.toJSON === 'function') {
                        val = val.toJSON();
                    }

                    if (typeof val === 'function') {
                        val = undefined;
                    }

                    if (val === undefined) {
                        if (key) {
                            // Dereference iterated object
                            this.obj[key] = undefined;
                        }

                        if ((this._parentCtxType ? this._parentCtxType !== Array : true) && ctx.type !== Array) {
                            return ctx.next();
                        }

                        val = null;
                    }

                    if (this._shouldIterate(val)) {
                        if (this.visited.has(val)) {
                            state = 'circular';
                            val = this.visited.get(val);
                        } else {
                            state = 'child';
                            childIterator = new RecursiveIterable(val, this.replacer, this.space, this.visited, this._stack.concat(key))[Symbol.iterator]();
                            childIterator.ctxType = ctx.type;
                            childIterator.depth = ctx.depth + 1;
                            childIterator.type = RecursiveIterable._getType(val);
                        }
                    }

                    if (key) {
                        // Dereference iterated object
                        this.obj[key] = undefined;
                    }
                }

                return {
                    value: {
                        depth: ctx.depth,
                        key: key,
                        value: val,
                        state: state,
                        stack: this._stack.slice(0),
                        type: type,
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

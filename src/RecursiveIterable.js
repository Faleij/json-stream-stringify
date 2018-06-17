import {
  isReadableStream,
  isPromise,
} from './utils';

class RecursiveIterable {
  constructor(obj, replacer, space, visited, stack) {
    let objRef = obj;
    // Save a copy of the root object so we can be memory effective
    if (objRef && typeof objRef.toJSON === 'function') {
      objRef = objRef.toJSON();
    }
    this.exclude = [{ __shouldExclude: isPromise }, { __shouldExclude: isReadableStream }];
    this._stack = stack || [];
    this.visited = visited || new WeakMap();
    if (this._shouldIterate(objRef)) {
      this.isVisited = this.visited.has(objRef);
      if (!this.isVisited) {
        // Save only unvisited stack to weakmap
        this.visited.set(objRef, this._stack.slice(0));
      }
    }
    if (this._shouldIterate(objRef) && !this.isVisited) {
      this.obj = Array.isArray(objRef) ? objRef.slice(0) : Object.assign({}, objRef);
    } else {
      this.obj = objRef;
    }
    this.replacerIsArray = Array.isArray(replacer);
    this.replacer = replacer instanceof Function || this.replacerIsArray ? replacer : undefined;
    this.space = space;
  }

  _shouldIterate(val) {
    return val && typeof val === 'object' && !(this.exclude.some(v => (v.__shouldExclude instanceof Function ? v.__shouldExclude(val) : val instanceof v)));
  }

  static _getType(obj) {
    if (Array.isArray(obj)) return Array;
    if (obj instanceof Object) return Object;
    return undefined;
  }

  get stack() {
    return this._stack.slice(0);
  }

  [Symbol.iterator]() {
    const { obj } = this;
    const shouldIter = this._shouldIterate(obj);
    const isArr = Array.isArray(obj);
    const ctxType = RecursiveIterable._getType(obj);
    const keys = shouldIter && (isArr ? Array.from(Array(obj.length).keys()) : Object.keys(obj));
    let childIterator;
    let closed = !shouldIter;
    let opened = closed;

    const attachIterator = (iterator, addToStack) => {
      childIterator = iterator;
      childIterator._stack = this._stack.concat(addToStack || []);
    };

    const ctx = {
      depth: 0,
      type: ctxType,
      next: () => {
        const child = childIterator && childIterator.next();

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
            opened = true;
            closed = true;
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
        } else if (!shouldIter && !ctx.done) {
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

            const parentCtxNotArray = (this._parentCtxType ? this._parentCtxType !== Array : true);
            if (parentCtxNotArray && ctx.type !== Array) {
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
              childIterator = new RecursiveIterable(
                val,
                this.replacer,
                this.space,
                this.visited,
                this._stack.concat(key),
              )[Symbol.iterator]();
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
            key,
            value: val,
            state,
            stack: this._stack.slice(0),
            type,
            ctxType: ctx.type,
            attachChild: attachIterator,
          },
          done: !state,
        };
      },
    };

    return ctx;
  }
}

export default RecursiveIterable;

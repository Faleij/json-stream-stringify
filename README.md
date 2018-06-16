# JSON Stream Stringify
[![NPM version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![Build Status][travis-image]][travis-url]
[![Coverage Status][coveralls-image]][coveralls-url]
[![License][license-image]](LICENSE)

JSON Stringify as a Readable Stream with rescursive resolving of any readable streams and Promises.

## Breaking changes in v2
 - Cycling is off by default

## Main Features
- Promises are rescursively resolved and the result is piped through JSONStreamStreamify
- Streams (Object mode) are piped through a transform which pipes the data through JSONStreamStreamify (enabling recursive resolving)
- Streams (Non-Object mode) is stringified and piped
- Output is streamed optimally with as small chunks as possible
- Cycling of cyclical structures and dags using Douglas Crockfords Cycle algorithm*
- Great memory management with reference release after processing
- Stream pressure handling
- Tested and runs on ES5** and ES6
- Bundled as UMD

\* Off by default since v2
\** With peer depedencies

## Install

```bash
npm install --save json-stream-stringify

# if you plain on using es5; install peer dependencies as well
npm install --save-dev babel-runtime babel-polyfill
```

## API

### JSONStreamStringify(value[, replacer[, spaces[, cycle]]])  
Convert value to JSON string. Returns a readable stream.
- ``value`` Any data to convert to JSON.
- ``replacer`` Optional ``Function(key, value)`` or ``Array``.  
 As a function the returned value replaces the value associated with the key.  [Details](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#The_replacer_parameter)  
 As an array all other keys are filtered. [Details](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#Example_with_an_array)
- ``spaces`` Optional ``String`` or ``Number`` **Not yet implemented**
- ``cycle`` Optional ``Boolean`` Set to ``true`` to enable cycling of cyclical structures and dags.

## Example Usage
```javascript
const JSONStreamStringify = require('json-stream-stringify');

JSONStreamStringify({
    aPromise: Promise.resolve(Promise.resolve("text")), // Promise may resolve more promises and streams which will be consumed and resolved
    aStream: ReadableObjectStream({a:1}, 'str'), // Stream may write more streams and promises which will be consumed and resolved
    arr: [1, 2, Promise.resolve(3), Promise.resolve([4, 5]), ReadableStream('a', 'b', 'c')],
    date: new Date(2016, 0, 2)
}).pipe(process.stdout);

```
Output (each line represents a write from JSONStreamStringify)
```
{
"aPromise":
"text"
"aStream":
[
{
"a":
1
}
,
"str"
]
"arr":
[
1
,
2
,
3
,
[
4
,
5
]
,
"
a
b
c
"
],
"date":
"2016-01-01T23:00:00.000Z"
}
```

## Practical Example with Express + Mongoose
```javascript
app.get('/api/users', (req, res, next) => JSONStreamStringify(Users.find().stream()).pipe(res));
```

## TODO
- Space option

Feel free to contribute.

## Technical Notes
Uses toJSON when available, and JSON.stringify to stringify everything but objects and arrays.  
Streams with ObjectMode=true are output as arrays while ObjectMode=false output as a concatinated string (each chunk is piped with transforms).

Circular structures are by default handled using a WeakMap based implementation of [Douglas Crockfords Decycle method](https://github.com/douglascrockford/JSON-js/blob/master/cycle.js), this option can be turned off; see the documentation on usage. To restore circular structures; use Crockfords Retrocycle method on the parsed object, not included in this module.

## Requirements

### ES5 / Node <6.5 / Browsers

Use file `dist/es5.umd.js` or `dist/es5.umd.min.js`

`package.browser` points to `dist/es5.umd.js`

NodeJS:
- Use `require('json-stream-stringify/dist/es5.umd.js')`
- For node versions earlier than 0.12 - you should upgrade or use an alternative stream library, streams seems to be broken

Any Browser / Other Environment:
- You need a bundler like webpack or rollup
- Nodejs conformat Stream library (included with webpack)
- The peer depedencies of this library (babel-runtime and babel-polyfill)

### ES6 / Node >=6.5 / Browsers

Use file `dist/es6.umd.js` or `dist/es6.umd.min.js`

`package.main` points to `dist/es6.umd.js`

NodeJS
- require as usual

Any Browser / Other Environment:
- Nodejs conformat Stream library

# License
[MIT](LICENSE)

Copyright (c) 2016 Faleij [faleij@gmail.com](mailto:faleij@gmail.com)

[npm-image]: http://img.shields.io/npm/v/json-stream-stringify.svg
[npm-url]: https://npmjs.org/package/json-stream-stringify
[downloads-image]: https://img.shields.io/npm/dm/json-stream-stringify.svg
[downloads-url]: https://npmjs.org/package/json-stream-stringify
[travis-image]: https://travis-ci.org/Faleij/json-stream-stringify.svg?branch=master
[travis-url]: https://travis-ci.org/Faleij/json-stream-stringify
[coveralls-image]: https://coveralls.io/repos/Faleij/json-stream-stringify/badge.svg?branch=master&service=github
[coveralls-url]: https://coveralls.io/github/Faleij/json-stream-stringify?branch=master
[license-image]: https://img.shields.io/badge/license-MIT-blue.svg

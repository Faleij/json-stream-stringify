# JSON Stream Stringify
[![NPM version][npm-image]][npm-url] [![NPM Downloads][downloads-image]][downloads-url] [![Dependency Status][dependency-image]][dependency-url] [![Build Status][travis-image]][travis-url] [![Coverage Status][coveralls-image]][coveralls-url] [![License][license-image]](LICENSE) [![Gratipay][gratipay-image]][gratipay-url]

JSON Stringify as a Readable Stream with rescursive resolving of any Readable stream and Promises.

Main Features:
- Promises are rescursively resolved and the result is piped through JSONStreamify
- Streams (ObjectMode) are piped through a transform which pipes the data through JSONStreamify (enabling recursive streams)
- Streams (Non-ObjectMode) is stringified and piped.
- Output is streamed optimally
- Great memory management with reference release post process (When a key and value has been processed the value is dereferenced)
- Stream pressure handling.

## Install

```bash
npm install --save json-stream-stringify
```

## Usage
```javascript
const JSONStringify = require('json-stream-stringify');

new JSONStreamify({
    aPromise: Promise.resolve(Promise.resolve("text")), // Promise may resolve more promises and streams which will be consumed and resolved
    aStream: ReadableObjectStream({a:1}, 'str'), // Stream may write more streams and promises which will be consumed and resolved
    arr: [1, 2, Promise.resolve(3), Promise.resolve([4, 5]), ReadableStream('a', 'b', 'c')],
    date: new Date(2016, 0, 2)
}).pipe(process.stdout);

```
Output (each line represents a write from JSONStreamify)
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

## TODO
- Space option
- Replacer option
- Circular dependency detection/handling (infinite loops may occur as it is)

Feel free to contribute.

## Technical Notes
Uses toJSON when available, and JSON.stringify to stringify everything but objects and arrays.  
Streams with ObjectMode=true are output as arrays while ObjectMode=false output as a concatinated string (each chunk is piped with transforms).

## Requirements
NodeJS >4.2.2

# License
[MIT](LICENSE)

Copyright (c) 2016 Faleij [faleij@gmail.com](mailto:faleij@gmail.com)

[npm-image]: http://img.shields.io/npm/v/json-stream-stringify.svg
[npm-url]: https://npmjs.org/package/json-stream-stringify
[downloads-image]: https://img.shields.io/npm/dm/json-stream-stringify.svg
[downloads-url]: https://npmjs.org/package/json-stream-stringify
[dependency-image]: https://gemnasium.com/Faleij/json-stream-stringify.svg
[dependency-url]: https://gemnasium.com/Faleij/json-stream-stringify
[travis-image]: https://travis-ci.org/Faleij/json-stream-stringify.svg?branch=master
[travis-url]: https://travis-ci.org/Faleij/json-stream-stringify
[coveralls-image]: https://coveralls.io/repos/Faleij/json-stream-stringify/badge.svg?branch=master&service=github
[coveralls-url]: https://coveralls.io/github/Faleij/json-stream-stringify?branch=master
[license-image]: https://img.shields.io/badge/license-MIT-blue.svg
[gratipay-image]: https://img.shields.io/gratipay/faleij.svg
[gratipay-url]: https://gratipay.com/faleij/

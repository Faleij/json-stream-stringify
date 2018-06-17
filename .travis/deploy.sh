#!/bin/bash

# Copy README only to ES6 package
cp README.md packages/json-stream-stringify/README.md

# Copy License file
cp LICENSE packages/json-stream-stringify/LICENSE
cp LICENSE packages/json-stream-stringify-es5/LICENSE

# Set the NPM access token we will use to publish.
npm config set registry https://registry.npmjs.org/
npm config set //registry.npmjs.org/:_authToken ${NPM_TOKEN}

npm run release
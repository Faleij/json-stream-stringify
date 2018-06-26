#!/bin/bash

build() {
	npm run build
}

test() {
	npm run test
}

coverage() {
	npm run coverage
	npm run coveralls
}

deploy() {
	# copy files for publish
	cp package.json dist/package.json
	cp package-lock.json dist/package-lock.json
	cp README.md dist/README.md
	cp LICENSE dist/LICENSE

	# move into publish directory
	cd dist

	# Set the NPM access token we will use to publish.
	npm config set registry https://registry.npmjs.org/
	npm config set //registry.npmjs.org/:_authToken ${NPM_TOKEN}

	npm run publish
}

# Loop over arguments
for var in "$@"
do
	# Check if the function exists (bash specific)
	if declare -f "$var" > /dev/null
	then
	# call argument
	"$var"
	else
	# Show a helpful error
	echo "'$var' is not a known function name in docker_fn.sh" >&2
	exit 1
	fi
done

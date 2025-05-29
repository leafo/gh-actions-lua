
build::
	-rm -r node_modules
	npm install --omit-dev
	npx esbuild --bundle main.js --outfile=app.js --minify --platform=node

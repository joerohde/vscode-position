/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check
'use strict';

import * as path from 'path';
import * as webpack from 'webpack';

const commonConfig: Partial<webpack.Configuration> = {
	mode: 'none', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')
    module: {
        rules: [{
            test: /\.ts$/,
            exclude: /node_modules/,
            use: [{
                loader: 'ts-loader',
            }]
        }]
    },
	devtool: 'nosources-source-map', // create a source map that points to the original source file
    externals: {
        vscode: "commonjs vscode" // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
    },
	performance: {
		hints: false
	},
};

const webExtensionConfig: webpack.Configuration = {...commonConfig, ...{
	target: 'webworker', // extensions run in a webworker context
	entry: {
		'extension': './src/extension.ts',
		'test': './src/test/test.ts'
	},
	output: {
		filename: '[name].js',
		path: path.join(__dirname, './dist/web'),
		libraryTarget: 'commonjs',
		devtoolModuleFilenameTemplate: '../../[resource-path]'
	},
	resolve: {
		mainFields: ['browser', 'module', 'main'], // look for `browser` entry point in imported node modules
		extensions: ['.ts', '.js'], // support ts-files and js-files
		alias: {
			// provides alternate implementation for node module and source files
		},
		fallback: {
			// Webpack 5 no longer polyfills Node.js core modules automatically.
			// see https://webpack.js.org/configuration/resolve/#resolvefallback
			// for the list of Node.js core module polyfills.
			'assert': require.resolve('assert')
		}
	},
	plugins: [
		new webpack.ProvidePlugin({
			process: 'process/browser', // provide a shim for the global `process` variable
		}),
	],
	infrastructureLogging: {
		level: "log", // enables logging required for problem matchers
	},
}};

const desktopConfig: webpack.Configuration =  {...commonConfig, ...{
    target: 'node', // vscode extensions run in a Node.js-context -> https://webpack.js.org/configuration/node/

    entry: './src/extension.ts', // the entry point of this extension, -> https://webpack.js.org/configuration/entry-context/
    output: { // the bundle is stored in the 'dist' folder (check package.json), -> https://webpack.js.org/configuration/output/
        path: path.resolve(__dirname, 'dist'),
        filename: 'extension.js',
        libraryTarget: "commonjs2",
        devtoolModuleFilenameTemplate: "../[resource-path]",
    },
    resolve: { // support reading TypeScript and JavaScript files, -> https://github.com/TypeStrong/ts-loader
        extensions: ['.ts', '.js']
    },
}};

module.exports = [ webExtensionConfig, desktopConfig ];

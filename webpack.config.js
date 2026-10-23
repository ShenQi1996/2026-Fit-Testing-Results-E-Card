const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const isProduction = process.env.NODE_ENV === 'production';

// Keep in sync with FIREBASE_ENV_KEYS in src/config/readFirebaseConfig.js.
const FIREBASE_ENV_KEYS = [
    'FIREBASE_API_KEY',
    'FIREBASE_AUTH_DOMAIN',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_STORAGE_BUCKET',
    'FIREBASE_MESSAGING_SENDER_ID',
    'FIREBASE_APP_ID',
];

const PROD_PROJECT_ID = 'fit-test-result-e-card-2026';

// Local staging only. Does not override variables already in the environment,
// so a production Vercel build with no env file is unchanged.
const loadEnvLocal = () => {
    const filePath = path.resolve(__dirname, '.env.local');
    if (!fs.existsSync(filePath)) return;
    fs.readFileSync(filePath, 'utf8').split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) return;
        const key = trimmed.slice(0, eq).trim();
        if (process.env[key] !== undefined) return;
        let value = trimmed.slice(eq + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"'))
            || (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        process.env[key] = value;
    });
};

loadEnvLocal();

// Trim before EnvironmentPlugin inlines the values. A trailing newline must not
// miss the staging check and fall back to the production project.
if (process.env.APP_ENV !== undefined) {
    process.env.APP_ENV = String(process.env.APP_ENV).trim();
}
FIREBASE_ENV_KEYS.forEach((key) => {
    if (process.env[key] !== undefined) {
        process.env[key] = String(process.env[key]).trim();
    }
});

const appEnv = String(process.env.APP_ENV || '').trim();
if (appEnv === 'staging') {
    const missing = FIREBASE_ENV_KEYS.filter((key) => !String(process.env[key] || '').trim());
    if (missing.length > 0) {
        throw new Error(
            `APP_ENV=staging requires ${missing.join(', ')}. `
            + 'Refusing to fall back to the production Firebase project.'
        );
    }
    if (String(process.env.FIREBASE_PROJECT_ID).trim() === PROD_PROJECT_ID) {
        throw new Error(
            `APP_ENV=staging cannot use production project ${PROD_PROJECT_ID}.`
        );
    }
}

const environmentDefaults = { APP_ENV: '' };
FIREBASE_ENV_KEYS.forEach((key) => {
    environmentDefaults[key] = '';
});

const stylesHandler = MiniCssExtractPlugin.loader;

const config = {
    entry: './src/index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].[contenthash].js',
        publicPath: '/',
        clean: true,
    },
    devServer: {
        open: true,
        host: 'localhost',
        port: 3000,
        historyApiFallback: true,
        static: [
            {
                directory: path.resolve(__dirname, 'public'),
                publicPath: '/',
            },
        ],
    },
    plugins: [
        new webpack.EnvironmentPlugin(environmentDefaults),
        new HtmlWebpackPlugin({
            template: './public/index.html',
            filename: './index.html',
        }),
        new MiniCssExtractPlugin(),
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: path.resolve(__dirname, 'public'),
                    to: path.resolve(__dirname, 'dist'),
                    globOptions: {
                        ignore: ['**/index.html'],
                    },
                },
            ],
        }),
    ],
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/i,
                loader: 'babel-loader',
                options: {
                    presets: ['@babel/preset-env', '@babel/preset-react'],
                }
            },
            {
                test: /\.css$/i,
                use: [stylesHandler, 'css-loader'],
            },
            {
                test: /\.(eot|svg|ttf|woff|woff2|png|jpg|gif)$/i,
                type: 'asset',
            },
        ],
    },
};

module.exports = () => {
    if (isProduction) {
        config.mode = 'production';
    } else {
        config.mode = 'development';
    }
    return config;
};

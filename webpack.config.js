const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const { assertStagingFirebaseEnv } = require('./src/config/stagingFirebaseGuard');

const FIREBASE_ENV_KEYS = [
    'FIREBASE_API_KEY',
    'FIREBASE_AUTH_DOMAIN',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_STORAGE_BUCKET',
    'FIREBASE_MESSAGING_SENDER_ID',
    'FIREBASE_APP_ID',
];

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

// webpack --mode does not set NODE_ENV before this file loads. The guard has
// to read argv.mode when webpack calls the exported function.
const webpackMode = (argv = {}) => (
    argv.mode === 'development' || argv.mode === 'production' || argv.mode === 'none'
        ? argv.mode
        : 'production'
);

const applyFirebaseEnv = (mode) => {
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

    const isDevelopment = mode === 'development';
    // npm start and npm run build:dev pass --mode=development. Missing staging
    // keys fail the build. They must not silently select production.
    if (isDevelopment) {
        const devAppEnv = String(process.env.APP_ENV || '').trim();
        if (devAppEnv && devAppEnv !== 'staging') {
            throw new Error(
                `Development builds use the staging Firebase project fit-test-result-e-card-staging. `
                + `APP_ENV is ${JSON.stringify(devAppEnv)}, not "staging". `
                + 'Refusing to use the production Firebase project.'
            );
        }
        process.env.APP_ENV = 'staging';
    }

    const appEnv = String(process.env.APP_ENV || '').trim();
    if (!isDevelopment && appEnv && appEnv !== 'staging') {
        console.warn(
            `APP_ENV is ${JSON.stringify(appEnv)}, which is not exactly "staging". `
            + 'This build uses the production Firebase config.'
        );
    }

    const firebaseEnv = {
        FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
        FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
        FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
        FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
        FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID,
        FIREBASE_APP_ID: process.env.FIREBASE_APP_ID,
    };
    if (appEnv === 'staging' || isDevelopment) {
        assertStagingFirebaseEnv(firebaseEnv);
    }
};

const environmentDefaults = { APP_ENV: '', SENTRY_DSN: '' };
FIREBASE_ENV_KEYS.forEach((key) => {
    environmentDefaults[key] = '';
});

const stylesHandler = MiniCssExtractPlugin.loader;

const sentryAuthToken = () => String(process.env.SENTRY_AUTH_TOKEN || '').trim();

// Upload hidden source maps on production builds when a CI auth token is present.
// Without a token the build still succeeds; stack traces stay minified until Vercel
// (or local) sets SENTRY_AUTH_TOKEN.
const sentryUploadPlugins = (mode) => {
    if (mode === 'development') return [];
    const authToken = sentryAuthToken();
    if (!authToken) {
        console.warn(
            'SENTRY_AUTH_TOKEN is unset. Production source maps will not upload to Sentry.'
        );
        return [];
    }
    // Lazy require so Jest webpack-config tests do not load the plugin's ESM deps.
    const { sentryWebpackPlugin } = require('@sentry/webpack-plugin');
    return [
        sentryWebpackPlugin({
            org: 'secure-fit',
            project: 'fit-test-e-card',
            authToken,
            sourcemaps: {
                filesToDeleteAfterUpload: ['./dist/**/*.map'],
            },
        }),
    ];
};

const buildConfig = (mode) => ({
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
        ...sentryUploadPlugins(mode),
    ],
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/i,
                exclude: /node_modules/,
                loader: 'babel-loader',
                options: {
                    presets: ['@babel/preset-env', '@babel/preset-react'],
                    cacheDirectory: true,
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
});

module.exports = (env, argv) => {
    const mode = webpackMode(argv);
    applyFirebaseEnv(mode);
    const isDevelopment = mode === 'development';
    const uploadSourceMaps = !isDevelopment && Boolean(sentryAuthToken());
    return {
        ...buildConfig(mode),
        mode: mode === 'none' ? 'none' : mode,
        // Local: cheap maps for debugging. Production with SENTRY_AUTH_TOKEN: hidden
        // maps for Sentry upload (deleted after upload). Without a token, skip maps
        // so Vercel does not publish .map files.
        devtool: isDevelopment
            ? 'eval-cheap-module-source-map'
            : (uploadSourceMaps ? 'hidden-source-map' : false),
        cache: {
            type: 'filesystem',
            buildDependencies: {
                config: [__filename],
            },
        },
    };
};

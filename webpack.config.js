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

const readEnvFile = (filePath, into) => {
    if (!fs.existsSync(filePath)) return;
    fs.readFileSync(filePath, 'utf8').split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) return;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"'))
            || (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        into[key] = value;
    });
};

const fileEnv = {};
readEnvFile(path.resolve(__dirname, '.env'), fileEnv);
readEnvFile(path.resolve(__dirname, '.env.local'), fileEnv);
Object.entries(fileEnv).forEach(([key, value]) => {
    if (process.env[key] === undefined) {
        process.env[key] = value;
    }
});

const appEnv = String(process.env.APP_ENV || '').trim();
const missingFirebaseEnv = FIREBASE_ENV_KEYS.filter((key) => !String(process.env[key] || '').trim());

// APP_ENV unset: production keeps the built-in config. Do not require FIREBASE_*.
// APP_ENV=staging: EnvironmentPlugin fails the build when any FIREBASE_* value is missing.
let firebaseEnvPlugin;
if (!appEnv) {
    const productionDefine = {
        'process.env.APP_ENV': JSON.stringify(''),
    };
    FIREBASE_ENV_KEYS.forEach((key) => {
        productionDefine[`process.env.${key}`] = JSON.stringify('');
    });
    firebaseEnvPlugin = new webpack.DefinePlugin(productionDefine);
} else if (appEnv === 'staging') {
    if (missingFirebaseEnv.length > 0) {
        throw new Error(
            `APP_ENV=staging is missing ${missingFirebaseEnv.join(', ')}. `
            + 'The production Firebase config is not used for this build.'
        );
    }
    firebaseEnvPlugin = new webpack.EnvironmentPlugin(['APP_ENV', ...FIREBASE_ENV_KEYS]);
} else {
    throw new Error(
        `APP_ENV=${appEnv} is not supported. Leave APP_ENV unset for production, or set APP_ENV=staging.`
    );
}

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
        firebaseEnvPlugin,
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
                    presets: ["@babel/preset-env", "@babel/preset-react"],
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

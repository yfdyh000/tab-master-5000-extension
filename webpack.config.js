import fs from 'fs-extra';
import path from 'path';
import webpack from 'webpack';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';
import ExtractTextPlugin from 'extract-text-webpack-plugin';
import {BundleAnalyzerPlugin} from 'webpack-bundle-analyzer';
import LodashModuleReplacementPlugin from 'lodash-webpack-plugin';
import SizePlugin from 'size-plugin';
import SentryWebpackPlugin from '@sentry/webpack-plugin';

const babelConfig = JSON.parse(fs.readFileSync('./.babelrc'));

const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const aliases = Object.assign({
  underscore: 'lodash'
}, require('lodash-loader').createLodashAliases());

const {COMMIT_HASH, DEV_ENV, NODE_ENV, BUNDLE_ENTRY} = process.env;
const ENV = NODE_ENV || 'development';
const PROD = ENV === 'production';
const ENTRY = BUNDLE_ENTRY;
const SKIP_MINIFY = JSON.parse(process.env.SKIP_MINIFY || 'false');
const publicPath = PROD ? '/' : 'http://127.0.0.1:8009/app/scripts/';

const CONTENT_BASE = SKIP_MINIFY ? 'sources' : 'dist';
const WORKDIR = PROD ? CONTENT_BASE : 'app';
const manifestPath = `./${WORKDIR}/manifest.json`;

console.log(`COMMIT HASH:`, COMMIT_HASH);
console.log(`ENTRY:`, ENTRY || 'app');
console.log(`NODE_ENV:`, NODE_ENV);
console.log(`BUILD ENV:`, DEV_ENV);
console.log(`SKIP MINIFICATION:`, SKIP_MINIFY);
console.log(`WORKDIR:`, WORKDIR);
console.log(`========================================`);

fs.ensureFileSync(manifestPath);
fs.createReadStream(`./app/manifest_${DEV_ENV}${DEV_ENV === 'chrome' && ENV === 'development' ? '.dev' : ''}.json`)
  .pipe(fs.createWriteStream(manifestPath));

const postcssPlugins = () => {
  let processors = [
    autoprefixer({
      overrideBrowserslist: [
        'ff >= 52',
        'chrome >= 58',
        'opera >= 23'
      ]
    })
  ];

  processors.push(
    cssnano({
      safe: true,
      discardComments: {
        removeAll: true
      }
    })
  );

  return processors;
}

let cssLoaders = [
  {
    loader: 'css-loader',
    options: {
      sourceMap: true,
      importLoaders: 1
    }
  },
  {
    loader: 'postcss-loader',
    options: {
      sourceMap: true,
      plugins: postcssPlugins
    }
  },
];

let scssLoaders = [
  {
    loader: 'css-loader',
    options: {
      sourceMap: true,
      importLoaders: 1
    },
  },
  {
    loader: 'postcss-loader',
    options: {
      sourceMap: true,
      plugins: postcssPlugins
    }
  },
  {
    loader: 'sass-loader',
    options: {
      sourceMap: true,
      sassOptions: {
        outputStyle: PROD ? 'compressed' : 'expanded',
        includePaths: [
          path.join(__dirname, 'node_modules')
        ],
      }
    }
  }
];

if (!PROD) {
  cssLoaders = ['style-loader'].concat(cssLoaders);
  scssLoaders = ['style-loader'].concat(scssLoaders);
  babelConfig.plugins.push('react-hot-loader/babel');
}

const config = {
  mode: ENV,
  context: path.resolve(__dirname),
  entry: PROD ? [
    '@babel/polyfill',
    'app.tsx'
  ] : [
    'react-hot-loader/patch',
    'webpack-dev-server/client?http://127.0.0.1:8009',
    'webpack/hot/only-dev-server',
    'app.tsx',
  ],
  output: {
    path: path.resolve(__dirname, `${CONTENT_BASE}/scripts`),
    filename: 'app.js',
    publicPath,
    globalObject: 'this'
  },
  plugins: [
    new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),
    new LodashModuleReplacementPlugin({
      cloning: true,
      flattening: true,
      shorthands: true
    }),
    new webpack.DefinePlugin({
      'process.env': {
         NODE_ENV: JSON.stringify(NODE_ENV)
       }
    })
  ],
  module: {
    rules: [
      {
        test: /\.worker\.ts$/,
        use: {
          loader: 'worker-loader',
          options: {
            name: '[name].js',
            publicPath: PROD ? '/scripts/' : publicPath
          }
        }
      },
      {
        test: /\.(js|jsx|mjs|ts|tsx)$/,
        exclude: /node_modules(?!\/rc-color-picker)/,
        use: [
          {
            loader: 'lodash-loader'
          },
          {
            loader: 'babel-loader',
            options: babelConfig
          }
        ],
      },
      {
        test: /\.css$/,
        use: PROD ? ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: cssLoaders
        }) : cssLoaders,
      },
      {
        test: /\.scss$/,
        use: PROD ? ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: scssLoaders
        }) : scssLoaders,
      },
      {
        test: /\.(ttf|eot|svg|woff(2)?)(\S+)?$/,
        loader: 'file-loader?name=[name].[ext]'
      },
      {
        test: /\.(png|jpg|gif)$/,
        loader: 'file-loader?name=[name].[ext]'
      },
    ],
  },
  devtool: PROD ? 'source-map' : 'inline-source-map',
  stats: {
    children: false
  },
  resolve: {
    modules: [
      'node_modules',
       path.join(__dirname, 'app/scripts/components')
    ],
    extensions: ['.js', '.jsx', '.tsx', '.ts', '.json'],
    alias: aliases
  },
  devServer: {
    port: 8009,
    hot: true,
    inline: false,
    historyApiFallback: true,
    contentBase: path.join(__dirname, 'dist'),
    headers: {'Access-Control-Allow-Origin': '*'},
    disableHostCheck: true,
    publicPath
  },
};

if (PROD && ENTRY) {
  if (ENTRY === 'app') {
    config.entry = './app/scripts/components/app.tsx';
    config.output.filename = 'app.js';
    config.plugins.push(new ExtractTextPlugin({filename: 'main.css', allChunks: false}));
  } else if (ENTRY === 'bg') {
    config.entry = './app/scripts/bg/bg.ts';
    config.output.filename = 'background.js';
  } else {
    throw new Error('Invalid entrypoint.');
  }

  config.entry = ['@babel/polyfill', config.entry];
  config.devtool = 'hidden-source-map';
  if (!SKIP_MINIFY) {
    config.optimization = {
      minimize: false,
      splitChunks: {
        chunks: 'async',
        minSize: 30000,
        minChunks: 2,
        maxAsyncRequests: 5,
        maxInitialRequests: 3,
        name: true,
        cacheGroups: {
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
          vendors: {
            test: /[\\/]node_modules[\\/]/,
            priority: -10,
            chunks: 'all'
          }
        }
      }
    };
    config.plugins.push(
      new UglifyJsPlugin({
        sourceMap: true,
        uglifyOptions: {
          ecma: 8,
          mangle: false,
          compress: {
            warnings: false,
            drop_console: true,
            drop_debugger: true,
            dead_code: true,
            unused: true,
          },
          output: {
            comments: false
          }
        },
      }),
    );

    if (fs.existsSync('./.sentryclirc')) {
      config.plugins.push(
        new SentryWebpackPlugin({
          include: '.',
          ignoreFile: '.sentrycliignore',
          ignore: [
            'node_modules',
            'sources',
            'source_maps',
            'app',
            'webpack.config.js',
            'gulpfile.js',
          ],
          configFile: 'sentry.properties'
        })
      );
    }
  } else {
    config.plugins.push(
      new BundleAnalyzerPlugin({
        openAnalyzer: false,
        analyzerMode: 'static',
        reportFilename: `../bundle_analysis/${ENTRY}_bundleReport.html`
      })
    );
  }
} else {
  config.plugins.push(
    new webpack.NoEmitOnErrorsPlugin(),
    new webpack.HotModuleReplacementPlugin(),
    new webpack.LoaderOptionsPlugin({
      debug: true,
    }),
    new SizePlugin()
  );
}
module.exports = config;
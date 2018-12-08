var path = require('path')

var projectRoot = path.resolve(__dirname, '../')

module.exports = {
  module: {
    loaders: [
      {
        test: /\.vue$/,
        loader: 'vue'
      },
      {
        test: /\.js$/,
        loader: 'babel',
        include: [path.join(projectRoot, 'src')],
        exclude: /node_modules/
      }
    ]
  },
  vue: {
    loaders: {
      less: 'vue-style!css!less'
    },
    postcss: [
      require('autoprefixer')({
        browsers: ['iOS >= 7', 'Android >= 4.1']
      })
    ]
  }
}

/* jshint esnext: true*/

import typescript from 'rollup-plugin-typescript';

export default {
  entry: 'client/client.js',
  format: "iife",
  moduleName: "Lob",
  dest: "public/lob.js",
  sourceMap: true,

  plugins: [
    typescript({
      sourceMap: true
    })
  ]
};

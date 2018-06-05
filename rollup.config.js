/* jshint esnext: true*/
import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';

export default {
  entry: 'client/boot.js',
  format: "iife",
  moduleName: "Lob",
  dest: "public/lob.js",
  sourceMap: true,
  plugins: [
    resolve({ jsnext: true, main: true }),
    commonjs()
  ]
};

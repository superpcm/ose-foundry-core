import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { copy } from "@web/rollup-plugin-copy";
import scss from "rollup-plugin-scss";
import sass from "sass";

export default {
  input: "src/ose.js",
  output: {
    dir: "dist",
    format: "es",
    sourcemap: true,
  },
  plugins: [
    resolve(),
    commonjs(),
    typescript(),
    scss({
      output: "dist/ose.css",
      sass,
    }),
    copy({
      copyOnce: true,
      patterns: ["assets/**/*", "lang/**/*", "templates/**/*", "system.json"],
    }),
  ],
};
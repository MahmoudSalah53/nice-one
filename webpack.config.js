const webpack = require("webpack");
const path = require("path");
const Dotenv = require("dotenv-webpack");
const fs = require("fs");

// Get MAX_DATA_BYTES from environment variable, default to 200000
const MAX_DATA_BYTES = process.env.MAX_DATA_BYTES || 250000;

module.exports = {
  mode: "production",
  entry: {
    "embed-popup": "./components/embed-popup/standalone-bundle-root.tsx",
    "page-automation": "./utils/page-automation-bundle.ts",
  },
  output: {
    path: path.resolve(__dirname, "public"),
    filename: "[name].js", // Use [name] for multiple entry points
  },
  devtool: "source-map", // Equivalent to sourcemap: true
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
    extensions: [".tsx", ".ts", ".js"], // Resolve TypeScript and JS files
  },
  plugins: [
    // NOTE: the below doesn't whitelist, see https://github.com/mrsteele/dotenv-webpack/issues/41
    new Dotenv({
      systemvars: true,
      path: fs.existsSync(path.resolve(__dirname, ".env.local"))
        ? ".env.local"
        : fs.existsSync(path.resolve(__dirname, ".env"))
          ? ".env"
          : undefined,
      silent: true,
    }),
    // Custom plugin to replace MAX_DATA_BYTES value in bundled files
    {
      apply: (compiler) => {
        compiler.hooks.afterEmit.tap("ReplaceMaxDataBytes", (compilation) => {
          // Process all bundles
          const bundles = ["embed-popup", "page-automation"];
          
          bundles.forEach((bundle) => {
            const jsPath = path.resolve(__dirname, "public", `${bundle}.js`);
            const mapPath = path.resolve(__dirname, "public", `${bundle}.js.map`);

            // Replace in JS file
            if (fs.existsSync(jsPath)) {
              let content = fs.readFileSync(jsPath, "utf8");
              // Replace all occurrences of 15360 with the new value
              content = content.replace(/15360/g, String(MAX_DATA_BYTES));
              fs.writeFileSync(jsPath, content, "utf8");
              console.log(`✅ Replaced MAX_DATA_BYTES in ${bundle}.js: 15360 → ${MAX_DATA_BYTES}`);

              const extDir = path.resolve(__dirname, "node-extension");
              if (fs.existsSync(extDir)) {
                fs.copyFileSync(jsPath, path.join(extDir, `${bundle}.js`));
              }
            }

            // Replace in map file
            if (fs.existsSync(mapPath)) {
              let mapContent = fs.readFileSync(mapPath, "utf8");
              // Replace all occurrences of 15360 with the new value
              mapContent = mapContent.replace(/15360/g, String(MAX_DATA_BYTES));
              fs.writeFileSync(mapPath, mapContent, "utf8");
              console.log(`✅ Replaced MAX_DATA_BYTES in ${bundle}.js.map: 15360 → ${MAX_DATA_BYTES}`);
            }
          });
        });
      },
    },
  ],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: "ts-loader",
          options: {
            configFile: "tsconfig.webpack.json",
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/i,
        use: [
          "to-string-loader", // Convert CSS to string for shadow DOM injection
          {
            loader: "css-loader",
            options: {
              esModule: false, // Use CommonJS export for to-string-loader compatibility
            },
          },
          "postcss-loader",
        ],
        exclude: /node_modules/,
      },
    ],
  },
  externals: {
    // Mark LiveKitEmbedFixed as an external global (optional depending on usage)
    LiveKitEmbedFixed: "LiveKitEmbedFixed",
  },
};

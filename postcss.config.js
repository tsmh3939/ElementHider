import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import cssnano from "cssnano";
import purgecss from "@fullhuman/postcss-purgecss";

const isProduction = process.env.NODE_ENV === "production";

export default {
  plugins: [
    tailwindcss,
    autoprefixer,
    ...(isProduction
      ? [
          purgecss({
            content: ["./src/**/*.{html,ts,tsx}"],
            safelist: {
              greedy: [/^\[data-theme/],
            },
            variables: false,
            defaultExtractor: (content) =>
              content.match(/[\w-/:]+(?<!:)/g) || [],
          }),
        ]
      : []),
    cssnano,
  ],
};

import type { Config } from "tailwindcss";
import { ALL_THEMES } from "./src/shared/config";

// "nimbus" is a custom CSS theme, so filter it out from daisyUI built-in list
const daisyuiThemes = ALL_THEMES.filter((t) => t !== "nimbus");

export default {
  content: ["./src/**/*.{html,ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [...daisyuiThemes],
  },
} satisfies Config;

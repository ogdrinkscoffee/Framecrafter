// Tailwind CSS 4 is wired up by the @tailwindcss/vite plugin in vite.config.ts,
// so PostCSS must not load Tailwind itself.
//
// This file exists to stop PostCSS from discovering a config in a *parent*
// directory. In a multi-project workspace the folder above Framecrafter can hold
// a postcss.config.js that loads Tailwind 3; Tailwind 3 then sees the v4
// `@import "tailwindcss"` / `@theme` / `@layer base` syntax in src/index.css and
// fails with "`@layer base` is used but no matching `@tailwind base` directive is
// present". Keeping an empty plugin list here pins the project to its own setup.
export default { plugins: {} };

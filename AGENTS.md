# use vite-plus

add package

```sh
vp add (-D) hoge
```

## add scripts

```ts vite.config.ts
import { defineConfig } from "vite-plus";

export default defineConfig({
  // ...
  run: {
    tasks: {
      build: "nuxt build",
      // ...
      // add here
    },
  },
});
```

## check

run each turn that includes edits.

```sh
vp check --fix
```

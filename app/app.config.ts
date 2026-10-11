export default defineAppConfig({
  ui: {
    colors: { primary: "violet", neutral: "zinc" },
    avatar: { variants: { color: { neutral: { fallback: "text-default" } } } },
  },
});

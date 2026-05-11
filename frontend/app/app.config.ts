export default defineAppConfig({
  // https://ui.nuxt.com/getting-started/theme#design-system
  ui: {
    colors: {
      primary: "primary",
      secondary: "secondary",
      tertiary: "tertiary",
      neutral: "neutral",
      success: "success",
      negative: "negative",
      error: "error",
    },
  },
  charts: {
    lightTextColor: {
      type: "neutral",
      shade: 300,
    },
    baseDataColors: [
      {
        type: "primary",
        shade: 700,
      },
      {
        type: "secondary",
        shade: 700,
      },
    ],
    smallFontSize: 10.5,
  },
});

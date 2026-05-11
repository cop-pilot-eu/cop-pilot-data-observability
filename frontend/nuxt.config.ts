/// <reference types="node" />
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  ssr: false,
  devtools: { enabled: process.env.NODE_ENV !== "production" },
  devServer: {
    port: 3000,
  },

  app: {
    head: {
      title: "COP Pilot Data Observability",
      meta: [
        {
          name: "COP Pilot Data Observability",
          content: "COP Pilot Data Observability application.",
        },
      ],
    },
  },

  modules: ["@nuxt/ui", "@nuxt/icon", "nuxt-echarts"],

  fonts: {
    providers: {
      fontshare: false,
    },
  },

  css: ["~/assets/css/main.css"],

  ui: {
    theme: {
      colors: [
        "primary",
        "secondary",
        "tertiary",
        "success",
        "negative",
        "error",
      ],
    },
  },

  colorMode: {
    preference: "light",
    fallback: "light",
    classSuffix: "",
    storage: "cookie",
  },

  components: [
    {
      path: "~/components",
      pathPrefix: false,
    },
  ],
  echarts: {
    charts: ["BarChart", "LineChart"],
    components: [
      "GridComponent",
      "TooltipComponent",
      "LegendComponent",
      "DataZoomComponent",
      "MarkLineComponent",
    ],
    features: ["LabelLayout"],
  },

  runtimeConfig: {
    backendUrl: "",
    public: {
      useMockData: false,
    },
  },
});

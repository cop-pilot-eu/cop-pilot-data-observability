<script setup lang="ts">
useHead({
  htmlAttrs: { class: "h-full" },
  bodyAttrs: { class: "h-full bg-secondary-300" },
});
</script>

<template>
  <div class="min-h-screen flex flex-col py-8 px-24 bg-secondary-300">
    <Header />
    <main class="grow py-6">
      <slot />
    </main>

    <Footer />
  </div>
</template>

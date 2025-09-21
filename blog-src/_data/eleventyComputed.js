module.exports = {
  eleventyComputed: {
    ogImage: (data) => {
      try {
        const isPost = (data.page?.inputPath || "").includes("/posts/");
        if (!isPost) return data.ogImage;
        const base = (data.config?.site?.origin) || "https://luggage-scale.com";
        return `${base}/blog/og/${data.page.fileSlug}.png`;
      } catch {
        return data.ogImage;
      }
    }
  }
};

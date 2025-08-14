import https from "https";
import { MetadataRoute } from "next";

function fetchIdsFromApi(apiUrl: string): Promise<string[]> {
  return new Promise((resolve) => {
    https.get(apiUrl, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          // Expecting an array of objects with 'id' property
          if (Array.isArray(json)) {
            resolve(json.map((item: any) => item.id).filter(Boolean));
          } else if (json && Array.isArray(json.items)) {
            resolve(json.items.map((item: any) => item.id).filter(Boolean));
          } else {
            resolve([]);
          }
        } catch {
          resolve([]);
        }
      });
    }).on("error", () => resolve([]));
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://statepulse.me";
  const staticRoutes = [
    "",
    "/dashboard",
    "/legislation",
    "/tracker",
    "/representatives",
    "/posts",
    "/summaries",
    "/civic",
    "/about",
    "/privacy",
    "/terms",
  ];

  // Fetch dynamic IDs from API endpoints
  const [legislationIds, postIds, representativeIds, summaryIds] = await Promise.all([
    fetchIdsFromApi("https://statepulse.me/api/legislation"),
    fetchIdsFromApi("https://statepulse.me/api/posts"),
    fetchIdsFromApi("https://statepulse.me/api/representatives"),
  ]);

  const dynamicLegislationRoutes = legislationIds.map(id => ({
    url: `${baseUrl}/legislation/${id}`,
    lastModified: new Date().toISOString(),
    changeFrequency: "weekly",
    priority: 0.9,
  }));
  const dynamicPostRoutes = postIds.map(id => ({
    url: `${baseUrl}/posts/${id}`,
    lastModified: new Date().toISOString(),
    changeFrequency: "weekly",
    priority: 0.7,
  }));
  const dynamicRepresentativeRoutes = representativeIds.map(id => ({
    url: `${baseUrl}/representatives/${id}`,
    lastModified: new Date().toISOString(),
    changeFrequency: "weekly",
    priority: 0.9,
  }));

  return [
    ...staticRoutes.map((route) => ({
      url: `${baseUrl}${route}`,
      lastModified: new Date().toISOString(),
      changeFrequency: "weekly",
      priority:
        route === "" ? 1.0 :
        ["/dashboard", "/legislation", "/tracker", "/representatives"].includes(route) ? 0.9 :
        ["/posts", "/summaries", "/civic"].includes(route) ? 0.7 :
        ["/about"].includes(route) ? 0.6 :
        0.5,
    })),
    ...dynamicLegislationRoutes,
    ...dynamicPostRoutes,
    ...dynamicRepresentativeRoutes,
  ];
}

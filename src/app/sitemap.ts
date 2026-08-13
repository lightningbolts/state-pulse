import { MetadataRoute } from "next";
import { getCollection } from "@/lib/mongodb";

export const revalidate = 3600;

const BASE_URL = "https://statepulse.me";

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

async function fetchRecentIds(collectionName: string, limit: number): Promise<string[]> {
  try {
    const collection = await getCollection(collectionName);
    const docs = await collection
      .find(
        { id: { $exists: true, $nin: [null, ""] } },
        { projection: { id: 1, _id: 0 } },
      )
      .sort({ latestActionAt: -1, updatedAt: -1, createdAt: -1 })
      .limit(limit)
      .toArray();
    return docs.map((doc) => doc.id).filter(Boolean);
  } catch (error) {
    console.error(`Sitemap: failed to load ${collectionName} ids`, error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [legislationIds, postIds, representativeIds] = await Promise.all([
    fetchRecentIds("legislation", 1000),
    fetchRecentIds("posts", 200),
    fetchRecentIds("representatives", 2000),
  ]);

  const lastModified = new Date();

  return [
    ...staticRoutes.map((route) => ({
      url: `${BASE_URL}${route}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority:
        route === "" ? 1.0 :
        ["/dashboard", "/legislation", "/tracker", "/representatives"].includes(route) ? 0.9 :
        ["/posts", "/summaries", "/civic"].includes(route) ? 0.7 :
        ["/about"].includes(route) ? 0.6 :
        0.5,
    })),
    ...legislationIds.map((id) => ({
      url: `${BASE_URL}/legislation/${id}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    ...postIds.map((id) => ({
      url: `${BASE_URL}/posts/${id}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...representativeIds.map((id) => ({
      url: `${BASE_URL}/representatives/${id}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
  ];
}

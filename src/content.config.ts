import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const articles = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/articles" }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    author: z.string().min(1).optional(),
    translator: z.string().min(1).optional(),
    tags: z.array(z.string().min(1)).default([]),
    cover: z.string().url().optional(),
    draft: z.boolean().default(false)
  })
});

export const collections = { articles };

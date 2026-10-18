export const SITE = {
  name: "Ark拾页",
  description: "一个安静的阅读与写作空间。",
  locale: "zh-CN",
  footer: {
    github: {
      label: "arkhorizon",
      href: "https://github.com/arkhorizon"
    },
    wechat: {
      value: import.meta.env.PUBLIC_WECHAT_NAME || "Ark视界",
      href: import.meta.env.PUBLIC_WECHAT_URL || "",
      qr: import.meta.env.PUBLIC_WECHAT_QR_URL || "/contact/wechat-ark-vision.jpg"
    }
  }
};

export const CATEGORIES = {
  "personal-blog": {
    title: "个人博客",
    description: "个人文章与日常记录。"
  },
  "foreign-literature": {
    title: "国外文学",
    description: "国外小说与经典作品。"
  },
  "chinese-literature": {
    title: "中国文学",
    description: "中国小说与经典作品。"
  }
} as const;

export type CategorySlug = keyof typeof CATEGORIES;

export function isCategorySlug(value: string): value is CategorySlug {
  return Object.hasOwn(CATEGORIES, value);
}

export function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai"
  }).format(value);
}

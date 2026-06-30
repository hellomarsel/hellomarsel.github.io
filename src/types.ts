export type Language = 'EN' | 'RU';

export interface Localized<T> {
  EN: T;
  RU: T;
}

export interface Testimonial {
  name: string;
  role?: string;
  text?: string;
  image?: string;
  order?: number;
  translations?: Localized<{
    text: string;
    role: string;
  }>;
}

export interface Project {
  id?: string;
  title: string;
  category: string;
  image: string;
  link: string;
  order?: number;
  // Support for translations if available
  translations?: Localized<{
    title: string;
    category: string;
  }>;
}

export interface ShopProduct {
  id?: string;
  title: string;
  description: string;
  price: string;
  image: string;
  link: string;
  order?: number;
  translations?: Localized<{
    title: string;
    description: string;
    price: string;
  }>;
}

export interface Service {
  title: string;
  description: string;
}

export interface PricingItem {
  id: string;
  title: string;
  price: string;
  features: string[];
  cta: string;
  time?: string;
  details?: string;
}

export interface ContactModalContent {
  title: string;
  name: string;
  email: string;
  projectType: string;
  projectTypes: string[];
  budget: string;
  budgetOptions: string[];
  message: string;
  send: string;
  sending: string;
  success: string;
  error: string;
  close: string;
  formImage?: string;
}

export interface Hero {
  title: string;
  subtitle: string;
  viewProjects: string;
  contact: string;
  buttonOrder?: string[];
  backgroundImageDesktop?: string;
  backgroundImageMobile?: string;
  backgroundVideoDesktop?: string;
  backgroundVideoMobile?: string;
}

export interface RoadmapItem {
  year: string;
  title: string;
  company: string;
  description: string;
  image?: string;
  translations?: Localized<{
    title: string;
    company: string;
    description: string;
  }>;
}

export interface FAQItem {
  question: string;
  answer: string;
  translations?: Localized<{
    question: string;
    answer: string;
  }>;
}

export interface PricingSection {
  num: string;
  title: string;
  description: string;
  items: PricingItem[];
  note?: string;
}

export interface PriceData {
  title: string;
  subtitle: string;
  contactBtn: string;
  sections: PricingSection[];
  extra: {
    title: string;
    items: { name: string; price: string; desc?: string }[];
  };
  terms: {
    title: string;
    blocks: { title: string; items: string[] }[];
  };
}

export interface Content {
  branding?: Branding;
  nav: {
    about: string;
    experience: string;
    work: string;
    pricing: string;
    shop: string;
    testimonials: string;
    faq: string;
    contact: string;
  };
  hero: Hero;
  clients: {
    title: string;
    logos: string[];
  };
  testimonials: {
    title: string;
    intro: string;
    items: Testimonial[];
  };
  about: {
    title: string;
    intro: string;
    text: string;
    stats: {
      label: string;
      value: string;
    }[];
    quote?: string;
    stackTitle: string;
    stack: string[];
    toolsTitle: string;
    tools: string[];
    photo?: string;
    photos?: string[];
  };
  roadmap: {
    title: string;
    items: RoadmapItem[];
  };
  pricing?: {
    title: string;
    items: PricingItem[];
  };
  priceData?: PriceData; // New field for the comprehensive price list
  shop: {
    title: string;
    items: ShopProduct[];
    buyNow: string;
    viewAll: string;
  };
  work: {
    title: string;
    projects: Project[];
    dribbbleProjects?: Project[];
    loadMore: string;
  };
  faq: {
    title: string;
    items: FAQItem[];
  };
  contact: {
    title: string;
    cta: string;
    email: string;
    socials: {
      name: string;
      link: string;
    }[];
    requestProject: string;
    mobileMenuSocials?: string[];
    contactSocialColumns?: number;
    modal: ContactModalContent;
  };
  footer: {
    rights: string;
  };
}

export interface Branding {
  socialIcons?: Record<string, string>;
  buttonIcons?: Record<string, string>;
  preloaderLogo?: string;
}

export interface SeoSettings {
  siteTitle: string;
  faviconUrl: string;
  seoDescription: string;
  seoKeywords: string;
  ogImage: string;
  ogTitle: string;
  ogDescription: string;
}

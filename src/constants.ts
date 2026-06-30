import { Content, SeoSettings, Language, Localized, Testimonial, RoadmapItem, PricingItem, ShopProduct, FAQItem, PriceData } from './types';

// ==========================================
// 1. VISUAL ASSETS (GROUPED BY SECTION)
// ==========================================

export const ASSETS = {
  // Brand & Navigation
  LOGO_URL: '/materials/logo.svg',
  LOGO_LINK: 'https://t.me/marselspace',
  PRELOADER_LOGOTYPE: '/materials/logotype.svg',
  FAVICON: '/materials/logo.svg',
  OG_IMAGE: '/materials/banner-ceo.png',

  // Icons
  SOCIAL_ICONS: {
    Telegram: '/icons/Telegram.svg',
    Instagram: '/icons/Instagram.svg',
    Behance: '/icons/Behance.svg',
    Dribbble: '/icons/Dribbble.svg',
    Twitter: '/icons/Twitter.svg',
    Threads: '/icons/Threads.svg',
    TikTok: '/icons/TikTok.svg',
    YouTube: '/icons/YouTube.svg',
  },

  // Hero Section
  HERO: {
    BG_DESKTOP: '/hero/pc_background.png',
    BG_MOBILE: '/hero/mobile_background.png',
  },

  // Pricing Section
  PRICING: {
    HEADER: '/price/pc_background_price.png',
  },

  // About Section
  ABOUT: {
    AVATAR_PRIMARY: '/about/avatar.jpg',
    AVATAR_LIST: ['/about/avatar.jpg', '/materials/Avatar2.jpg'],
  },

  // Experience (Roadmap) Section
  EXPERIENCE: {
    ITEM_1: '/materials/card1.png',
    ITEM_2: '/materials/card2.png',
    ITEM_3: '/materials/card3.png',
    ITEM_4: '/materials/card4.png',
  },

  // Shop Section
  SHOP: {
    TEXT_STYLES: '/shop/text-styles.png',
    BRUSH_PACK: '/shop/brush-pack.png',
    EFFECTS_PACK: '/shop/effects-pack.png',
  },

  // Client Logos
  CLIENTS: [
    '/clients/Colizeum.png',
    '/clients/Hookah_place.png',
    '/clients/INDASTRUM.png',
    '/clients/Irstone.png',
    '/clients/TOF.png',
    '/clients/Vremya.png',
    '/clients/Gleb_Solomin.png',
    '/clients/ZGSK.png'
  ],
};

// ==========================================
// 2. SEO & GLOBAL SETTINGS
// ==========================================

export const seoSettings: SeoSettings = {
  siteTitle: 'Hello, Marsel',
  faviconUrl: ASSETS.FAVICON,
  seoDescription: 'Multi-Designer specializing in branding, web design, and creative visuals.',
  seoKeywords: 'portfolio, designer, visual identity, creative design, web design, branding, graphic design, UI UX',
  ogImage: ASSETS.OG_IMAGE,
  ogTitle: 'Hello, Marsel',
  ogDescription: 'Designing brands, websites, and creative visuals.'
};

export const logoUrl = ASSETS.LOGO_URL;
export const logoLink = ASSETS.LOGO_LINK;

const BRANDING_CONFIG = {
  preloaderLogo: ASSETS.PRELOADER_LOGOTYPE,
  socialIcons: ASSETS.SOCIAL_ICONS,
  buttonIcons: {
    ViewProjects: '',
    Contact: '',
    Request: '',
    Email: '',
  },
};

const CONTACT_LINKS = {
  email: 'heymarsel@gmail.com',
  socials: [
    { name: 'Behance', link: 'https://www.behance.net/hellomarsel' },
    { name: 'Dribbble', link: 'http://dribbble.com/hellomarsel' },
    { name: 'Telegram', link: 'https://t.me/hellomarsel' },
    { name: 'Instagram', link: 'https://www.instagram.com/hellomarsel/' },
    { name: 'Twitter', link: 'https://x.com/Hellomarsel' },
    { name: 'Threads', link: 'https://www.threads.com/@hellomarsel' },
    { name: 'TikTok', link: 'https://www.tiktok.com/@helllomarsel' },
    { name: 'YouTube', link: 'https://www.youtube.com/@HelloMarsel' },
  ],
  mobileMenuSocials: ['Behance', 'Telegram', 'Instagram', 'Twitter', 'Threads', 'YouTube'],
};

// ==========================================
// 3. INTERNAL DATA SOURCES
// ==========================================

const TESTIMONIALS_SOURCE: (Testimonial & { translations: Localized<{ text: string; role: string }> })[] = [
  {
    name: 'Alex Rivera',
    translations: {
      EN: { role: 'Creative Director', text: 'Michael is a rare talent who seamlessly combines technical precision with deep artistic vision. His work on our branding was truly transformative.' },
      RU: { role: 'Креативный директор', text: 'Михаил — редкий специалист, который потрясающе сочетает техническую точность и художественное видение. Его работа над нашим брендингом полностью изменила восприятие компании.' }
    }
  },
  {
    name: 'Sarah Chen',
    translations: {
      EN: { role: 'Startup Founder', text: 'Partnering with Marsel was the best decision for our product launch. The web design is incredibly clean, fast, and highly intuitive.' },
      RU: { role: 'Основатель стартапа', text: 'Сотрудничество с Марселем стало лучшим решением для запуска нашего продукта. Веб-дизайн получился чистым, быстрым и невероятно интуитивным.' }
    }
  },
  {
    name: 'James Wilson',
    translations: {
      EN: { role: 'Marketing Manager', text: 'Exceptional attention to detail. Michael delivered a sophisticated visual identity that perfectly captures our core brand essence.' },
      RU: { role: 'Маркетинг-менеджер', text: 'Невероятное внимание к деталям. Михаил разработал визуальную айдентику, которая идеально отражает философию и суть нашего бренда.' }
    }
  },
  {
    name: 'Elena Gilbert',
    translations: {
      EN: { role: 'Product Owner', text: 'The infographics Michael designed for our annual report were beautiful and successfully made complex data easy to digest for our stakeholders.' },
      RU: { role: 'Владелец продукта', text: 'Инфографика, которую Михаил разработал для нашего годового отчета, получилась не просто красивой, но и помогла легко преподнести сложные аналитические данные.' }
    }
  },
  {
    name: 'David Miller',
    translations: {
      EN: { role: 'Art Director', text: 'A true professional. Michael’s ability to adapt to diverse styles while maintaining absolute quality is impressive.' },
      RU: { role: 'Арт-директор', text: 'Настоящий профи. Способность Михаила быстро адаптироваться под разные стили, сохраняя безупречное качество, действительно впечатляет.' }
    }
  }
];

const ROADMAP_SOURCE: RoadmapItem[] = [
  {
    year: '2023',
    image: ASSETS.EXPERIENCE.ITEM_1,
    company: 'Self-employed',
    translations: {
      EN: { title: 'Freelance Designer', company: 'Self-employed', description: 'Started my path in design. Made creative visuals for local brands and small businesses.' },
      RU: { title: 'Дизайнер-фрилансер', company: 'Самозанятый', description: 'Начал свой путь в дизайне. Делал креативный визуал для локальных брендов и малого бизнеса.' }
    },
    title: '', description: ''
  },
  {
    year: '2024',
    image: ASSETS.EXPERIENCE.ITEM_2,
    company: 'Freelance',
    translations: {
      EN: { title: 'Junior Graphic Designer', company: 'Freelance', description: 'Gained more experience in typography and layouts while working on various freelance projects.' },
      RU: { title: 'Junior графический дизайнер', company: 'Фриланс', description: 'Стал глубже работать с типографикой и версткой, брал более интересные заказы на фрилансе.' }
    },
    title: '', description: ''
  },
  {
    year: '2025',
    image: ASSETS.EXPERIENCE.ITEM_3,
    company: 'Marsel Creative',
    translations: {
      EN: { title: 'Middle Graphic Designer', company: 'Marsel Creative', description: 'Led branding projects and created complete visual styles for young brands.' },
      RU: { title: 'Middle графический дизайнер', company: 'Marsel Creative', description: 'Вел проекты по брендингу и создавал фирменные стили для молодых компаний.' }
    },
    title: '', description: ''
  },
  {
    year: '2026',
    image: ASSETS.EXPERIENCE.ITEM_4,
    company: 'VA COM',
    translations: {
      EN: { title: 'Strong Middle Graphic Designer', company: 'VA COM', description: 'Currently working on design strategies and creative concepts for big international campaigns.' },
      RU: { title: 'Strong Middle графический дизайнер', company: 'VA COM', description: 'Сейчас придумываю дизайн-стратегии и креативные концепты для крупных международных кампаний.' }
    },
    title: '', description: ''
  }
];

const FAQ_SOURCE: FAQItem[] = [
  {
    translations: {
      EN: { question: 'Who is a multi-designer and how does that benefit me?', answer: 'A multi-designer is a specialist who handles multiple disciplines: from logos and identity to web interfaces, presentations, and print graphics. You do not need to hire different designers for different assets. I build a unified, coherent visual ecosystem for your brand, saving your time, budget, and preventing stylistic mismatch.' },
      RU: { question: 'Кто такой мульти-дизайнер и чем это выгодно для меня?', answer: 'Мульти-дизайнер — это специалист, который закрывает сразу несколько направлений: от логотипа и айдентики до веб-интерфейсов, презентаций и графики. Вам не нужно искать отдельного дизайнера для сайта, отдельного для соцсетей и для презентаций. Я создаю единую, цельную визуальную экосистему для вашего бренда, что экономит ваше время, бюджет и исключает рассинхрон в стиле.' }
    },
    question: '', answer: ''
  },
  {
    translations: {
      EN: { question: 'How long does a project typically take?', answer: 'Timelines depend on the scope. A logo or presentation takes 5 to 10 business days. Comprehensive branding or a complex multi-page website design takes 2 to 4 weeks. I always specify the final delivery dates before we start, right after discussing the project brief.' },
      RU: { question: 'Сколько времени обычно занимает разработка проекта?', answer: 'Сроки зависят от масштаба. Разработка логотипа или презентации занимает от 5 до 10 рабочих дней. Комплексная айдентика (брендинг) или дизайн сложного многостраничного сайта — от 2 до 4 недель. Я всегда обозначаю финальные сроки до начала работы после обсуждения ТЗ.' }
    },
    question: '', answer: ''
  },
  {
    translations: {
      EN: { question: 'What is included in the price and are revisions included?', answer: 'Every service includes in-depth research, concept development, and the preparation of all required assets (web, print). The base price already includes 2 comprehensive rounds of feedback during the concept refinement stage to perfect the selected direction — more details in the price list.' },
      RU: { question: 'Что входит в стоимость и включены ли туда правки?', answer: 'В стоимость каждой услуги входит детальное исследование, разработка концепций и подготовка всех необходимых для работы форматов (веб, печать). В базовую цену уже включены 2 полноценных круга правок на этапе согласования выбранной концепции — подробнее в прайсе.' }
    },
    question: '', answer: ''
  },
  {
    translations: {
      EN: { question: 'In which formats will I receive the final source files?', answer: 'All project source files are provided for an additional fee. You will receive fully ready-to-use or print-ready files, while working source assets in vector, Figma, or PSD formats can be purchased separately — more details in the price list.' },
      RU: { question: 'В каком формате я получу готовые исходники?', answer: 'Все готовые проекты передаются в полностью пригодных для использования и печати форматах. Рабочие же исходники (исходники в векторе, макеты Figma, PSD со слоями) предоставляются за дополнительную плату — подробнее в прайсе.' }
    },
    question: '', answer: ''
  },
  {
    translations: {
      EN: { question: 'What if I do not have a clear project brief?', answer: 'That is completely fine. We can start with a brief video call or I can send you an interactive questionnaire. Together, we will establish project goals, identify the target audience, select the right formats, and write a clear, actionable brief to achieve flawless results.' },
      RU: { question: 'Что делать, если у меня нет четкого ТЗ (технического задания)?', answer: 'Это абсолютно нормально. Мы можем начать прямо со звонка-брифинга или я пришлю вам интерактивный опросник. Вместе мы сформулируем цели проекта, определим целевую аудиторию, выберем правильные форматы и составим четкое техническое задание для идеального результата.' }
    },
    question: '', answer: ''
  }
];

const SHOP_SOURCE: ShopProduct[] = [
  {
    image: ASSETS.SHOP.TEXT_STYLES,
    link: 'https://pay.hellomarsel.com/text-styles',
    translations: {
      EN: { title: 'Text Styles Pack', description: 'Ready-to-use premium text styles to speed up your creative workflow in Photoshop.', price: '$55' },
      RU: { title: 'Text Styles Pack', description: 'Готовые качественные текстовые стили для ускорения вашей работы в Photoshop.', price: '5 500 ₽' }
    },
    title: '', description: '', price: ''
  },
  {
    image: ASSETS.SHOP.BRUSH_PACK,
    link: 'https://pay.hellomarsel.com/brush-pack',
    translations: {
      EN: { title: 'Brush Pack', description: 'Expressive Photoshop brush pack for digital painting and textures.', price: '$45' },
      RU: { title: 'Brush Pack', description: 'Набор выразительных кистей для рисунка и создания текстур в Photoshop.', price: '4 500 ₽' }
    },
    title: '', description: '', price: ''
  },
  {
    image: ASSETS.SHOP.EFFECTS_PACK,
    link: 'https://pay.hellomarsel.com/effects-pack',
    translations: {
      EN: { title: 'Effects Pack', description: 'Professional overlays and effects for Adobe Photoshop.', price: '$65' },
      RU: { title: 'Effects Pack', description: 'Профессиональный набор эффектов для наложения в Photoshop.', price: '6 500 ₽' }
    },
    title: '', description: '', price: ''
  }
];

const PRICING_SOURCE: (PricingItem & { translations: Localized<{ title: string; price: string }> })[] = [
  {
    id: 'graphic',
    features: ['Logo Design', 'Poster & Print', 'Typography', 'Visual Systems'],
    cta: '',
    translations: {
      EN: { title: 'Graphic Design', price: 'from $300' },
      RU: { title: 'Графический дизайн', price: 'от 12 000 ₽' }
    },
    title: '', price: ''
  },
  {
    id: 'branding',
    features: ['Brand Guidelines', 'Color Palette', 'Typography Systems', 'Social Media Assets'],
    cta: '',
    translations: {
      EN: { title: 'Branding', price: 'from $900' },
      RU: { title: 'Брендинг', price: 'от 35 000 ₽' }
    },
    title: '', price: ''
  },
  {
    id: 'web',
    features: ['UI/UX Design', 'Figma Wireframes', 'Responsive Websites', 'Developer Handoff'],
    cta: '',
    translations: {
      EN: { title: 'Web Design', price: 'from $600' },
      RU: { title: 'Веб-дизайн', price: 'от 25 000 ₽' }
    },
    title: '', price: ''
  }
];

// Localized helper
const mapLocalized = <T extends { translations?: Localized<Record<string, unknown>> }>(source: T[], lang: Language) => {
  return source.map(item => ({
    ...item,
    ...(item.translations ? item.translations[lang] : {})
  }));
};

// ==========================================
// 4. THE MASTER CONTENT OBJECT
// ==========================================

export const content: Record<Language, Content> = {
  EN: {
    branding: BRANDING_CONFIG,
    nav: {
      about: 'About',
      experience: 'Experience',
      testimonials: 'Reviews',
      work: 'Projects',
      faq: 'FAQ',
      pricing: 'Pricing',
      shop: 'Shop',
      contact: 'Contact',
    },
    hero: {
      title: 'MICHAEL\nMARSEL',
      subtitle: 'Multi-Designer / Graphic & Web Designer\nDesigning brands, websites, and creative visuals.',
      viewProjects: 'View Projects',
      contact: 'Contact Me',
      backgroundImageDesktop: ASSETS.HERO.BG_DESKTOP,
      backgroundImageMobile: ASSETS.HERO.BG_MOBILE,
    },
    clients: {
      title: 'Worked with',
      logos: ASSETS.CLIENTS,
    },
    about: {
      title: 'About',
      intro: 'Michael Marsel — Multi-Designer.',
      text: 'I’m a Multi-Designer / Graphic & Web Designer working at the intersection of branding, graphics, interfaces, presentations, websites, and social media design. I combine creativity and a clean workflow to deliver a result that works perfectly for your goals.',
      stats: [
        { label: 'Years', value: '3+' },
        { label: 'Projects', value: '180+' },
        { label: 'Clients', value: '130+' },
        { label: 'Coffee', value: '∞' },
      ],
      quote: "Design is not just what it looks like and feels like. Design is how it works.",
      stackTitle: 'Focus',
      stack: ['UX/UI Design', 'Branding', 'Graphic Design', 'Web Design', 'Infographics', 'SMM', 'Presentation Design'],
      toolsTitle: 'Tools',
      tools: ['Figma', 'Adobe Photoshop', 'Adobe Illustrator', 'Adobe After Effects', 'Framer', 'Blender', 'Canva'],
      photo: ASSETS.ABOUT.AVATAR_PRIMARY,
      photos: ASSETS.ABOUT.AVATAR_LIST,
    },
    roadmap: {
      title: 'Experience',
      items: mapLocalized(ROADMAP_SOURCE, 'EN')
    },
    testimonials: {
      title: 'Reviews',
      intro: 'What my clients say\nabout our work.',
      items: mapLocalized(TESTIMONIALS_SOURCE, 'EN'),
    },
    work: {
      title: 'Projects',
      projects: [],
      loadMore: 'Load More',
    },
    shop: {
      title: 'Shop',
      buyNow: 'Buy Now',
      viewAll: 'View All',
      items: mapLocalized(SHOP_SOURCE, 'EN')
    },
    pricing: {
      title: 'Pricing',
      items: mapLocalized(PRICING_SOURCE, 'EN').map(i => ({ ...i, cta: 'Get Started' }))
    },
    faq: {
      title: 'FAQ',
      items: mapLocalized(FAQ_SOURCE, 'EN')
    },
    contact: {
      ...CONTACT_LINKS,
      title: 'Contact',
      cta: "LET'S\nWORK\nTOGETHER",
      requestProject: 'Request a Project',
      modal: {
        title: 'START A PROJECT',
        name: 'YOUR NAME',
        email: 'YOUR EMAIL',
        projectType: 'PROJECT TYPE',
        projectTypes: ['Web Design', 'Web Development', 'Mobile App', 'Branding', 'Graphic Design', 'SEO & Marketing', 'Social Media', 'UI/UX Design', 'Other'],
        budget: 'BUDGET',
        budgetOptions: ['< $200', '$200 - $500', '$500 - $700', '$700 - $1,000', '$1,000 - $3,000', '$3,000 - $5,000', '$5,000+'],
        message: 'TELL ME ABOUT YOUR PROJECT',
        send: 'SEND REQUEST',
        sending: 'SENDING...',
        success: 'THANK YOU! I WILL GET BACK TO YOU SOON.',
        error: 'SOMETHING WENT WRONG. PLEASE TRY AGAIN.',
        close: 'CLOSE',
      },
    },
    footer: {
      rights: '© 2026 All Rights Reserved',
    },
  },
  RU: {
    branding: BRANDING_CONFIG,
    nav: {
      about: 'Обо мне',
      experience: 'Опыт',
      testimonials: 'Отзывы',
      work: 'Проекты',
      faq: 'FAQ',
      pricing: 'Цены',
      shop: 'Магазин',
      contact: 'Контакты',
    },
    hero: {
      title: 'MICHAEL\nMARSEL',
      subtitle: 'Multi-Designer / Graphic & Web Designer\nСоздаю брендинг, сайты и креативный визуал.',
      viewProjects: 'Мои проекты',
      contact: 'Связаться',
      backgroundImageDesktop: ASSETS.HERO.BG_DESKTOP,
      backgroundImageMobile: ASSETS.HERO.BG_MOBILE,
    },
    clients: {
      title: 'Работал с',
      logos: ASSETS.CLIENTS,
    },
    about: {
      title: 'Обо мне',
      intro: 'Михаил Марсель — Мульти-дизайнер.',
      text: 'Я мульти-дизайнер. Делаю брендинг, графику, интерфейсы, презентации, сайты и оформление для соцсетей. Совмещаю творческий подход и порядок в работе, чтобы ваш проект выглядел отлично и решал свои задачи.',
      stats: [
        { label: 'года опыта', value: '3+' },
        { label: 'Проектов', value: '180+' },
        { label: 'Клиентов', value: '130+' },
        { label: 'Кофе', value: '∞' },
      ],
      quote: "Дизайн — это не то, как предмет выглядит, а то, как он работает.",
      stackTitle: 'Направления',
      stack: ['UX/UI Дизайн', 'Брендинг', 'Графический дизайн', 'Веб-дизайн', 'Инфографика', 'SMM', 'Дизайн презентаций'],
      toolsTitle: 'Инструменты',
      tools: ['Figma', 'Adobe Photoshop', 'Adobe Illustrator', 'Adobe After Effects', 'Framer', 'Blender', 'Canva'],
      photo: ASSETS.ABOUT.AVATAR_PRIMARY,
      photos: ASSETS.ABOUT.AVATAR_LIST,
    },
    roadmap: {
      title: 'Опыт работы',
      items: mapLocalized(ROADMAP_SOURCE, 'RU')
    },
    testimonials: {
      title: 'Отзывы',
      intro: 'Что говорят мои клиенты\nо нашей совместной работе.',
      items: mapLocalized(TESTIMONIALS_SOURCE, 'RU'),
    },
    work: {
      title: 'Проекты',
      projects: [],
      loadMore: 'Смотреть еще',
    },
    shop: {
      title: 'Магазин',
      buyNow: 'Купить',
      viewAll: 'Смотреть все',
      items: mapLocalized(SHOP_SOURCE, 'RU')
    },
    pricing: {
      title: 'Цены',
      items: mapLocalized(PRICING_SOURCE, 'RU').map(i => ({ ...i, cta: 'Начать' }))
    },
    faq: {
      title: 'FAQ',
      items: mapLocalized(FAQ_SOURCE, 'RU')
    },
    contact: {
      ...CONTACT_LINKS,
      title: 'Контакты',
      cta: 'ОБСУДИМ\nВАШ\nПРОЕКТ',
      requestProject: 'Оставить заявку',
      modal: {
        title: 'ОСТАВИТЬ ЗАЯВКУ',
        name: 'ВАШЕ ИМЯ',
        email: 'ВАШ EMAIL',
        projectType: 'ТИП ПРОЕКТА',
        projectTypes: ['Веб-дизайн', 'Веб-разработка', 'Мобильное приложение', 'Брендинг', 'Графический дизайн', 'SEO и Маркетинг', 'SMM', 'UI/UX Дизайн', 'Другое'],
        budget: 'БЮДЖЕТ',
        budgetOptions: ['< 10 000 ₽', '10 000 - 50 000 ₽', '50 000 - 70 000 ₽', '70 000 - 100 000 ₽', '100 000 - 300 000 ₽', '300 000 - 500 000 ₽', '500 000 ₽+'],
        message: 'ОПИШИТЕ ВАШ ПРОЕКТ',
        send: 'ОТПРАВИТЬ ЗАЯВКУ',
        sending: 'ОТПРАВКА...',
        success: 'СПАСИБО! Я СВЯЖУСЬ С ВАМИ В БЛИЖАЙШЕЕ ВРЕМЯ.',
        error: 'ЧТО-ТО ПОШЛО НЕ ТАК. ПОПРОБУЙТЕ СНОВА.',
        close: 'ЗАКРЫТЬ',
      },
    },
    footer: {
      rights: '© 2026 Все права защищены',
    },
  },
};

// ==========================================
// 5. PRICE LIST DATA
// ==========================================

export const priceData: Record<Language, PriceData> = {
  RU: {
    title: "Прайс-лист",
    subtitle: "Создаю визуальные решения, которые решают задачи бизнеса и радуют глаз. Ниже указаны базовые цены — итоговая стоимость зависит от масштаба и сложности проекта.",
    contactBtn: "Заказать проект",
    sections: [
      {
        num: "01",
        title: "Графический дизайн и Брендинг",
        description: "Визуальный язык вашего проекта. Помогаю выделиться, создать правильное впечатление и запомниться аудитории.",
        items: [
          { id: "logo", title: "Логотип", price: "от 12 000 ₽", time: "2–5 дней", details: "Создание уникального и запоминающегося знака для вашего бренда.", features: ["2-3 концепта на выбор", "Все форматы для печати и веба (PNG, SVG, PDF)", "2 круга правок включено"], cta: "" },
          { id: "identity", title: "Фирменный стиль под ключ", price: "от 35 000 ₽", time: "5–10 дней", details: "Полная визуальная система бренда: от логотипа до фирменных носителей.", features: ["Логотип и его вариации", "Цветовая палитра и шрифтовая пара", "Базовый гайдлайн по использованию стиля"], cta: "" },
          { id: "presentation", title: "Дизайн презентаций", price: "от 5 000 ₽", time: "2–4 дня", details: "Стильные и аккуратные слайды, которые помогают защищать идеи и продавать.", features: ["Инфографика и графики под ваши данные", "Выдержанный фирменный стиль", "Удобные форматы PDF или PPTX"], cta: "" },
          { id: "poster", title: "Плакаты и полиграфия", price: "от 4 000 ₽", time: "1–2 дня", details: "Афиши, постеры, визитки и листовки, привлекающие внимание.", features: ["Дизайн под вашу целевую аудиторию", "Файлы, полностью готовые к печати", "2 круга правок"], cta: "" }
        ]
      },
      {
        num: "02",
        title: "Веб-дизайн и интерфейсы",
        description: "Удобные и современные макеты в Figma, которые связывают ваш продукт с пользователем.",
        items: [
          { id: "landing", title: "Дизайн лендинга", price: "от 25 000 ₽", time: "3–7 дней", details: "Одностраничный сайт с продуманной структурой для презентации продукта или услуги.", features: ["Figma-макет, готовый к верстке", "Адаптивные версии (Desktop + Mobile)", "2 круга правок включено"], cta: "" },
          { id: "fullweb", title: "Полный дизайн сайта", price: "от 45 000 ₽", time: "7–14 дней", details: "Многостраничный сайт с проработанной навигацией и единым стилем.", features: ["Дизайн всех ключевых страниц", "Продуманная структура и UX-логика", "Полный адаптив под экраны смартфонов"], cta: "" },
          { id: "uxui", title: "UI/UX и приложения", price: "от 45 000 ₽", time: "10–20 дней", details: "Проектирование и дизайн мобильных приложений и сложных интерфейсов.", features: ["Продуманная логика переходов", "Современная дизайн-система и UI-кит", "Подготовка всех макетов для разработчиков"], cta: "" }
        ]
      },
      {
        num: "03",
        title: "Социальные сети и инфографика",
        description: "Делаю ваш контент профессиональным, ярким и запоминающимся в ленте.",
        items: [
          { id: "smm", title: "Пакет оформления соцсетей", price: "от 8 000 ₽", time: "1–3 дня", details: "Комплексный дизайн профиля под ключ (Telegram, Instagram, YouTube, VK или Twitch).", features: ["Аватар и баннер/обложка", "Шаблоны для постов и Stories", "2 круга правок для доработки деталей"], cta: "" },
          { id: "infographics", title: "Инфографика для маркетплейсов", price: "от 8 000 ₽", time: "2–3 дня", details: "Продающие карточки для Wildberries или Ozon, которые выделяются среди конкурентов.", features: ["Обложка с фокусом на преимущества", "4 информативных слайда с характеристиками", "Выдержанный и аккуратный стиль"], cta: "" }
        ]
      }
    ],
    extra: {
      title: "Дополнительно",
      items: [
        { name: "Срочное выполнение", price: "+50% к стоимости проекта", desc: "Ускоренный режим работы без потери качества." },
        { name: "Исходники и форматы", price: "от 1 500 ₽", desc: "Передача рабочих исходных файлов в векторе, Figma или PSD (по запросу)." },
        { name: "Дополнительные правки", price: "+40% от стоимости услуги", desc: "2 круга правок уже включены в цену. Последующие правки оплачиваются отдельно." }
      ]
    },
    terms: {
      title: "Оплата и правила работы",
      blocks: [
        { title: "Способы оплаты", items: ["Tinkoff Bank (Предпочтительно)", "Sber Bank", "Криптовалюта (USDT / TON)"] },
        { title: "Условия и правила", items: ["Предоплата 100% перед началом работы", "Оплата подтверждает согласие с ТЗ и сроками", "Материалы отдаю в полном объеме после окончательного утверждения"] }
      ]
    }
  },
  EN: {
    title: "Price List",
    subtitle: "I create visual solutions that achieve goals and delight users. Below are the base rates — the final cost depends on the scope of the project.",
    contactBtn: "Book a Project",
    sections: [
      {
        num: "01",
        title: "Graphic Design & Branding",
        description: "The visual language of your project. Helping your brand stand out, leave an impression, and connect with your audience.",
        items: [
          { id: "logo", title: "Logo Design", price: "from $300", time: "2–5 days", details: "Creating a unique and memorable symbol representing your brand.", features: ["2-3 original concept directions", "All high-res print & web files (PNG, SVG, PDF)", "2 rounds of edits included"], cta: "" },
          { id: "identity", title: "Brand Identity Kit", price: "from $900", time: "5–10 days", details: "A comprehensive visual system built from scratch to launch your brand.", features: ["Main logo & alternative layouts", "Consistent color scheme & typography", "Basic visual style guidelines"], cta: "" },
          { id: "presentation", title: "Presentation Design", price: "from $150", time: "2–4 days", details: "Clean, professional slides designed to help you pitch ideas and sell products.", features: ["Custom graphics & data visualization", "Consistent brand styling", "Easy-to-use PDF & PPTX formats"], cta: "" },
          { id: "poster", title: "Posters & Prints", price: "from $120", time: "1–2 days", details: "Eye-catching layouts for your promo campaigns, ready for digital or print.", features: ["Tailored layout for your target audience", "Fully optimized print-ready files", "2 rounds of revisions"], cta: "" }
        ]
      },
      {
        num: "02",
        title: "Web Design & Interfaces",
        description: "Clean, functional layouts designed in Figma to seamlessly connect your brand with your users.",
        items: [
          { id: "landing", title: "Landing Page Design", price: "from $600", time: "3–7 days", details: "Single-page structure crafted to showcase a product, event, or service.", features: ["Figma source files, ready for developers", "Fully responsive (Desktop + Mobile)", "2 rounds of revisions included"], cta: "" },
          { id: "fullweb", title: "Full Website Design", price: "from $1,200", time: "7–14 days", details: "Multi-page website design focusing on smooth user journeys and clean look.", features: ["Layouts of all core pages", "Thoughtful UX hierarchy", "Complete desktop & mobile adaptive design"], cta: "" },
          { id: "uxui", title: "UI/UX & Mobile Apps", price: "from $1,200", time: "10–20 days", details: "Comprehensive user interface design for mobile apps and complex digital products.", features: ["Wireframes & logical user flows", "Cohesive design system & UI Kit", "Developer-ready Figma handoff"], cta: "" }
        ]
      },
      {
        num: "03",
        title: "Social Media & Graphics",
        description: "Polished and cohesive design styles to make your social media channels stand out in the feed.",
        items: [
          { id: "smm", title: "SMM Branding Package", price: "from $250", time: "1–3 days", details: "Complete profile design kit for Telegram, Instagram, YouTube, VK, or Twitch.", features: ["Profile avatar & banner/header art", "Custom post & story layout templates", "2 rounds of edits to tweak details"], cta: "" },
          { id: "infographics", title: "E-Commerce Infographics", price: "from $250", time: "2–3 days", details: "High-impact listing slides for Amazon, eBay, or other digital storefronts.", features: ["Hero cover layout that grabs attention", "4 custom slides displaying features & specs", "Polished and consistent visual style"], cta: "" }
        ]
      }
    ],
    extra: {
      title: "Extras",
      items: [
        { name: "Urgent turnaround", price: "+50% to standard project cost", desc: "Priority delivery on short notice with no compromise on quality." },
        { name: "Source files & assets", price: "from $30", desc: "Figma files, layered vector source deliveries (upon request)." },
        { name: "Additional iterations", price: "+40% of standard cost", desc: "2 rounds of revisions are included; further edits billed by complexity." }
      ]
    },
    terms: {
      title: "Payment & Terms",
      blocks: [
        { title: "Payment Methods", items: ["Bank Transfer (Direct)", "Online Payments / Cards", "Crypto (USDT / Telegram Wallet)"] },
        { title: "Conditions", items: ["100% upfront payment before project kickoff", "Payment implies agreement with project brief and timelines", "Final deliverables are sent upon project sign-off"] }
      ]
    }
  }
};
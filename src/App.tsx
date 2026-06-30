import React, { useState, useEffect, useLayoutEffect, useCallback, Component, ErrorInfo, ReactNode, memo, useRef } from 'react';
import { motion, AnimatePresence, Variants, useMotionValue, useSpring, useTransform } from 'motion/react';
import { ArrowUpRight, Globe, Menu, X as CloseIcon, ChevronDown, ChevronUp, Mail, AlertCircle, Plus, Trash2, Save, LogOut, Upload } from 'lucide-react';
import Lenis from '@studio-freight/lenis';
import { setDoc, serverTimestamp, getDocFromServer, getDocs, deleteDoc, doc, onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { db, auth } from './firebase';
import { content as initialContent, seoSettings as defaultSeoSettings, logoUrl as defaultLogoUrl, logoLink as defaultLogoLink, priceData, ASSETS } from './constants';
import { Language, Testimonial, ContactModalContent, Project, Branding } from './types';

// Error Handling Spec for Firestore Operations
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  // Do not throw for background read operations (GET/LIST), as it will crash the client-side UI threads.
  // Instead, log the warning and let the app stay in a resilient fallback state.
  if (operationType !== OperationType.GET && operationType !== OperationType.LIST) {
    throw new Error(JSON.stringify(errInfo));
  }
}

function fixDanglingPrepositions(text: string): string {
  if (!text || typeof text !== 'string') return text;
  
  let result = text;
  
  // Russian prepositions/conjunctions (1-2 characters, preceded by space/start/quotes, followed by space)
  result = result.replace(
    /(^|[\s"“«'’])([а-яА-ЯёЁ]{1,2})\s/g,
    '$1$2\u00A0'
  );

  // English prepositions/articles/conjunctions of 1-3 letters
  result = result.replace(
    /(^|[\s"“«'’])(a|an|the|in|on|at|to|by|of|for|is|it|my|and|or|with|as)\s/gi,
    '$1$2\u00A0'
  );

  return result;
}

// Error Boundary Component
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsedError = JSON.parse(this.state.error?.message || "");
        if (parsedError.error) errorMessage = parsedError.error;
      } catch {
        if (this.state.error?.message) errorMessage = this.state.error.message;
      }

      return (
        <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center p-6 text-center">
          <div className="max-w-md">
            <AlertCircle size={48} className="mx-auto mb-6 text-white/40" />
            <h2 className="text-2xl font-bold mb-4 uppercase tracking-tightest">Application Error</h2>
            <p className="text-white/60 mb-8 font-light">{errorMessage}</p>
            <button 
              onClick={() => {
                try {
                  window.location.reload();
                } catch (e) {
                  console.error("Failed to reload page inside sandboxed context.", e);
                }
              }}
              className="px-8 py-3 bg-white text-black rounded-full font-bold uppercase tracking-widest text-xs hover:bg-zinc-200 transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Logo Component
const LogoContent = memo(({ url }: { url: string }) => {
  const [hasError, setHasError] = useState(false);

  if (hasError) return <span className="text-sm font-bold tracking-tightest">LOGO</span>;

  return (
    <img 
      src={url} 
      alt="Logo" 
      className="h-full w-auto object-contain"
      onError={() => setHasError(true)}
      referrerPolicy="no-referrer"
      decoding="async"
    />
  );
});

LogoContent.displayName = 'LogoContent';

const Logo = memo(({ url }: { url?: string }) => {
  if (!url) return <span className="text-sm font-bold tracking-tightest">LOGO</span>;

  return (
    <motion.a 
      href={defaultLogoLink}
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ opacity: 0.7 }}
      className="h-8 md:h-9 flex items-center cursor-pointer"
    >
      <LogoContent key={url} url={url} />
    </motion.a>
  );
});

Logo.displayName = 'Logo';

// File Uploader Component
const FileUploader = ({ onUpload, label, isLogo = false }: { onUpload: (url: string) => void, label: string, isLogo?: boolean }) => {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Max dimension 1200px for Firestore size limits, smaller for logos
        const maxDim = isLogo ? 400 : 1200;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = (height / width) * maxDim;
            width = maxDim;
          } else {
            width = (width / height) * maxDim;
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
        }
        
        // Use PNG for logos and icons to preserve transparency, JPEG for others to save space
        const dataUrl = (isLogo || width < 500) ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.8);
        onUpload(dataUrl);
        setIsUploading(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[10px] uppercase tracking-widest font-bold opacity-40">{label}</label>
      <div className="relative group">
        <input 
          type="file" 
          accept="image/*" 
          onChange={handleFileChange}
          className="absolute inset-0 opacity-0 cursor-pointer z-10"
        />
        <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 flex items-center justify-center gap-3 group-hover:border-white/20 transition-all">
          <Upload size={18} className="opacity-40 group-hover:opacity-100 transition-all" />
          <span className="text-xs font-bold uppercase tracking-widest opacity-40 group-hover:opacity-100 transition-all">
            {isUploading ? 'Processing...' : 'Upload Image'}
          </span>
        </div>
      </div>
    </div>
  );
};

// Folder Price Trigger Configuration Parameters
// Вы можете легко настроить анимацию и цвета папки здесь без необходимости искать параметры по всему файлу:
const FOLDER_CONFIG = {
  // Цвета папки (Вы можете свободно менять любой хекс-код здесь!)
  colors: {
    // Настройка задней части папки (ушко + задняя стенка папки).
    // Чтобы они выглядели как единая цельная фигура без швов, вы можете настроить для них градиент.
    // Если вам нужен сплошной цвет (однотонный), просто сделайте "from" и "to" одинаковыми!
    backGradient: {
      from: "#5E92D0",         // Цвет верхней части задней стенки и ушка (светло-голубой)
      to: "#5E92D0"            // Цвет нижней части задней стенки (сделайте его другим, если хотите градиент сзади!)
    },
    
    // Передняя крышка папки (Flap): красивый плавный градиент на крышке папки
    flapGradient: {
      from: "#B1CFFF",         // Верхний блик (светлый небесный)
      via: "#5E92D0",          // Средний тон (ярко-голубой)
      to: "#316097"            // Нижний полутон (более мягкий синий)
    }
  },

  // Наклон передней крышки папки (Flap)
  flap: {
    initialRotateX: 0, // Наклон крышки в покое (в градусах). Чем ближе к 0, тем сильнее закрыта.
    initialY: 30,         // Смещение крышки по вертикали в покое px.
    hoverRotateX: -28,   // Наклон крышки при наведении (открытие папки).
    hoverY: 18,          // Смещение крышки книзу при наведении.
  },
  
  // Главный белый листок бумаги за крышкой
  innerSheet: {
    initialRotateX: 0,   // Наклон в покое (в градусах).
    initialY: 17,        // Позиция Y в покое px, чтобы он выглядывал сверху как белая линия/лист.
    hoverRotateX: -14,   // Наклон листа назад при открытии (в градусах) для 3D глубины.
    hoverY: -4,          // Смещение по вертикали при наведении.
  },
  
  // Тилт-эффект (наклон всей папки при движении мыши)
  tilt: {
    // Ограничение наклона по вертикали [вверху, по центру, внизу]
    // Чтобы папка не заваливалась слишком сильно вверх, мы ограничили верхний наклон до 2 градусов.
    rotateXRange: [2, 0, -18], 
    
    // Ограничение наклона по горизонтали [влево, по центру, вправо]
    rotateYRange: [-15, 0, 15],
  },

  // Вылетающие карточки цен сзади папки
  cards: {
    initialRotateX: 0,   // Наклон листов в покое (в градусах). 
    hoverRotateX: -15,   // Наклон листов назад при открытии (в градусах). Придает потрясающую 3D-глубину.
    // Высота вылета на мобильных устройствах (i - индекс карточки от 0 до 2)
    hoverYMobile: (i: number) => -42 - i * 12,
    // Высота вылета на десктопе
    hoverYDesktop: (i: number) => -50 - i * 25,
  }
};

// Folder Price Trigger Component
const FolderPriceTrigger = ({ onClick, lang }: { onClick: () => void; lang: Language }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [elementSize, setElementSize] = useState({ width: 0, height: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [isInView, setIsInView] = useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Fast but dampened luxury-feel springs for fluid mouse reaction
  const springConfig = { damping: 35, stiffness: 300, mass: 0.6 };
  const xSpring = useSpring(x, springConfig);
  const ySpring = useSpring(y, springConfig);

  const rotateX = useTransform(
    ySpring,
    [-elementSize.height / 2, 0, elementSize.height / 2],
    FOLDER_CONFIG.tilt.rotateXRange
  );
  const rotateY = useTransform(
    xSpring,
    [-elementSize.width / 2, 0, elementSize.width / 2],
    FOLDER_CONFIG.tilt.rotateYRange
  );

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setElementSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      setWindowWidth(window.innerWidth);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile && elementSize.width > 0) {
      // Keep the folder facing straight at the user on mobile when in view
      x.set(0);
      y.set(0);
    } else if (!isMobile) {
      x.set(0);
      y.set(0);
    }
  }, [isMobile, elementSize.width, elementSize.height, x, y]);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isMobile) return; // Ignore on mobile
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const centerX = elementSize.width / 2;
    const centerY = elementSize.height / 2;
    x.set(mouseX - centerX);
    y.set(mouseY - centerY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <div className="relative py-12 flex items-center justify-center overflow-visible select-none">
      {/* Container for the folder - this is the hover target, now wider and taller */}
      <motion.div 
        ref={containerRef}
        className="relative cursor-pointer w-[340px] h-[240px] md:w-[680px] md:h-[500px] mx-auto group flex items-center justify-center overflow-visible"
        onClick={onClick}
        data-price-card
        onViewportEnter={() => setIsInView(true)}
        onViewportLeave={() => setIsInView(false)}
        viewport={{ once: false, amount: 0.4 }}
        whileHover={isMobile ? undefined : "hover"}
        animate={isMobile && isInView ? "hover" : "initial"}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          perspective: 1000,
        }}
      >
        {/* Actual visual folder shell container with original sizes, positioned exactly in the center of the hover zone */}
        <div 
          className="relative w-[280px] h-[180px] md:w-[480px] md:h-[340px] pointer-events-none"
          style={{
            transformStyle: "preserve-3d"
          }}
        >
          <motion.div
            className="absolute inset-0 w-full h-full"
            style={{
              rotateX,
              rotateY,
              transformStyle: "preserve-3d"
            }}
          >
          {/* Folder Shadow */}
          <div 
            className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-[90%] h-6 bg-[#0f2042]/15 blur-2xl rounded-full transition-all duration-700 group-hover:bg-[#0f2042]/22 group-hover:blur-3xl px-12"
            style={{ transform: "translateZ(-40px)" }} 
          />

          {/* Задняя стенка папки */}
          {/* Мы вернули оригинальную идеальную macOS-форму ушка со всеми правильными скруглениями! */}
          {/* Чтобы ушко и задний фон выглядели абсолютно бесшовно как единое целое при градиенте: */}
          {/* 1. Ушко красим в начальный цвет градиента (colors.backGradient.from) */}
          {/* 2. Задний фон красим градиентом, который начинается с того же colors.backGradient.from */}
          {/* 3. Убрали границы и тени ушка, чтобы в стыке не образовывалось никаких линий. */}
          {/* Также мы добавили "scale(1.035)", чтобы задний блок был чуть-чуть шире и идеально обрамлял листки при 3D-наклоне (компенсация перспективы). */}
          <div 
            className="absolute inset-0 z-0" 
            style={{ 
              transform: "translateZ(-10px) scale(1.01)", 
            }}
          >
            {/* Ушко папки в стиле macOS с точной трапециевидной формой и красивым скруглением */}
            <div 
              className="absolute -top-[12px] md:-top-[22px] left-0 w-[42%] h-[30px] md:h-[55px] rounded-tl-[10px] md:rounded-tl-[20px] z-0" 
              style={{ 
                clipPath: 'polygon(0 0, 80% 0, 100% 100%, 0 100%)',
                background: FOLDER_CONFIG.colors.backGradient.from
              }}
            />
            {/* Основной корпус задней стенки папки */}
            <div 
              className="absolute inset-0 rounded-[18px] md:rounded-[28px]" 
              style={{
                background: `linear-gradient(to bottom, ${FOLDER_CONFIG.colors.backGradient.from}, ${FOLDER_CONFIG.colors.backGradient.to})`
              }}
            />
          </div>
          
          {/* Popping Cards - Responsive size scaling and optimized 3-tier motion layouts */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              variants={{
                initial: { 
                  y: windowWidth < 768 ? 40 : 160,
                  x: i === 0 ? -12 : i === 1 ? 0 : 12,
                  rotate: 0, 
                  rotateX: FOLDER_CONFIG.cards.initialRotateX,
                  opacity: 0, 
                  scale: 0.85,
                  zIndex: 5
                },
                hover: {
                  y: windowWidth < 768 
                    ? FOLDER_CONFIG.cards.hoverYMobile(i) 
                    : FOLDER_CONFIG.cards.hoverYDesktop(i), 
                  x: windowWidth < 768 
                    ? (-50 + i * 50) 
                    : windowWidth < 1280 
                      ? (-65 + i * 65) 
                      : (-85 + i * 85), 
                  rotate: -4 + i * 4,
                  rotateX: FOLDER_CONFIG.cards.hoverRotateX,
                  opacity: 1,
                  scale: windowWidth < 768 
                    ? 0.90 
                    : windowWidth < 1280 
                      ? 0.98 
                      : 1, 
                  zIndex: 10
                }
              }}
              transition={{ 
                type: 'spring', 
                stiffness: 220, 
                damping: 22,
                mass: 0.8,
                delay: 0.03 + i * 0.05 
              }}
              className="absolute top-6 md:top-10 left-1/2 -translate-x-1/2 w-[120px] h-[80px] md:w-[180px] md:h-[130px] xl:w-60 xl:h-44 bg-[#F2F2F7] border border-white shadow-2xl rounded-xl p-3 md:p-6 flex flex-col justify-between overflow-hidden will-change-transform transform-gpu pointer-events-none"
              style={{ 
                boxShadow: '0 10px 30px rgba(0,0,0,0.1), inset 0 0 15px rgba(255,255,255,1)',
                transform: `translateZ(${-2 + i * 4}px)`
              }}
            >
              <div className="space-y-2 pt-1">
                <div className="w-10 h-1 bg-black/10 rounded-full" />
                <div className="w-16 h-1 bg-black/5 rounded-full" />
              </div>
              
              <div className="flex items-center justify-end pr-2">
                <div className="text-2xl md:text-5xl font-bold text-black/5 select-none italic">
                  {i === 0 ? '$' : i === 1 ? '₽' : '€'}
                </div>
              </div>

              <div className="space-y-1.5 pb-1">
                <div className="w-full h-px bg-black/5" />
                <div className="w-1/2 h-px bg-black/5" />
              </div>
            </motion.div>
          ))}

          {/* Main Inner Sheet (Главный белый листок бумаги за крышкой) */}
          <motion.div
            variants={{
              initial: {
                rotateX: FOLDER_CONFIG.innerSheet.initialRotateX,
                y: FOLDER_CONFIG.innerSheet.initialY,
                scale: 1,
                opacity: 1
              },
              hover: {
                rotateX: FOLDER_CONFIG.innerSheet.hoverRotateX,
                y: FOLDER_CONFIG.innerSheet.hoverY,
                scale: 1,
                opacity: 1
              }
            }}
            transition={{ type: 'spring', stiffness: 180, damping: 25 }}
            className="absolute inset-x-[3px] md:inset-x-[6px] h-full bg-white rounded-[16px] md:rounded-[26px] border border-white/40 shadow-xl z-10 origin-bottom transform-gpu flex flex-col justify-between pointer-events-none"
            style={{ 
              transform: "translateZ(10px)",
              boxShadow: "0 -4px 15px rgba(0,0,0,0.06), inset 0 0 10px rgba(255,255,255,1)"
            }}
          >
            {/* Elegant light grid patterns & content for the interior sheet */}
            <div className="p-3 md:p-5 space-y-2 md:space-y-3">
              <div className="flex gap-2 items-center">
                <div className="w-8 h-1 md:w-12 md:h-1.5 bg-[#206CBF]/30 rounded-full" />
                <div className="w-12 h-0.5 md:w-20 md:h-1 bg-zinc-200/50 rounded-full" />
              </div>
              <div className="space-y-1 md:space-y-1.5">
                <div className="w-full h-0.5 md:h-1 bg-zinc-100/70 rounded-full" />
                <div className="w-[95%] h-0.5 md:h-1 bg-zinc-100/70 rounded-full" />
                <div className="w-[85%] h-0.5 md:h-1 bg-zinc-100/70 rounded-full" />
              </div>
            </div>
            {/* Small decorative line at the bottom */}
            <div className="p-3 md:p-5 flex justify-end">
              <div className="w-8 h-1 md:w-12 md:h-1.5 bg-[#206CBF]/10 rounded-full" />
            </div>
          </motion.div>
 
          {/* Folder Front Layer (Flap) */}
          <motion.div 
            variants={{
              initial: { 
                rotateX: FOLDER_CONFIG.flap.initialRotateX, 
                y: FOLDER_CONFIG.flap.initialY, 
                scale: 1
              },
              hover: { 
                rotateX: windowWidth < 768 ? FOLDER_CONFIG.flap.hoverRotateX : FOLDER_CONFIG.flap.hoverRotateX, 
                y: windowWidth < 768 ? FOLDER_CONFIG.flap.hoverY : FOLDER_CONFIG.flap.hoverY, 
                scale: 1
              }
            }}
            transition={{ type: 'spring', stiffness: 180, damping: 25 }}
            className="absolute inset-0 z-20 origin-bottom transform-gpu pointer-events-none"
            style={{ transform: "translateZ(20px)", perspective: 1200 }}
          >
            {/* Front flap with customizable gradient dynamically using FOLDER_CONFIG.colors */}
            <div 
              className="absolute inset-0 rounded-[18px] md:rounded-[28px] shadow-[-5px_-10px_30px_rgba(15,32,66,0.11)] overflow-hidden flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${FOLDER_CONFIG.colors.flapGradient.from} 0%, ${FOLDER_CONFIG.colors.flapGradient.via} 50%, ${FOLDER_CONFIG.colors.flapGradient.to} 100%)`
              }}
            >
               {/* Subtle gradient for depth */}
               <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/5" />
               
               {/* Subtle texture */}
               <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/pinstriped-suit.png')]" />

               {/* Center Badge for your Star Logo */}
               <div className="relative z-10 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                 {defaultLogoUrl ? (
                   <img 
                     src={defaultLogoUrl} 
                     alt="Star Logo" 
                     className="w-20 h-20 md:w-32 md:h-32 object-contain opacity-95 drop-shadow-[0_4px_12px_rgba(255,255,255,0.4)]"
                     referrerPolicy="no-referrer"
                   />
                 ) : (
                   // Fallback star icon if logoUrl is not specified or unavailable
                   <svg className="w-16 h-16 md:w-28 md:h-28 text-white fill-current animate-pulse-slow" viewBox="0 0 24 24">
                     <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                   </svg>
                 )}
               </div>
            </div>
          </motion.div>
        </motion.div>
        </div>

        {/* Action Tooltip */}
        <motion.div 
          variants={{
            initial: { opacity: 0, y: 10 },
            hover: { opacity: 1, y: 0 }
          }}
          className="absolute -bottom-16 left-1/2 -translate-x-1/2 hidden md:flex items-center gap-3 pointer-events-none whitespace-nowrap"
        >
          <div className="flex gap-1.5 pt-1">
            <div className="w-1 h-1 bg-white/30 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <div className="w-1 h-1 bg-white/30 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <div className="w-1 h-1 bg-white/30 rounded-full animate-bounce" />
          </div>
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-white">
            {lang === 'RU' ? 'Нажмите, чтобы открыть' : 'Click to open'}
          </span>
        </motion.div>
      </motion.div>
    </div>
  );
};

// Admin Panel Component
const AdminPanel = memo(({ 
  isOpen, 
  onClose, 
  projects, 
  dribbbleProjects,
  user,
  isAdmin,
  onUpdateProjects,
  onUpdateDribbbleProjects
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  projects: Project[];
  dribbbleProjects: Project[];
  user: User | null;
  isAdmin: boolean;
  onUpdateProjects: (newProjects: Project[]) => Promise<void>;
  onUpdateDribbbleProjects: (newProjects: Project[]) => Promise<void>;
}) => {
  const [activeTab, setActiveTab] = useState<'projects' | 'dribbble'>('projects');
  const [editProjects, setEditProjects] = useState(projects);
  const [editDribbbleProjects, setEditDribbbleProjects] = useState(dribbbleProjects);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEditProjects(projects);
      setEditDribbbleProjects(dribbbleProjects);
    }
  }, [isOpen, projects, dribbbleProjects]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleSave = async () => {
    if (!isAdmin) return;
    setIsSaving(true);
    try {
      if (activeTab === 'projects') {
        await onUpdateProjects(editProjects);
      } else if (activeTab === 'dribbble') {
        await onUpdateDribbbleProjects(editDribbbleProjects);
      }
      onClose();
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const moveProject = (index: number, direction: 'up' | 'down') => {
    const currentList = activeTab === 'projects' ? [...editProjects] : [...editDribbbleProjects];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentList.length) return;
    
    const temp = currentList[index];
    currentList[index] = currentList[targetIndex];
    currentList[targetIndex] = temp;
    
    const orderedProjects = currentList.map((p, i) => ({ ...p, order: i }));
    if (activeTab === 'projects') {
      setEditProjects(orderedProjects);
    } else {
      setEditDribbbleProjects(orderedProjects);
    }
  };

  const currentEditList = activeTab === 'projects' ? editProjects : editDribbbleProjects;
  const setList = activeTab === 'projects' ? setEditProjects : setEditDribbbleProjects;
  const collectionName = activeTab === 'projects' ? 'projects' : 'dribbble_projects';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-2xl flex flex-col"
    >
      <div className="flex flex-col sm:flex-row justify-between items-center p-4 sm:p-8 border-b border-white/10 gap-4">
        <div className="flex items-center gap-4 sm:gap-6">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tightest uppercase">Admin Panel</h2>
          {user && (
            <div className="flex items-center gap-3 px-3 py-1 bg-white/5 rounded-full border border-white/10">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] sm:text-[10px] uppercase tracking-widest font-bold opacity-60 truncate max-w-[100px] sm:max-w-none">{user.email}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          {!user ? (
            <button onClick={handleLogin} className="px-4 sm:px-6 py-2 bg-white text-black rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest">Login</button>
          ) : (
            <>
              {isAdmin && (
                <button 
                  onClick={handleSave} 
                  disabled={isSaving}
                  className="px-4 sm:px-6 py-2 bg-emerald-500 text-white rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  <Save size={14} />
                  <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save Changes'}</span>
                  <span className="sm:hidden">{isSaving ? '...' : 'Save'}</span>
                </button>
              )}
              <button onClick={() => signOut(auth)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><LogOut size={18} /></button>
            </>
          )}
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><CloseIcon size={20} /></button>
        </div>
      </div>

      {!isAdmin && user && (
        <div className="flex-1 flex items-center justify-center p-12 text-center">
          <div className="max-w-md">
            <AlertCircle size={48} className="mx-auto mb-6 text-red-500" />
            <h3 className="text-xl font-bold mb-2 uppercase tracking-tightest">Access Denied</h3>
            <p className="text-white/60 font-light">You are logged in as {user.email}, but you don't have administrative privileges. Please log in with the correct account.</p>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab Switcher */}
          <div className="px-4 sm:px-12 pt-8 flex gap-4 border-b border-white/5">
            <button 
              onClick={() => setActiveTab('projects')}
              className={`pb-4 text-[10px] uppercase tracking-widest font-bold transition-all relative ${activeTab === 'projects' ? 'text-white' : 'text-white/40 hover:text-white/60'}`}
            >
              Portfolio Projects
              {activeTab === 'projects' && <motion.div layoutId="adminTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />}
            </button>
            <button 
              onClick={() => setActiveTab('dribbble')}
              className={`pb-4 text-[10px] uppercase tracking-widest font-bold transition-all relative ${activeTab === 'dribbble' ? 'text-white' : 'text-white/40 hover:text-white/60'}`}
            >
              Dribbble Projects
              {activeTab === 'dribbble' && <motion.div layoutId="adminTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />}
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-12 custom-scrollbar" data-lenis-prevent>
            <div className="max-w-4xl mx-auto flex flex-col gap-8 sm:gap-12">
              <div className="flex flex-col gap-6 sm:gap-8">
                  <div className="flex justify-between items-center border-b border-white/10 pb-4">
                    <h3 className="text-[10px] sm:text-xs uppercase tracking-[0.2em] font-bold text-white/40">
                      {activeTab === 'projects' ? 'Portfolio Projects' : 'Dribbble Projects'}
                    </h3>
                    <button 
                      onClick={() => {
                        const newProject: Project = { 
                          id: doc(collection(db, collectionName)).id,
                          title: 'New Project', 
                          category: 'Category', 
                          image: 'https://picsum.photos/seed/new/1200/800', 
                          link: '#', 
                          order: currentEditList.length 
                        };
                        setList([...currentEditList, newProject]);
                      }}
                      className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white text-black rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-widest"
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {currentEditList.map((project, i) => (
                      <div key={project.id || `new-${i}`} className="bg-zinc-900 border border-white/10 rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
                        <div className="flex sm:flex-col gap-2 w-full sm:w-auto justify-between sm:justify-start">
                          <div className="flex sm:flex-col gap-2">
                            <button 
                              onClick={() => moveProject(i, 'up')}
                              disabled={i === 0}
                              className="p-2 hover:bg-white/10 rounded-lg disabled:opacity-20"
                            >
                              <ChevronUp size={16} />
                            </button>
                            <button 
                              onClick={() => moveProject(i, 'down')}
                              disabled={i === currentEditList.length - 1}
                              className="p-2 hover:bg-white/10 rounded-lg disabled:opacity-20"
                            >
                              <ChevronDown size={16} />
                            </button>
                          </div>
                          <button 
                            onClick={() => {
                              const newList = currentEditList.filter((_, idx) => idx !== i).map((p, idx) => ({ ...p, order: idx }));
                              setList(newList);
                            }}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition-colors sm:mt-auto"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                        <div className="w-full sm:w-32 aspect-[3/2] rounded-lg overflow-hidden bg-black flex-shrink-0">
                          <img src={project.image} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] uppercase tracking-widest font-bold opacity-40">Title</label>
                            <input 
                              type="text"
                              value={project.title}
                              onChange={(e) => {
                                const newList = [...currentEditList];
                                newList[i] = { ...newList[i], title: e.target.value };
                                setList(newList);
                              }}
                              className="bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-sm outline-none focus:border-white/20"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] uppercase tracking-widest font-bold opacity-40">Category</label>
                            <input 
                              type="text"
                              value={project.category}
                              onChange={(e) => {
                                const newList = [...currentEditList];
                                newList[i] = { ...newList[i], category: e.target.value };
                                setList(newList);
                              }}
                              className="bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-sm outline-none focus:border-white/20"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] uppercase tracking-widest font-bold opacity-40">External Link</label>
                            <input 
                              type="text"
                              value={project.link}
                              onChange={(e) => {
                                const newList = [...currentEditList];
                                newList[i] = { ...newList[i], link: e.target.value };
                                setList(newList);
                              }}
                              placeholder="https://..."
                              className="bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-sm outline-none focus:border-white/20"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] uppercase tracking-widest font-bold opacity-40">Order Index</label>
                            <input 
                              type="number"
                              value={project.order}
                              readOnly
                              className="bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-sm outline-none opacity-50"
                            />
                          </div>
                          <div className="flex flex-col gap-1 sm:col-span-2">
                            <FileUploader 
                              label="Project Image (3:2)" 
                              onUpload={(url) => {
                                const newList = [...currentEditList];
                                newList[i] = { ...newList[i], image: url };
                                setList(newList);
                              }} 
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    );
  });

AdminPanel.displayName = 'AdminPanel';

// Preloader Component
const CACHE_BUSTER = Date.now();

const Preloader = ({ onComplete, isReady, branding }: { onComplete: () => void; isReady: boolean; branding?: Branding }) => {
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 2500); // Slightly longer to match the 1.8s animation + some buffer
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (minTimeElapsed && isReady) {
      onComplete();
    }
  }, [minTimeElapsed, isReady, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="fixed inset-0 z-[1000] bg-black flex items-center justify-center p-6"
    >
      <motion.div
        initial={{ opacity: 0, filter: "blur(15px)", scale: 0.95 }}
        animate={{ 
          opacity: 1, 
          filter: "blur(0px)",
          scale: 1
        }}
        transition={{ 
          duration: 1.2, 
          ease: [0.22, 1, 0.36, 1], // Custom cubic-bezier for smoother feel
          delay: 0.3
        }}
        className="flex flex-col items-center gap-6"
      >
        {branding?.preloaderLogo ? (
          <img 
            src={`${branding.preloaderLogo}?v=${CACHE_BUSTER}`} 
            alt="Logo" 
            className="h-12 md:h-16 w-auto object-contain"
            style={{ letterSpacing: '6px' }}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div 
            className="text-5xl md:text-6xl font-medium tracking-[6px] text-center uppercase text-white font-sans"
          >
            Hello, Marsel
          </div>
        )}


      </motion.div>
    </motion.div>
  );
};

// Custom Cursor Component
const CustomCursor = () => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [isPointer, setIsPointer] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    if (window.innerWidth < 768) return;
    
    const handleMouseMove = (e: MouseEvent | { clientX: number; clientY: number; target: EventTarget | null }) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      const target = e.target as HTMLElement;
      if (!target || typeof target.closest !== 'function') return;

      const isRoadmapImageActive = !!target.closest('[data-roadmap-active="true"]');
      
      const isClickable = target.closest('button') || 
                         target.closest('a') ||
                         (typeof window !== 'undefined' && window.getComputedStyle && window.getComputedStyle(target).cursor === 'pointer');
      
      setIsPointer(!!isClickable);
      setIsHidden(isRoadmapImageActive);
    };

    const handleScroll = () => {
      // Re-evaluate what's under the cursor during scroll
      const x = mouseX.get();
      const y = mouseY.get();
      const target = document.elementFromPoint(x, y);
      handleMouseMove({ clientX: x, clientY: y, target });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [mouseX, mouseY]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        a, button, [role="button"], .cursor-pointer, input, textarea, select, [data-price-card], [data-price-card] *, [data-review-card], [data-review-card] * {
          cursor: none !important;
        }
      `}} />
      <motion.div
        className="fixed top-0 left-0 w-4 h-4 bg-white rounded-full pointer-events-none z-[9999] mix-blend-difference hidden md:block"
      style={{
        x: mouseX,
        y: mouseY,
        translateX: '-50%',
        translateY: '-50%',
        scale: isPointer ? 0.5 : 1,
        opacity: isHidden ? 0 : 1
      }}
      transition={{ 
        scale: { type: 'spring', stiffness: 300, damping: 20 },
        opacity: { duration: 0 }
      }}
    />
    </>
  );
};

interface FadeInProps {
  initial: { opacity: number; y: number };
  whileInView: { opacity: number; y: number };
  viewport: { once: boolean; margin: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transition: any;
}

// Custom Social Icons with better accuracy
const SocialIcon = memo(({ name, size = 20, customIcons, className }: { name: string; size?: number; customIcons?: Record<string, string>; className?: string }) => {
  const normalizedName = name.toLowerCase();

  if (customIcons) {
    const customKey = Object.keys(customIcons).find(k => k.toLowerCase() === normalizedName);
    if (customKey && customIcons[customKey]) {
      return (
        <div style={{ width: size, height: size }} className="flex items-center justify-center">
          <img 
            src={customIcons[customKey]} 
            alt={name} 
            className={`w-full h-full object-contain ${className || ''}`} 
            referrerPolicy="no-referrer" 
            decoding="async" 
          />
        </div>
      );
    }
  }

  const iconProps = { width: size, height: size, className: `${className || ''} flex-shrink-0` };
  const strokeProps = { width: size, height: size, stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className: `${className || ''} flex-shrink-0` };

  switch (normalizedName) {
    case 'twitter':
    case 'x':
      return <svg {...iconProps} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;
    case 'behance':
      return <svg {...iconProps} viewBox="0 0 24 24" fill="currentColor"><path d="M22 7h-7v1h7V7zm-9.082 2.533c0-1.311-.473-2.316-1.42-3.014-.947-.698-2.261-1.047-3.943-1.047H2v13.056h5.81c1.861 0 3.28-.439 4.258-1.317.978-.878 1.467-2.114 1.467-3.708 0-1.14-.257-2.083-.771-2.828.514-.745.771-1.688.771-2.828l-.613-.314zm-3.321 6.843c0 .546-.174.972-.522 1.278-.348.306-.84.459-1.476.459H5.21V14.1h1.471c.636 0 1.128.153 1.476.459.348.306.522.732.522 1.278v.539zm-.433-6.521c0 .48-.153.855-.459 1.125-.306.27-.738.405-1.296.405H5.21V7.8h1.296c.558 0 .99.135 1.296.405.306.27.459.645.459 1.125v.525zM24 11.5c0-1.311-.473-2.316-1.42-3.014-.947-.698-2.261-1.047-3.943-1.047-1.682 0-2.996.349-3.943 1.047-.947.698-1.42 1.703-1.42 3.014 0 1.311.473 2.316 1.42 3.014.947.698 2.261 1.047 3.943 1.047 1.682 0 2.996-.349 3.943-1.047.947-.698 1.42-1.703 1.42-3.014zm-3.321 0c0 .546-.174.972-.522 1.278-.348.306-.84.459-1.476.459-1.272 0-1.998-.585-1.998-1.737 0-1.152.726-1.737 1.998-1.737.636 0 1.128.153 1.476.459.348.306.522.732.522 1.278v.539z"/></svg>;
    case 'pinterest':
      return <svg {...iconProps} viewBox="0 0 24 24" fill="currentColor"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.965 1.406-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.261 7.929-7.261 4.162 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146 1.124.347 2.317.535 3.554.535 6.607 0 11.985-5.365 11.985-11.987C24.02 5.367 18.624 0 12.017 0z"/></svg>;
    case 'tiktok':
      return <svg {...iconProps} viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31 0 2.57.51 3.51 1.42.92.91 1.42 2.15 1.42 3.44 0 .09 0 .18-.01.26 1.18-.02 2.35.39 3.28 1.17.93.78 1.54 1.91 1.72 3.14.05.34.08.68.08 1.03v.48c-.02 3.81-3.13 6.88-6.94 6.88-.06 0-.11 0-.17-.01-.38 3.51-3.35 6.22-6.91 6.22-3.83 0-6.94-3.11-6.94-6.94s3.11-6.94 6.94-6.94c.12 0 .25 0 .37.01v2.47c-.12-.01-.25-.01-.37-.01-2.47 0-4.47 2-4.47 4.47s2 4.47 4.47 4.47 4.47-2 4.47-4.47v-11.41c.71.51 1.57.81 2.5.81.12 0 .25-.01.37-.02v-2.47c-.12.01-.25.02-.37.02-1.38 0-2.5-1.12-2.5-2.5V.02h2.47z"/></svg>;
    case 'instagram':
      return <svg {...strokeProps} viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>;
    case 'youtube':
      return <svg {...strokeProps} viewBox="0 0 24 24" fill="none"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.42a2.78 2.78 0 0 0-1.94 2C1 8.11 1 12 1 12s0 3.89.46 5.58a2.78 2.78 0 0 0 1.94 2c1.72.42 8.6.42 8.6.42s6.88 0 8.6-.42a2.78 2.78 0 0 0 1.94-2C23 15.89 23 12 23 12s0-3.89-.46-5.58z"></path><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"></polygon></svg>;
    case 'telegram':
      return <svg {...strokeProps} viewBox="0 0 24 24" fill="none"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>;
    case 'dribbble':
      return <svg {...strokeProps} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10"></circle><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.49-6.18 7.85-13.82 5.83m13.7 3.44c-4.55-1.99-7.11-3.23-12.13-1.49"></path></svg>;
    case 'threads':
      return <svg {...iconProps} viewBox="0 0 24 24" fill="currentColor"><path d="M14.823 12.961c-.453.039-.904.01-1.35-.087-.445-.097-.859-.258-1.243-.485-.384-.227-.714-.514-.99-.861-.276-.347-.478-.755-.606-1.224-.128-.469-.178-.99-.15-1.563.028-.573.138-1.18.33-1.821.192-.641.474-1.304.846-1.989.372-.685.834-1.38 1.386-2.085.552-.705 1.194-1.405 1.926-2.1.732-.695 1.554-1.365 2.466-2.01.912-.645 1.914-1.245 3.006-1.8.18-.09.345-.15.495-.18.15-.03.285-.03.405 0 .12.03.21.09.27.18.06.09.09.21.09.36 0 .15-.03.315-.09.495-.06.18-.15.375-.27.585-.12.21-.27.435-.45.675-.18.24-.39.495-.63.765-.24.27-.51.555-.81.855-.3.3-.615.615-.945.945-.33.33-.675.675-1.035 1.035-.36.36-.72.735-1.08 1.125-.36.39-.72.795-1.08 1.215-.36.42-.705.855-1.035 1.305-.33.45-.63.915-.9 1.395-.27.48-.51.975-.72 1.485-.21.51-.375 1.035-.495 1.575-.12.54-.18 1.095-.18 1.665 0 .57.045 1.125.135 1.665.09.54.24 1.05.45 1.53.21.48.495.915.855 1.305.36.39.795.705 1.305.945.51.24 1.095.39 1.755.45.66.06 1.395.03 2.205-.09.81-.12 1.695-.33 2.655-.63.96-.3 1.995-.69 3.105-1.17.18-.09.345-.15.495-.18.15-.03.285-.03.405 0 .12.03.21.09.27.18.06.09.09.21.09.36 0 .15-.03.315-.09.495-.06.18-.15.375-.27.585-.12.21-.27.435-.45.675-.18.24-.39.495-.63.765-.24.27-.51.555-.81.855-.3.3-.615.615-.945.945-.33.33-.675.675-1.035 1.035-.36.36-.72.735-1.08 1.125-.36.39-.72.795-1.08 1.215-.36.42-.705.855-1.035 1.305-.33.45-.63.915-.9 1.395-.27.48-.51.975-.72 1.485-.21.51-.375 1.035-.495 1.575-.12.54-.18 1.095-.18 1.665 0 .57.045 1.125.135 1.665.09.54.24 1.05.45 1.53.21.48.495.915.855 1.305.36.39.795.705 1.305.945.51.24 1.095.39 1.755.45.66.06 1.395.03 2.205-.09.81-.12 1.695-.33 2.655-.63.96-.3 1.995-.69 3.105-1.17z"/></svg>;
    case 'email':
      return <Mail size={size} className={className} />;
    default:
      return null;
  }
});

SocialIcon.displayName = 'SocialIcon';

// Testimonial Stack Component
const TestimonialStack = memo(({ testimonials }: { testimonials: Testimonial[] }) => {
  const [[index, direction], setIndexAndDirection] = useState([0, 0]);
  const [hasHinted, setHasHinted] = useState(false);

  useEffect(() => {
    // End the hint state after 2.5 seconds to clean up custom keyframes
    const timer = setTimeout(() => {
      setHasHinted(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  const paginate = (swipeDir: number) => {
    setIndexAndDirection([
      (index + 1) % testimonials.length,
      swipeDir
    ]);
  };

  const handleDragEnd = (_: unknown, info: { offset: { x: number } }) => {
    const threshold = window.innerWidth < 768 ? 50 : 100;
    if (info.offset.x > threshold) {
      paginate(-1); // Swiped right
    } else if (info.offset.x < -threshold) {
      paginate(1); // Swiped left
    }
  };

  return (
    <div className="relative h-[400px] md:h-[450px] w-full flex items-center justify-center will-change-transform" data-review-card>
      <AnimatePresence initial={false} custom={direction}>
        {testimonials.map((testimonial, i) => {
          const isCurrent = i === index;
          
          // Calculate relative position in the stack
          let offset = i - index;
          if (offset < 0) offset += testimonials.length;
          
          // Only render the top 3 cards
          if (offset > 2) return null;

          const cardVariants: Variants = {
            enter: {
              x: offset * (window.innerWidth < 768 ? 3 : 10),
              y: offset * (window.innerWidth < 768 ? 15 : 20) + 15,
              opacity: 0,
              scale: 1 - offset * 0.05 - 0.05,
            },
            center: {
              x: (isCurrent && i === 0 && !hasHinted)
                ? [0, -35, 12, 0]
                : offset * (window.innerWidth < 768 ? 3 : 10),
              y: offset * (window.innerWidth < 768 ? 15 : 20),
              scale: 1 - offset * 0.05,
              opacity: 1 - offset * 0.3,
              rotate: isCurrent ? 0 : offset * 2,
              zIndex: 10 - offset,
              transition: {
                type: 'spring',
                stiffness: 300,
                damping: 20,
                duration: (isCurrent && i === 0 && !hasHinted) ? 1.4 : 0.4,
                delay: (isCurrent && i === 0 && !hasHinted) ? 0.8 : 0
              }
            },
            exit: (d: number) => ({
              x: d > 0 ? -500 : 500,
              opacity: 0,
              scale: 0.9,
              transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
            })
          };

          return (
            <motion.div
              key={testimonial.name}
              custom={direction}
              variants={cardVariants}
              initial="enter"
              animate="center"
              exit="exit"
              drag={isCurrent ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.7}
              onDragEnd={handleDragEnd}
              whileDrag={{ 
                scale: 1.02, 
                rotate: 0, 
                zIndex: 50,
              }}
              transition={{ 
                type: 'spring', 
                stiffness: 350, 
                damping: 25,
                opacity: { duration: 0.2 }
              }}
              className={`absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-full md:w-[500px] bg-zinc-900 border border-white/10 rounded-3xl p-6 sm:p-7 md:p-10 flex flex-col justify-between select-none shadow-2xl ${isCurrent ? 'shadow-white/5' : 'pointer-events-none'} will-change-transform transform-gpu`}
            >
              <div className="text-xl md:text-xl font-light italic leading-relaxed text-white/95">
                "{fixDanglingPrepositions(testimonial.text || '')}"
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold text-lg">
                    {testimonial.name[0]}
                  </div>
                  <div>
                    <div className="font-bold text-base">{testimonial.name}</div>
                    <div className="text-[10px] text-muted uppercase tracking-widest">{testimonial.role}</div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
      
      {/* Navigation Dots */}
      <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex gap-2">
        {testimonials.map((_, i) => (
          <button
            key={i}
            onClick={() => paginate(i > index ? 1 : -1)}
            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === index ? 'bg-white' : 'bg-white/20'}`}
          />
        ))}
      </div>
    </div>
  );
});

TestimonialStack.displayName = 'TestimonialStack';

// Custom Cursor Component

const ProjectCard = memo(({ project, index }: { project: Project; index: number }) => {
  const batchIndex = index % 6;
  return (
    <motion.a
      href={project.link}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ 
        duration: 0.6, 
        ease: [0.16, 1, 0.3, 1],
        delay: window.innerWidth < 768 ? 0 : batchIndex * 0.05
      }}
      className="group block will-change-transform"
    >
      <div className="aspect-[3/2] overflow-hidden bg-zinc-900 mb-4 md:mb-6 relative rounded-sm">
        <img 
          src={project.image} 
          alt={project.title}
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-all duration-700 md:group-hover:scale-105 will-change-transform"
        />
        <div className="absolute top-6 right-6 opacity-0 md:group-hover:opacity-100 transition-all duration-500">
          <div className="bg-white text-black w-10 h-10 rounded-full flex items-center justify-center">
            <ArrowUpRight size={20} />
          </div>
        </div>
      </div>
      <div className="flex justify-between items-end">
        <div>
          <h3 className="text-xl md:text-2xl font-bold tracking-tightest mb-2">{project.title}</h3>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted">{project.category}</p>
        </div>
      </div>
    </motion.a>
  );
});

ProjectCard.displayName = 'ProjectCard';

const renderAnswerWithLinks = (text: string, onPriceListClick?: (scrollToExtras?: boolean) => void) => {
  if (!onPriceListClick) return text;
  
  const ruTarget = "подробнее в прайсе";
  const enTarget = "more details in the price list";
  
  let target = "";
  if (text.includes(ruTarget)) {
    target = ruTarget;
  } else if (text.includes(enTarget)) {
    target = enTarget;
  }
  
  if (!target) return text;
  
  const shouldScrollToExtras = text.toLowerCase().includes("исходник") || text.toLowerCase().includes("source");
  const parts = text.split(target);
  return (
    <>
      {parts[0]}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPriceListClick(shouldScrollToExtras);
        }}
        className="underline text-white/90 hover:text-white transition-colors cursor-pointer font-medium underline-offset-4 decoration-white/35 hover:decoration-white"
      >
        {target}
      </button>
      {parts[1]}
    </>
  );
};

const FAQItem = memo(({ item, index, fadeIn, onPriceListClick }: { item: { question: string; answer: string }; index: number; fadeIn: FadeInProps; onPriceListClick?: (scrollToExtras?: boolean) => void }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div 
      {...fadeIn}
      transition={{ ...fadeIn.transition, delay: window.innerWidth < 768 ? 0 : index * 0.1 }}
      className="overflow-hidden border-b border-white/10 last:border-b-0"
    >
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-6 md:py-8 flex justify-between items-center group text-left gap-8"
      >
        <span className="text-xl xs:text-2xl sm:text-3xl lg:text-5xl font-bold tracking-tightest group-hover:text-white transition-all duration-500 leading-[1.1] will-change-transform">
          {item.question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-muted group-hover:text-white transition-colors flex-shrink-0"
        >
          <ChevronDown size={32} strokeWidth={1} />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-sm sm:text-lg md:text-xl text-muted font-light pb-8 max-w-4xl leading-relaxed">
              {renderAnswerWithLinks(item.answer, onPriceListClick)}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

FAQItem.displayName = 'FAQItem';

// Custom Select Component
const CustomSelect = ({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (val: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (dropdownRef.current) {
          dropdownRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          });
        }
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white/5 backdrop-blur-md border border-white/10 p-6 md:p-8 rounded-none flex items-center justify-between group hover:bg-white/10 hover:border-white/20 transition-all duration-500 text-left"
        style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      >
        <div className="flex flex-col items-start gap-2">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/40">{label}</span>
          <span className="text-lg md:text-2xl font-bold tracking-tightest uppercase leading-none">{value || 'Select option'}</span>
        </div>
        <div className={`p-2 rounded-full border border-white/10 transition-transform duration-500 ${isOpen ? 'rotate-180 bg-white text-black' : ''}`}>
          <ChevronDown size={16} strokeWidth={3} />
        </div>
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            data-lenis-prevent
            className="absolute top-full left-0 w-full mt-2 bg-white/10 backdrop-blur-2xl border border-white/10 rounded-none z-20 shadow-2xl max-h-80 md:max-h-[380px] overflow-y-auto custom-scrollbar"
            style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
          >
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                }}
                className="w-full px-6 py-4 text-left text-lg hover:bg-white hover:text-black transition-colors border-b border-white/5 last:border-0"
              >
                {opt}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Contact Modal Component
const ContactModal = memo(({ isOpen, onClose, content, lang, setLang }: { isOpen: boolean; onClose: () => void; content: ContactModalContent; lang: Language; setLang: (l: Language) => void }) => {
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [honeypot, setHoneypot] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    projectType: content.projectTypes[0],
    budget: content.budgetOptions[0],
    message: ''
  });
  const submitRef = useRef<HTMLDivElement>(null);

  // Sync selection defaults when language changes
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      projectType: content.projectTypes[0],
      budget: content.budgetOptions[0]
    }));
  }, [lang, content.projectTypes, content.budgetOptions]);

  const scrollToSubmit = () => {
    // Small delay to allow potential keyboard to start showing on mobile
    setTimeout(() => {
      submitRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  };

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        setHoneypot('');
        setStatus('idle');
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Honeypot check
    if (honeypot) {
      console.warn("Bot detected via honeypot");
      setStatus('success'); // Fake success for bots
      setTimeout(() => {
        onClose();
        setStatus('idle');
      }, 2000);
      return;
    }

    setStatus('sending');
    
    try {
      console.log("Sending contact request via /api/contact...");
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          message: formData.message,
          company: formData.projectType,
          service: formData.budget,
          honeypot: honeypot
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to send message.");
      }

      console.log("Contact request sent successfully.");
      setStatus('success');
      setTimeout(() => {
        onClose();
        setStatus('idle');
        setFormData({
          name: '',
          email: '',
          projectType: content.projectTypes[0],
          budget: content.budgetOptions[0],
          message: ''
        });
      }, 5000); // 5 seconds for success message
    } catch (error) {
      console.error("Error submitting contact form:", error);
      setStatus('error');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[600] bg-black/80 backdrop-blur-2xl"
            style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
          />
          
          {/* Sticky Close Button & Lang Switcher */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 md:top-10 md:right-12 z-[610] flex items-center gap-4"
          >
            <div className="flex bg-white/5 backdrop-blur-2xl border border-white/10 rounded-full p-1" style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
              {(['EN', 'RU'] as Language[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all duration-300 ${
                    lang === l ? 'bg-white text-black' : 'text-white/40 hover:text-white'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <button 
              onClick={onClose}
              className="p-4 rounded-full bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white hover:text-black transition-all duration-500 group"
            >
              <CloseIcon size={24} className="group-hover:rotate-90 transition-transform duration-500" />
            </button>
          </motion.div>

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 200 }}
            className="fixed inset-0 z-[601] pointer-events-none"
          >
            <div 
              data-lenis-prevent
              className="w-full h-full pointer-events-auto overflow-y-auto pt-32 pb-12 px-6 md:px-12 custom-scrollbar"
            >
              <div className="max-w-4xl w-full">
                {/* Header aligned with PriceListModal */}
                <div className="mb-16 border-b border-white/10 pb-12">
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[10px] uppercase tracking-[0.4em] text-white/40 mb-4 font-bold"
                  >
                    {lang === 'RU' ? 'Обсудим ваш проект' : 'Let\'s discuss your project'}
                  </motion.div>
                  <motion.h2 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-5xl md:text-7xl font-bold uppercase tracking-tightest mb-6 leading-none"
                  >
                    {content.title}
                  </motion.h2>
                  <motion.p 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-muted text-lg md:text-xl font-light max-w-xl leading-relaxed"
                  >
                    {lang === 'RU' ? 'Заполните форму ниже, и я свяжусь с вами в ближайшее время.' : 'Fill out the form below and I will get back to you as soon as possible.'}
                  </motion.p>
                </div>

                {status === 'success' ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="py-12 flex flex-col items-start"
                  >
                    <div className="w-16 h-16 bg-white text-black rounded-full flex items-center justify-center mb-8">
                      <ArrowUpRight size={32} className="rotate-45" />
                    </div>
                    <p className="text-2xl md:text-4xl font-bold tracking-tightest uppercase leading-none max-w-xl">{content.success}</p>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="flex flex-col gap-2 max-w-3xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <label 
                        className="group bg-white/5 backdrop-blur-md border border-white/10 p-6 md:p-8 rounded-none hover:bg-white/10 hover:border-white/20 transition-all duration-500 cursor-text"
                        style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
                      >
                        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/40 block mb-2">{content.name}</span>
                        <input 
                          required
                          type="text" 
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          placeholder={lang === 'RU' ? 'Введите имя' : 'Enter name'}
                          className="w-full bg-transparent outline-none text-lg md:text-2xl font-bold tracking-tightest uppercase placeholder:text-white/10 leading-none"
                        />
                      </label>
                      <label 
                        className="group bg-white/5 backdrop-blur-md border border-white/10 p-6 md:p-8 rounded-none hover:bg-white/10 hover:border-white/20 transition-all duration-500 cursor-text"
                        style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
                      >
                        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/40 block mb-2">{content.email}</span>
                        <input 
                          required
                          type="email" 
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                          placeholder={lang === 'RU' ? 'example@mail.com' : 'example@mail.com'}
                          className="w-full bg-transparent outline-none text-lg md:text-2xl font-bold tracking-tightest uppercase placeholder:text-white/10 leading-none"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <CustomSelect 
                        label={content.projectType}
                        options={content.projectTypes}
                        value={formData.projectType}
                        onChange={(val) => setFormData({...formData, projectType: val})}
                      />

                      <CustomSelect 
                        label={content.budget}
                        options={content.budgetOptions}
                        value={formData.budget}
                        onChange={(val) => setFormData({...formData, budget: val})}
                      />
                    </div>

                    <label 
                      className="group bg-white/5 backdrop-blur-md border border-white/10 p-6 md:p-8 rounded-none hover:bg-white/10 hover:border-white/20 transition-all duration-500 cursor-text"
                      style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
                    >
                      <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/40 block mb-2">{content.message}</span>
                      <textarea 
                        required
                        rows={4}
                        value={formData.message}
                        onChange={(e) => setFormData({...formData, message: e.target.value})}
                        onFocus={scrollToSubmit}
                        placeholder={lang === 'RU' ? 'Расскажите о вашем проекте...' : 'Tell me about your project...'}
                        className="w-full bg-transparent outline-none text-lg md:text-xl font-light leading-relaxed placeholder:text-white/10 resize-none"
                      />
                    </label>

                    {/* Honeypot */}
                    <div className="hidden" aria-hidden="true">
                      <input 
                        type="text" 
                        name="website" 
                        tabIndex={-1} 
                        autoComplete="off" 
                        value={honeypot}
                        onChange={(e) => setHoneypot(e.target.value)}
                      />
                    </div>

                    <div ref={submitRef} className="pt-12 flex flex-col sm:flex-row gap-4">
                      <button 
                        disabled={status === 'sending'}
                        type="submit"
                        className="group px-8 py-4 bg-white text-black rounded-full font-bold uppercase tracking-widest text-[11px] hover:bg-zinc-200 transition-all disabled:opacity-50 flex-1 sm:flex-none flex items-center justify-center"
                      >
                        <span className="leading-none pt-0.5">{status === 'sending' ? content.sending : content.send}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

ContactModal.displayName = 'ContactModal';

const PriceListModal = memo(({ isOpen, onClose, lang, setLang, onContact, scrollToExtras }: { isOpen: boolean; onClose: () => void; lang: Language; setLang: (l: Language) => void; onContact: () => void; scrollToExtras?: boolean }) => {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const d = priceData[lang];

  useEffect(() => {
    if (isOpen && scrollToExtras) {
      const timer = setTimeout(() => {
        const el = document.getElementById('price-list-extras');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isOpen, scrollToExtras, lang]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-2xl z-[500]"
            style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
          />
          
          {/* Sticky Close Button & Lang Switcher */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 md:top-10 md:right-12 z-[510] flex items-center gap-4"
          >
            <div className="flex bg-white/5 backdrop-blur-2xl border border-white/10 rounded-full p-1" style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
              {(['EN', 'RU'] as Language[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all duration-300 ${
                    lang === l ? 'bg-white text-black' : 'text-white/40 hover:text-white'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <button 
              onClick={onClose}
              className="p-4 rounded-full bg-white/5 backdrop-blur-2xl border border-white/10 hover:bg-white hover:text-black transition-all duration-500 group"
            >
              <CloseIcon size={24} className="group-hover:rotate-90 transition-transform duration-500" />
            </button>
          </motion.div>

          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 200 }}
            className="fixed inset-0 z-[501] pointer-events-none"
          >
            <div 
              data-lenis-prevent
              className="w-full h-full pointer-events-auto overflow-y-auto pt-32 pb-12 px-6 md:px-12 custom-scrollbar"
            >
              <div className="max-w-4xl mx-auto w-full">
              {/* Header */}
              <div className="mb-16 border-b border-white/10 pb-12">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[10px] uppercase tracking-[0.4em] text-white/40 mb-4 font-bold"
                >
                  {lang === 'RU' ? 'Дизайн · Брендинг · Интерфейсы' : 'Design · Branding · Interfaces'}
                </motion.div>
                <motion.h2 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-5xl md:text-7xl font-bold uppercase tracking-tightest mb-6 leading-none"
                >
                  {d.title}
                </motion.h2>
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-muted text-lg md:text-xl font-light max-w-xl leading-relaxed"
                >
                  {d.subtitle}
                </motion.p>
              </div>

              {/* Sections */}
              <div className="space-y-24">
                {d.sections.map((section, sIdx) => (
                  <div key={sIdx} className="relative">
                    <div className="flex flex-col md:flex-row gap-8 md:gap-16 mb-12 border-b border-white/10 pb-8">
                      <div className="text-sm font-bold text-white/20 tracking-widest">{section.num}</div>
                      <div>
                        <h3 className="text-3xl md:text-4xl font-bold uppercase tracking-tightest mb-4">{section.title}</h3>
                        <p className="text-muted font-light max-w-lg">{section.description}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {section.items.map((item, iIdx) => {
                        const isExpanded = expandedItem === item.id;
                        return (
                          <div 
                            key={iIdx} 
                            onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                            className={`group bg-white/5 backdrop-blur-md border border-white/10 p-4 md:p-6 rounded-none hover:bg-white/10 hover:border-white/20 transition-all duration-500 cursor-pointer ${isExpanded ? 'bg-white/10 border-white/30' : ''}`}
                            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
                          >
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                              <h4 className="text-lg md:text-xl font-bold uppercase tracking-tightest group-hover:translate-x-2 transition-transform duration-500">{item.title}</h4>
                              <div className="flex items-center justify-between w-full md:w-auto gap-6">
                                <span className="text-[10px] uppercase tracking-widest px-3 py-1 bg-white/10 rounded-full text-white/60 hidden sm:inline-block">{item.time}</span>
                                <span className="text-base md:text-lg font-bold tracking-tightest text-white uppercase ml-auto">{item.price}</span>
                                <div className={`p-1.5 rounded-full border border-white/10 transition-transform duration-500 ${isExpanded ? 'rotate-180 bg-white text-black' : ''}`}>
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m6 9 6 6 6-6"/>
                                  </svg>
                                </div>
                              </div>
                            </div>
                            
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                                  className="overflow-hidden"
                                >
                                  <div className="pt-8 mt-8 border-t border-white/10">
                                    <p className="text-muted font-light text-base md:text-lg leading-relaxed mb-8 max-w-2xl">
                                      {item.details}
                                    </p>
                                    <div className="flex flex-col md:flex-row gap-8 justify-between items-end">
                                      <div className="flex flex-wrap gap-x-8 gap-y-3 flex-1">
                                        {item.features.map((f, fIdx) => (
                                          <div key={fIdx} className="flex items-center gap-2 text-sm text-muted font-light">
                                            <span className="w-1.5 h-1.5 bg-white/40 rounded-full" />
                                            {f}
                                          </div>
                                        ))}
                                      </div>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onClose();
                                          onContact();
                                        }}
                                        className="px-8 py-3 bg-white text-black rounded-full font-bold uppercase tracking-widest text-[10px] hover:bg-zinc-200 transition-all flex items-center gap-2 group/btn"
                                      >
                                        {d.contactBtn}
                                        <ArrowUpRight size={14} className="group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                    {section.note && (
                      <div className="mt-8 p-6 bg-white/5 border border-white/5 rounded-none text-sm text-muted font-light italic">
                        {section.note}
                      </div>
                    )}
                  </div>
                ))}

                {/* Extra Section */}
                <div id="price-list-extras" className="pt-12 border-t border-white/10">
                  <h3 className="text-xs uppercase tracking-[0.3em] font-bold text-white/40 mb-12">{d.extra.title}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {d.extra.items.map((item, idx) => (
                        <div key={idx} className="p-8 border border-white/10 rounded-none bg-white/2 hover:bg-white/5 hover:border-white/20 transition-all duration-500 group/extra">
                          <div className="text-[10px] uppercase tracking-widest text-white/30 mb-4 group-hover/extra:text-white/50 transition-colors">{item.name}</div>
                          <div className="text-xl font-bold tracking-tightest mb-2 group-hover/extra:translate-x-1 transition-transform duration-500">{item.price}</div>
                          {item.desc && <div className="text-xs text-muted font-light group-hover/extra:text-white/40 transition-colors">{item.desc}</div>}
                        </div>
                      ))}
                    </div>
                </div>

                {/* Terms Section */}
                <div className="pt-12 border-t border-white/10 pb-12">
                  <h3 className="text-xs uppercase tracking-[0.3em] font-bold text-white/40 mb-12">{d.terms.title}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    {d.terms.blocks.map((block, idx) => (
                      <div key={idx}>
                        <h4 className="text-sm font-bold uppercase tracking-widest mb-6">{block.title}</h4>
                        <ul className="space-y-4">
                          {block.items.map((item, iIdx) => (
                            <li key={iIdx} className="flex gap-4 text-sm text-muted font-light leading-relaxed">
                              <span className="text-white/20">—</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pb-24 pt-12 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-8">
                <p className="text-muted text-lg font-light text-center md:text-left leading-relaxed">
                  {lang === 'RU' ? 'Заполнить заявку / Написать на почту' : 'Fill the form / Contact via email'}
                </p>
                <button 
                  onClick={() => {
                    onClose();
                    onContact();
                  }}
                  className="px-8 py-4 bg-white text-black rounded-full font-bold uppercase tracking-widest text-[11px] hover:bg-zinc-200 transition-all flex items-center justify-center gap-3 group"
                >
                  <span className="translate-y-[0.5px]">
                    {lang === 'RU' ? 'Связаться' : 'Get in touch'}
                  </span>
                  <div className="w-6 h-6 rounded-full border border-black/10 flex items-center justify-center group-hover:rotate-45 transition-all duration-500">
                    <ArrowUpRight size={14} />
                  </div>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);
});

PriceListModal.displayName = 'PriceListModal';

/*
const ShopProductModal = memo(({ 
  isOpen, 
  onClose, 
  product, 
  buyNowText 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  product: ShopProduct | null; 
  buyNowText: string;
}) => {
  if (!product) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/95 md:bg-black/80 md:backdrop-blur-2xl z-[700]"
          />
          
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 md:top-10 md:right-12 z-[720]"
          >
            <button 
              onClick={onClose}
              className="p-4 rounded-full bg-white/5 backdrop-blur-2xl border border-white/10 hover:bg-white hover:text-black transition-all duration-500 group"
            >
              <CloseIcon size={24} className="group-hover:rotate-90 transition-transform duration-500" />
            </button>
          </motion.div>

          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 200 }}
            className="fixed inset-0 z-[710] pointer-events-none"
          >
            <div 
              data-lenis-prevent
              className="w-full h-full pointer-events-auto overflow-y-auto pt-32 pb-12 px-6 md:px-12 custom-scrollbar"
            >
              <div className="min-h-full flex items-center justify-center">
                <div className="max-w-6xl mx-auto w-full">
                  <div className="flex flex-col lg:flex-row gap-12 lg:gap-24 items-center">
                    // Left: Image
                    <div className="w-full lg:w-1/2 aspect-square relative overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center p-12 lg:p-24">
                      <img 
                        src={product.image} 
                        alt={product.title} 
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                        decoding="async"
                        loading="lazy"
                      />
                    </div>

                    // Right: Content
                    <div className="w-full lg:w-1/2 flex flex-col items-start text-left">
                      <div className="text-[10px] uppercase tracking-[0.4em] text-white/40 mb-6 font-bold">
                        Product Details
                      </div>
                      <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold uppercase tracking-tightest mb-6 leading-none">
                        {product.title}
                      </h2>
                      <div className="text-2xl md:text-3xl font-bold tracking-tightest mb-8 text-white/80">
                        {product.price}
                      </div>
                      <p className="text-muted text-lg md:text-xl font-light leading-relaxed mb-12 max-w-xl">
                        {product.description}
                      </p>

                      <a 
                        href={product.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center justify-between gap-8 px-10 py-5 bg-white text-black rounded-full hover:bg-zinc-200 transition-all duration-500"
                      >
                        <span className="text-xs uppercase tracking-widest font-bold leading-none pt-0.5">{buyNowText}</span>
                        <div className="w-8 h-8 rounded-full border border-black/10 flex items-center justify-center group-hover:rotate-45 transition-all duration-500">
                          <ArrowUpRight size={18} />
                        </div>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
});

ShopProductModal.displayName = 'ShopProductModal';
*/

/*
const ShopProductCard = memo(({ 
  product, 
  index, 
  fadeIn, 
  onClick, 
  buyNowLabel 
}: { 
  product: ShopProduct; 
  index: number; 
  fadeIn?: FadeInProps; 
  onClick: (product: ShopProduct) => void;
  buyNowLabel: string;
}) => {
  const animationProps = fadeIn ? {
    ...fadeIn,
    transition: { ...fadeIn.transition, delay: index * 0.1 }
  } : {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: index * 0.05 }
  };

  return (
    <motion.div
      {...animationProps}
      onClick={() => onClick(product)}
      className="group cursor-pointer flex flex-col gap-3"
    >
      // Image Container
      <div className="aspect-square overflow-hidden relative rounded-2xl bg-[#0d0d0d] border border-white/10 flex items-center justify-center p-14 transition-all duration-500 group-hover:border-white/20 group-hover:bg-[#121212]">
        <img 
          src={product.image} 
          alt={product.title} 
          className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105"
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
        />
        
        // Hover Overlay with Buy Now
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center">
          <div className="px-5 py-2 bg-white text-black rounded-full font-bold uppercase tracking-widest text-[9px] transform translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
            {buyNowLabel}
          </div>
        </div>
      </div>

      // Content
      <div className="flex flex-col gap-1 px-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[14px] md:text-[16px] font-bold uppercase tracking-tight group-hover:text-white transition-colors line-clamp-1">
            {product.title}
          </h3>
          <div className="flex-shrink-0 px-2 py-0.5 bg-white/10 rounded-full text-[9px] font-bold tracking-widest text-white/60 group-hover:text-white transition-colors">
            {product.price}
          </div>
        </div>
        <p className="text-[#666666] text-[12px] md:text-[13px] font-medium leading-tight line-clamp-1">
          {product.description}
        </p>
      </div>
    </motion.div>
  );
});

ShopProductCard.displayName = 'ShopProductCard';
*/

/*
const ShopSection = ({ 
  shop, 
  fadeIn, 
  onProductClick,
  onViewAllClick
}: { 
  shop: { title: string; buyNow: string; viewAll: string; items: ShopProduct[] }; 
  fadeIn: FadeInProps; 
  onProductClick: (product: ShopProduct) => void;
  onViewAllClick: () => void;
}) => {
  return (
    <section id="shop" className="mb-24 md:mb-32 pt-8 md:pt-12 grid grid-cols-1 md:grid-cols-12 gap-12 scroll-mt-16 relative">
      <div className="md:col-span-4">
        <motion.h2 {...fadeIn} className="text-sm md:text-base uppercase tracking-[0.2em] font-bold text-muted mb-8">
          {shop.title}
        </motion.h2>
      </div>
      <div className="md:col-span-8">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-8 md:gap-6">
          {shop.items.slice(0, 6).map((product: ShopProduct, i: number) => (
            <ShopProductCard 
              key={i}
              product={product}
              index={i}
              fadeIn={fadeIn}
              onClick={onProductClick}
              buyNowLabel={shop.buyNow}
            />
          ))}
        </div>

        {shop.items.length > 6 && (
          <motion.div 
            layout
            {...fadeIn}
            className="mt-16 flex justify-center md:justify-end"
          >
            <button 
              onClick={onViewAllClick}
              className="group flex items-center gap-4 px-8 py-4 border border-white/20 rounded-full hover:bg-white hover:text-black transition-all duration-500"
            >
              <span className="text-xs uppercase tracking-widest font-bold">{shop.viewAll}</span>
              <div className="w-8 h-8 rounded-full border border-white/20 group-hover:border-current flex items-center justify-center transition-all duration-500">
                <Plus size={16} />
              </div>
            </button>
          </motion.div>
        )}
      </div>
    </section>
  );
};
*/

/*
const FullShopModal = memo(({ 
  isOpen, 
  onClose, 
  shop,
  onProductClick
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  shop: { title: string; buyNow: string; items: ShopProduct[] };
  onProductClick: (product: ShopProduct) => void;
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] bg-black/95 md:bg-black/90 md:backdrop-blur-2xl flex flex-col"
        >
          // Header
          <div className="px-6 md:px-12 py-8 flex justify-between items-center border-b border-white/10">
            <h2 className="text-2xl md:text-4xl font-bold uppercase tracking-tightest">{shop.title}</h2>
            <button 
              onClick={onClose}
              className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-white hover:text-black transition-all duration-500"
            >
              <CloseIcon size={24} />
            </button>
          </div>

          // Content
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">
              {shop.items.map((product, i) => (
                <ShopProductCard 
                  key={i}
                  product={product}
                  index={i}
                  onClick={onProductClick}
                  buyNowLabel={shop.buyNow}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

FullShopModal.displayName = 'FullShopModal';
*/

const DEFAULT_PROJECTS: Project[] = [
  {
    id: "default-1",
    title: "Colizeum Esports Arena",
    category: "Branding & Identity",
    image: "/materials/card1.png",
    link: "https://t.me/marselspace",
    order: 1,
    translations: {
      EN: { title: "Colizeum Esports Arena", category: "Branding & Identity" },
      RU: { title: "Colizeum Esports Arena", category: "Брендинг и Айдентика" }
    }
  },
  {
    id: "default-2",
    title: "Hookah Place",
    category: "Visual Identity & Menu Design",
    image: "/materials/card2.png",
    link: "https://t.me/marselspace",
    order: 2,
    translations: {
      EN: { title: "Hookah Place", category: "Visual Identity & Menu Design" },
      RU: { title: "Hookah Place", category: "Айдентика и Меню" }
    }
  },
  {
    id: "default-3",
    title: "Indastrum Corporation",
    category: "Industrial Branding & Web Design",
    image: "/materials/card3.png",
    link: "https://t.me/marselspace",
    order: 3,
    translations: {
      EN: { title: "Indastrum Corporation", category: "Industrial Corporate Branding" },
      RU: { title: "Indastrum Corporation", category: "Промышленный брендинг" }
    }
  },
  {
    id: "default-4",
    title: "Gleb Solomin Channel",
    category: "SMM & Social Media Art Direction",
    image: "/materials/card4.png",
    link: "https://t.me/marselspace",
    order: 4,
    translations: {
      EN: { title: "Gleb Solomin Channel", category: "SMM & YouTube Art Direction" },
      RU: { title: "Канал Глеба Соломина", category: "Оформление Youtube и SMM" }
    }
  }
];

const DEFAULT_DRIBBBLE_PROJECTS: Project[] = [
  {
    id: "dribbble-1",
    title: "Minimalist Mobile Wallet UI",
    category: "UI/UX & Mobile App Design",
    image: "/materials/card1.png",
    link: "https://dribbble.com/hellomarsel",
    order: 1,
    translations: {
      EN: { title: "Minimalist Mobile Wallet UI", category: "UI/UX Design" },
      RU: { title: "Минималистичный криптокошелек", category: "UI/UX Дизайн" }
    }
  },
  {
    id: "dribbble-2",
    title: "Typography Poster Design System",
    category: "Graphic Design & Typography",
    image: "/materials/card3.png",
    link: "https://dribbble.com/hellomarsel",
    order: 2,
    translations: {
      EN: { title: "Typography Poster Design System", category: "Graphic Design" },
      RU: { title: "Типографическая дизайн-система постеров", category: "Графический дизайн" }
    }
  }
];

// ==================== MobileExperience ====================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MobileExperience = ({ items }: { items: any[] }) => {
  return (
    <div id="mobile-experience-blocks" className="lg:hidden -mx-6 md:-mx-12 flex flex-col relative">
      {items.map((item, i) => {
        const styles = [
          { bg: 'bg-[#2F794F]', text: 'text-[#FEFAE0]', secondary: 'text-[#FEFAE0]/70' },
          { bg: 'bg-[#FFD100]', text: 'text-[#202020]', secondary: 'text-[#202020]/70' },
          { bg: 'bg-[#3116FB]', text: 'text-[#FFFFFF]', secondary: 'text-[#FFFFFF]/70' },
          { bg: 'bg-[#E3363A]', text: 'text-[#FFFFFF]', secondary: 'text-[#FFFFFF]/70' }
        ][i % 4];

        return (
          <div
            key={i}
            className={`sticky top-0 h-[100dvh] flex flex-col justify-center overflow-hidden transition-colors duration-700 ${styles.bg}`}
          >
            <div className={`absolute inset-0 transition-colors duration-700 -z-10 ${styles.bg}`} />
            
            <div className="px-6 md:px-12 pt-[max(100px,15vh)] pb-[max(60px,8vh)] space-y-6 relative z-10">
              <motion.span 
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.15 }}
                transition={{ duration: 0.4, delay: 0.05 }}
                className={`block text-[10px] uppercase tracking-[0.2em] font-bold transition-colors duration-500 ${styles.secondary}`}
              >
                {item.year}
              </motion.span>

              <motion.h4 
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.15 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className={`text-lg font-bold uppercase tracking-tightest transition-colors duration-500 ${styles.text}`}
              >
                {item.company}
              </motion.h4>

              <motion.h3 
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.15 }}
                transition={{ duration: 0.4, delay: 0.15 }}
                className={`text-2xl font-bold tracking-tightest uppercase transition-colors duration-500 ${styles.text}`}
              >
                {item.title}
              </motion.h3>

              <motion.p 
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.15 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className={`text-base font-light leading-relaxed max-w-xl transition-colors duration-500 ${styles.secondary}`}
              >
                {item.description}
              </motion.p>

              {item.image && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  whileInView={{ opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: false, amount: 0.15 }}
                  transition={{ duration: 0.5, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full aspect-square overflow-hidden rounded-none border border-white/10"
                >
                  <img
                    src={item.image}
                    alt=""
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </motion.div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ==================== DesktopExperience ====================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DesktopExperience = ({ items, hoveredRoadmapIndex, setHoveredRoadmapIndex, setHoveredRoadmapImage }: { items: any[], hoveredRoadmapIndex: number | null, setHoveredRoadmapIndex: (i: number | null) => void, setHoveredRoadmapImage: (i: string | null) => void }) => {
  return (
    <div 
      className="hidden lg:flex flex-col border-y border-white/10 divide-y divide-white/10 -mx-6 md:-mx-12"
      data-roadmap-active={hoveredRoadmapIndex !== null && window.innerWidth >= 1024 ? "true" : "false"}
      onMouseLeave={() => {
        setHoveredRoadmapIndex(null);
        setHoveredRoadmapImage(null);
      }}
    >
      {items.map((item, i) => {
        const styles = [
          { bg: 'bg-[#2F794F]', text: 'text-[#FEFAE0]', secondary: 'text-[#FEFAE0]/70' },
          { bg: 'bg-[#FFD100]', text: 'text-[#202020]', secondary: 'text-[#202020]/70' },
          { bg: 'bg-[#3116FB]', text: 'text-[#FFFFFF]', secondary: 'text-[#FFFFFF]/70' },
          { bg: 'bg-[#E3363A]', text: 'text-[#FFFFFF]', secondary: 'text-[#FFFFFF]/70' }
        ][i % 4];
        const isHovered = hoveredRoadmapIndex === i;

        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            onPointerEnter={() => {
              setHoveredRoadmapIndex(i);
              setHoveredRoadmapImage(item.image || null);
            }}
            data-roadmap-item
            data-roadmap-index={i}
            data-roadmap-image={item.image}
            className={`group relative min-h-[85vh] lg:min-h-0 lg:h-auto flex flex-col justify-center overflow-hidden transition-all duration-700 ${
              isHovered ? styles.bg : 'bg-transparent'
            }`}
          >
            <div className={`absolute inset-0 transition-colors duration-700 z-0 ${isHovered ? styles.bg : 'bg-transparent'}`} />
            <div className="py-14 px-12 grid grid-cols-12 gap-8 relative z-10 pointer-events-none transition-all duration-700">
              <div className="col-span-3">
                <span className={`text-[10px] uppercase tracking-[0.2em] font-bold block mb-2 transition-colors duration-500 ${
                  isHovered ? styles.secondary : 'text-white/40'
                }`}>
                  {item.year}
                </span>
                <h4 className={`text-lg font-bold uppercase tracking-tightest transition-colors duration-500 ${
                  isHovered ? styles.text : 'text-white'
                }`}>
                  {item.company}
                </h4>
              </div>
              <div className="col-span-9">
                <h3 className={`text-2xl md:text-3xl font-bold tracking-tightest mb-4 uppercase transition-colors duration-500 ${
                  isHovered ? styles.text : 'text-white'
                }`}>
                  {item.title}
                </h3>
                <p className={`text-base md:text-lg font-light leading-relaxed max-w-2xl transition-colors duration-500 ${
                  isHovered ? styles.secondary : 'text-muted'
                }`}>
                  {item.description}
                </p>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [lang, setLang] = useState<Language>('EN');
  const [scrolled, setScrolled] = useState(false);
  const [isExperienceActive, setIsExperienceActive] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isPriceListOpen, setIsPriceListOpen] = useState(false);
  const [priceListScrollToExtras, setPriceListScrollToExtras] = useState(false);
  // const [isShopModalOpen, setIsShopModalOpen] = useState(false);
  // const [isFullShopModalOpen, setIsFullShopModalOpen] = useState(false);
  // const [selectedShopProduct, setSelectedShopProduct] = useState<ShopProduct | null>(null);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDataReady, setIsDataReady] = useState(false);
  const [hasMouseMoved, setHasMouseMoved] = useState(false);
  const lenisRef = useRef<Lenis | null>(null);

  // Dynamic Content State (Projects only, populated with custom fallback projects initially)
  const [projects, setProjects] = useState<Project[]>(DEFAULT_PROJECTS);
  const [dribbbleProjects, setDribbbleProjects] = useState<Project[]>(DEFAULT_DRIBBBLE_PROJECTS);
  // const [shopProducts, setShopProducts] = useState<ShopProduct[]>([]);
  const [activeWorkTab, setActiveWorkTab] = useState<'projects' | 'dribbble'>('projects');
  const getInitialVisibleProjects = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return 5;
    return 6;
  };
  const [visibleProjects, setVisibleProjects] = useState(getInitialVisibleProjects());

  // Advanced Preload Logic (Static Assets + Clients Logos + Roadmap items + Firestore Projects)
  const [targetUrls, setTargetUrls] = useState<string[]>(() => {
    return [
      ASSETS.LOGO_URL,
      ASSETS.PRELOADER_LOGOTYPE,
      ASSETS.HERO.BG_DESKTOP,
      ASSETS.HERO.BG_MOBILE,
      ASSETS.ABOUT.AVATAR_PRIMARY,
      ASSETS.PRICING.HEADER,
      ASSETS.EXPERIENCE.ITEM_1,
      ASSETS.EXPERIENCE.ITEM_2,
      ASSETS.EXPERIENCE.ITEM_3,
      ASSETS.EXPERIENCE.ITEM_4,
      ...ASSETS.CLIENTS
    ].filter(Boolean);
  });
  const [loadedUrls, setLoadedUrls] = useState<Set<string>>(new Set());

  // 1. Dynamically add Firestore visual project items as soon as they are loaded to prevent layout flashing/flickering
  useEffect(() => {
    if (projects.length > 0 || dribbbleProjects.length > 0) {
      const projImages = [
        ...projects.map(p => p.image).filter(Boolean),
        ...dribbbleProjects.map(p => p.image).filter(Boolean)
      ];
      if (projImages.length > 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTargetUrls((prev) => {
          const unique = new Set([...prev, ...projImages]);
          return Array.from(unique);
        });
      }
    }
  }, [projects, dribbbleProjects]);

  // 2. Continuously pre-cache targeted images and update loaded tracker
  useEffect(() => {
    if (targetUrls.length === 0) return;

    let active = true;

    // Safety timeout fallback (maximum 4.5 seconds) to ensure the loader never blocks the application
    const safetyTimer = setTimeout(() => {
      if (active) {
        setIsDataReady(true);
      }
    }, 4500);

    targetUrls.forEach((url) => {
      if (loadedUrls.has(url)) return;

      const img = new Image();
      img.src = url;
      
      const handleLoad = () => {
        if (!active) return;
        setLoadedUrls((prev) => {
          if (prev.has(url)) return prev;
          const next = new Set(prev);
          next.add(url);
          return next;
        });
      };

      img.onload = handleLoad;
      img.onerror = handleLoad;
    });

    return () => {
      active = false;
      clearTimeout(safetyTimer);
    };
  }, [targetUrls, loadedUrls]);

  // 3. Update and flip isReady when 100% is reached
  useEffect(() => {
    const totalToLoad = Math.max(targetUrls.length, 1);
    const loadedCount = loadedUrls.size;
    
    if (loadedCount >= totalToLoad) {
      const timer = setTimeout(() => {
        setIsDataReady(true);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [loadedUrls, targetUrls]);
  const projectsEndRef = useRef<HTMLDivElement>(null);

  const [hoveredRoadmapIndex, setHoveredRoadmapIndex] = useState<number | null>(null);
  const [hoveredRoadmapImage, setHoveredRoadmapImage] = useState<string | null>(null);
  const [activeRoadmapScrollIndex, setActiveRoadmapScrollIndex] = useState<number | null>(null);

  const activeRoadmapScrollIndexRef = useRef<number | null>(null);

  // Sync ref to latest index state cleanly
  useEffect(() => {
    activeRoadmapScrollIndexRef.current = activeRoadmapScrollIndex;
  }, [activeRoadmapScrollIndex]);

  // Observe active roadmap / experience item dynamically
  useEffect(() => {
    if (typeof window === 'undefined' || window.innerWidth >= 1024) return;

    const handleScrollAndStates = () => {
      const elementsList = document.querySelectorAll('[data-roadmap-item]');
      if (elementsList.length === 0) return;

      const viewportCenter = window.innerHeight / 2;
      let closestIndex: number | null = null;
      let closestDistance = Infinity;

      const threshold = window.innerWidth < 1024 ? window.innerHeight * 0.65 : 120;

      elementsList.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const cardCenter = (rect.top + rect.bottom) / 2;
        const distance = Math.abs(cardCenter - viewportCenter);

        if (distance < threshold) {
          if (distance < closestDistance) {
            closestDistance = distance;
            const indexAttr = el.getAttribute('data-roadmap-index');
            if (indexAttr !== null) {
              closestIndex = parseInt(indexAttr, 10);
            }
          }
        }
      });

      if (closestIndex !== activeRoadmapScrollIndexRef.current) {
        setActiveRoadmapScrollIndex(closestIndex);
      }
    };

    window.addEventListener('scroll', handleScrollAndStates, { passive: true });
    window.addEventListener('resize', handleScrollAndStates);
    
    // Execute immediately to align dynamic scroll and snap states
    handleScrollAndStates();

    return () => {
      window.removeEventListener('scroll', handleScrollAndStates);
      window.removeEventListener('resize', handleScrollAndStates);
      document.documentElement.classList.remove('snap-mandatory');
      document.body.classList.remove('snap-mandatory');
    };
  }, []);

  const mousePos = useRef({ x: 0, y: 0 });
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  const springConfig = { stiffness: 150, damping: 25, mass: 0.5 };
  const springX = useSpring(mouseX, springConfig);
  const springY = useSpring(mouseY, springConfig);

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    mousePos.current = { x: e.clientX, y: e.clientY };
    mouseX.set(e.clientX);
    mouseY.set(e.clientY);
    setHasMouseMoved((prev) => {
      if (!prev) return true;
      return prev;
    });
  }, [mouseX, mouseY]);

  const checkHoverOnScroll = useCallback(() => {
    if (window.innerWidth < 1024) return;
    
    const target = document.elementFromPoint(mousePos.current.x, mousePos.current.y);
    if (!target || typeof target.closest !== 'function') return;

    const item = target.closest('[data-roadmap-item]') as HTMLElement;
    if (item) {
      const index = parseInt(item.getAttribute('data-roadmap-index') || '-1');
      const imageUrl = item.getAttribute('data-roadmap-image');
      
      if (index !== hoveredRoadmapIndex) {
        setHoveredRoadmapIndex(index);
        setHoveredRoadmapImage(imageUrl);
      }
    } else {
      if (hoveredRoadmapIndex !== null) {
        setHoveredRoadmapIndex(null);
        setHoveredRoadmapImage(null);
      }
    }
  }, [hoveredRoadmapIndex]);

  useEffect(() => {
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('scroll', checkHoverOnScroll, { passive: true });
    
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('scroll', checkHoverOnScroll);
    };
  }, [handleGlobalMouseMove, checkHoverOnScroll]);

  // Scroll to new projects when load more is clicked
  useEffect(() => {
    if (visibleProjects > 6 && projectsEndRef.current) {
      projectsEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [visibleProjects]);

  const handlePreloaderComplete = useCallback(() => {
    setIsLoading(false);
  }, []);

  const t = {
    ...initialContent[lang]
  };
  const logoUrl = defaultLogoUrl;
  const seoSettings = defaultSeoSettings;
  const isAdmin = user?.email === "marselspace@gmail.com" && user?.emailVerified;

  // Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // Fetch Dynamic Content (Projects)
  useEffect(() => {
    const q = query(collection(db, 'projects'), orderBy('order', 'asc'));
    const unsubProjects = onSnapshot(q, (snapshot) => {
      const projs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Project));
      if (projs.length > 0) {
        setProjects(projs);
      } else {
        setProjects(DEFAULT_PROJECTS);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'projects');
      setProjects(DEFAULT_PROJECTS);
    });

    const qDribbble = query(collection(db, 'dribbble_projects'), orderBy('order', 'asc'));
    const unsubDribbble = onSnapshot(qDribbble, (snapshot) => {
      const projs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Project));
      if (projs.length > 0) {
        setDribbbleProjects(projs);
      } else {
        setDribbbleProjects(DEFAULT_DRIBBBLE_PROJECTS);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'dribbble_projects');
      setDribbbleProjects(DEFAULT_DRIBBBLE_PROJECTS);
    });

    /*
    const qShop = query(collection(db, 'shop_products'), orderBy('order', 'asc'));
    const unsubShop = onSnapshot(qShop, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ShopProduct));
      if (items.length > 0) {
        setShopProducts(items);
      } else {
        // Fallback to initial content if Firestore is empty
        setShopProducts(initialContent[lang].shop.items);
      }
      setIsDataReady(true);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'shop_products');
      setShopProducts(initialContent[lang].shop.items);
      setIsDataReady(true);
    });
    */

    // Set data ready when assets are resolved
    // isDataReady is now handled by the image preloader effect

    return () => {
      unsubProjects();
      unsubDribbble();
      // unsubShop();
    };
  }, [lang]);

  // Admin Panel Keyboard Shortcut (Type "marsel" anywhere on the keyboard)
  useEffect(() => {
    let strokeBuffer = "";
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in inputs, textareas, or contenteditable areas
      const target = e.target as HTMLElement;
      if (
        target && 
        (target.tagName === 'INPUT' || 
         target.tagName === 'TEXTAREA' || 
         target.isContentEditable)
      ) {
        return;
      }

      // We only append single characters (ignore Shift, Control, Alt, Arrow keys, etc.)
      if (e.key && e.key.length === 1) {
        strokeBuffer += e.key.toLowerCase();
        
        // Keep the buffer at a reasonable size (last 20 characters)
        if (strokeBuffer.length > 20) {
          strokeBuffer = strokeBuffer.substring(strokeBuffer.length - 20);
        }

        // Check if the buffer ends with "marsel" (EN), "ьфкыуд" (RU layout matching "marsel" keys), or "марсел" (RU spelling)
        if (
          strokeBuffer.endsWith("marsel") || 
          strokeBuffer.endsWith("ьфкыуд") || 
          strokeBuffer.endsWith("марсел")
        ) {
          console.log("Admin Panel Shortcut Triggered via typing 'marsel'");
          setIsAdminPanelOpen(prev => !prev);
          strokeBuffer = ""; // Clear buffer after activation
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true); // Use capture to ensure it's caught
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  // Update Document Head (SEO)
  useEffect(() => {
    document.title = seoSettings.siteTitle;
    
    // Update Favicon
    let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }
    favicon.href = seoSettings.faviconUrl || '/favicon.ico';

    // Update Meta Tags
    const updateMeta = (name: string, content: string, property = false) => {
      if (!content) return;
      const attr = property ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attr}="${name}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attr, name);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    updateMeta('description', seoSettings.seoDescription);
    updateMeta('keywords', seoSettings.seoKeywords);
    
    // Open Graph
    updateMeta('og:title', seoSettings.ogTitle || seoSettings.siteTitle, true);
    updateMeta('og:description', seoSettings.ogDescription || seoSettings.seoDescription, true);
    if (seoSettings.ogImage) updateMeta('og:image', seoSettings.ogImage, true);
    updateMeta('og:type', 'website', true);
    
    let safeHref = 'https://t.me/marselspace';
    try {
      safeHref = window.location.href;
    } catch (e) {
      console.warn("Failed to read window.location.href inside restricted environment, using fallback.", e);
    }
    updateMeta('og:url', safeHref, true);

    // Twitter
    updateMeta('twitter:card', 'summary_large_image');
    updateMeta('twitter:title', seoSettings.ogTitle || seoSettings.siteTitle);
    updateMeta('twitter:description', seoSettings.ogDescription || seoSettings.seoDescription);
    if (seoSettings.ogImage) updateMeta('twitter:image', seoSettings.ogImage);

  }, [seoSettings]);

  const updateProjects = async (newProjects: Project[]) => {
    if (!isAdmin) return;
    const path = 'projects';
    try {
      // Get current project IDs to handle deletions
      const currentProjectsSnap = await getDocs(collection(db, 'projects'));
      const currentIds = currentProjectsSnap.docs.map(doc => doc.id);
      const newIds = newProjects.map(p => p.id).filter(Boolean) as string[];
      
      const toDelete = currentIds.filter(id => !newIds.includes(id));
      
      // Delete removed projects
      for (const id of toDelete) {
        await deleteDoc(doc(db, 'projects', id));
      }

      // Update or add projects
      for (const proj of newProjects) {
        const id = proj.id || doc(collection(db, 'projects')).id;
        const data = { ...proj };
        delete data.id;
        await setDoc(doc(db, 'projects', id), {
          ...data,
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const updateDribbbleProjects = async (newProjects: Project[]) => {
    if (!isAdmin) return;
    const path = 'dribbble_projects';
    try {
      const currentSnap = await getDocs(collection(db, path));
      const currentIds = currentSnap.docs.map(doc => doc.id);
      const newIds = newProjects.map(p => p.id).filter(Boolean) as string[];
      
      const toDelete = currentIds.filter(id => !newIds.includes(id));
      
      for (const id of toDelete) {
        await deleteDoc(doc(db, path, id));
      }

      for (const proj of newProjects) {
        const id = proj.id || doc(collection(db, path)).id;
        const data = { ...proj };
        delete data.id;
        await setDoc(doc(db, path, id), {
          ...data,
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection-test'));
      } catch (error) {
        if(error instanceof Error) {
          console.error("Firestore connection test failed:", error.message);
          if (error.message.includes('the client is offline') || error.message.includes('unavailable')) {
            console.error("Please check your Firebase configuration. ");
          }
        }
      }
    }
    testConnection();
  }, []);

  useLayoutEffect(() => {
    // Disable on touch devices for better performance if requested/needed
    if (window.innerWidth < 1024) return;

    const l = new Lenis({
      lerp: 0.1,
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
      infinite: false,
      syncTouch: false,
    });

    lenisRef.current = l;

    let rafId: number;
    function raf(time: number) {
      l.raf(time);
      rafId = requestAnimationFrame(raf);
    }

    rafId = requestAnimationFrame(raf);

    // Fix for jerky scrolling: Update Lenis on resize and content changes
    let resizeObserver: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        l.resize();
      });
      resizeObserver.observe(document.body);
    }

    return () => {
      l.destroy();
      cancelAnimationFrame(rafId);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      // Background appears when scrolled a bit (100px) on desktop to feel immediate but clean
      // On mobile, keep the early activation (50px)
      const threshold = window.innerWidth >= 1024 ? 100 : 50;
      setScrolled(window.scrollY > threshold);

      if (window.innerWidth < 1024) {
        const experienceEl = document.getElementById('mobile-experience-blocks');
        if (experienceEl) {
          const rect = experienceEl.getBoundingClientRect();
          // Check if experience section is intersecting with top of viewport
          setIsExperienceActive(rect.top <= 80 && rect.bottom >= 80);
        } else {
          setIsExperienceActive(false);
        }
      } else {
        setIsExperienceActive(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    // Initial check
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (isMenuOpen || isContactModalOpen || isPriceListOpen || isAdminPanelOpen || isLoading) {
      document.body.style.overflow = 'hidden';
      lenisRef.current?.stop();
    } else {
      document.body.style.overflow = 'unset';
      lenisRef.current?.start();
    }
  }, [isMenuOpen, isContactModalOpen, isPriceListOpen, isAdminPanelOpen, isLoading]);

  const closeMenu = () => setIsMenuOpen(false);

  const smoothScrollToElement = (targetElement: HTMLElement, offset: number = -80, duration: number = 1600) => {
    const start = window.scrollY;
    const rect = targetElement.getBoundingClientRect();
    const target = start + rect.top + offset;
    const distance = target - start;
    let startTime: number | null = null;

    const animateScroll = (currentTime: number) => {
      if (startTime === null) startTime = currentTime;
      const timeElapsed = currentTime - startTime;
      const progress = Math.min(timeElapsed / duration, 1);
      
      // Quartic ease-out curve for premium luxury feel deceleration
      const ease = 1 - Math.pow(1 - progress, 4);
      
      window.scrollTo(0, start + distance * ease);

      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      }
    };

    requestAnimationFrame(animateScroll);
  };

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    
    const element = document.getElementById(id);
    
    // Close menu first
    closeMenu();
    
    if (element) {
      // Small delay to allow menu to start closing and lenis to re-enable
      setTimeout(() => {
        if (lenisRef.current) {
          lenisRef.current.start();
          lenisRef.current.scrollTo(element, {
            offset: -80,
            duration: 1.8, // Increased for a more majestic, luxurious glide
            easing: (t) => 1 - Math.pow(1 - t, 4), // Custom quartic ease-out for ultra smoothness
          });
        } else {
          smoothScrollToElement(element, -80, 1600);
        }
      }, 100);
    }
  };

  const fadeIn = {
    initial: { opacity: 0, y: window.innerWidth < 768 ? 10 : 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-20px" },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } as any
  };

  return (
    <ErrorBoundary>
      <div data-app-wrapper className="min-h-screen bg-black text-white selection:bg-white selection:text-black md:cursor-none overflow-x-clip">
      <AnimatePresence>
        {isLoading && <Preloader onComplete={handlePreloaderComplete} isReady={isDataReady} branding={t.branding} />}
      </AnimatePresence>
      
      <CustomCursor />
      
      <ContactModal 
        isOpen={isContactModalOpen} 
        onClose={() => setIsContactModalOpen(false)} 
        content={t.contact.modal}
        lang={lang}
        setLang={setLang}
      />

      <PriceListModal 
        isOpen={isPriceListOpen} 
        onClose={() => {
          setIsPriceListOpen(false);
          setPriceListScrollToExtras(false);
        }} 
        lang={lang} 
        setLang={setLang}
        onContact={() => setIsContactModalOpen(true)}
        scrollToExtras={priceListScrollToExtras}
      />

      {/* Shop Modals - Hidden for now
      <ShopProductModal 
        isOpen={isShopModalOpen}
        onClose={() => setIsShopModalOpen(false)}
        product={selectedShopProduct}
        buyNowText={t.shop.buyNow}
      />

      <FullShopModal 
        isOpen={isFullShopModalOpen}
        onClose={() => setIsFullShopModalOpen(false)}
        shop={{ ...t.shop, items: shopProducts }}
        onProductClick={(product) => {
          setSelectedShopProduct(product);
          setIsShopModalOpen(true);
        }}
      />
      */}

      <AdminPanel 
        isOpen={isAdminPanelOpen}
        onClose={() => setIsAdminPanelOpen(false)}
        projects={projects}
        dribbbleProjects={dribbbleProjects}
        user={user}
        isAdmin={isAdmin}
        onUpdateProjects={updateProjects}
        onUpdateDribbbleProjects={updateDribbbleProjects}
      />

      {/* Header */}
      <header 
        className={`fixed top-0 left-0 w-full z-[130] transition-colors duration-500 px-6 md:px-12 flex justify-between items-center h-16 md:h-20 ${
          (scrolled && !isMenuOpen && !isExperienceActive) ? 'bg-black/60' : 'bg-transparent'
        }`}
        style={(scrolled && !isMenuOpen) ? { backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } : undefined}
      >
        <div className="h-full flex items-center translate-y-[1.5px]">
          <Logo url={logoUrl} />
        </div>
        
        <nav className="hidden md:flex items-center gap-8 h-full">
          {['about', 'work', 'experience', 'pricing', 'testimonials', 'faq', 'contact'].map((key) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const value = (t.nav as any)[key];
            if (!value) return null;
            return (
              <a 
                key={key} 
                href={`#${key}`} 
                onClick={(e) => scrollToSection(e, key)}
                className="h-full flex items-center text-[11px] uppercase tracking-[0.2em] text-muted hover:text-white transition-all duration-300 font-medium translate-y-[1.5px]"
              >
                {value}
              </a>
            );
          })}
          <button 
            onClick={() => setLang(lang === 'EN' ? 'RU' : 'EN')}
            className="h-full flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted hover:text-white transition-all duration-300 ml-4 font-medium translate-y-[1.5px]"
          >
            <Globe size={11} className="opacity-60" />
            <span>{lang}</span>
          </button>
        </nav>

        {/* Burger Button */}
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="md:hidden text-white p-2 relative z-[120]"
        >
          {isMenuOpen ? <CloseIcon size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Full-screen Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 200 }}
            className="fixed inset-0 z-[115] bg-black/60 flex flex-col p-8 pt-24 md:hidden"
            style={{ backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)' }}
          >
            <nav className="flex flex-col gap-3 sm:gap-4 mb-8 overflow-y-auto custom-scrollbar pr-4">
              {['about', 'work', 'pricing', 'testimonials', 'faq', 'contact'].map((key, i) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const value = (t.nav as any)[key];
                if (!value) return null;
                return (
                  <motion.a 
                    key={key} 
                    href={`#${key}`} 
                    onClick={(e) => scrollToSection(e, key)}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                    className="text-[40px] xs:text-[45px] sm:text-[50px] font-bold tracking-tightest hover:text-muted transition-colors leading-none py-1"
                  >
                    {value}
                  </motion.a>
                );
              })}
            </nav>

            <div className="mb-8">
              <button
                onClick={() => {
                  setIsContactModalOpen(true);
                  closeMenu();
                }}
                className="group flex items-center gap-3 px-6 py-3 border border-white/20 rounded-full hover:bg-white hover:text-black transition-all duration-500"
              >
                <span className="text-[10px] uppercase tracking-widest font-bold">{t.contact.requestProject}</span>
                <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center group-hover:border-current group-hover:rotate-45 transition-all duration-500">
                  {t.branding?.buttonIcons?.Request ? (
                    <img src={t.branding.buttonIcons.Request} alt="" className="w-4 h-4 object-contain group-hover:invert" />
                  ) : (
                    <ArrowUpRight size={16} />
                  )}
                </div>
              </button>
            </div>

            <div className="mt-auto flex flex-col gap-6">
              <div className="flex gap-6">
                {t.contact.socials
                  .filter(social => !t.contact.mobileMenuSocials || t.contact.mobileMenuSocials.includes(social.name))
                  .map((social, i) => (
                  <a 
                    key={i}
                    href={social.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted hover:text-white transition-colors"
                    title={social.name}
                  >
                    <SocialIcon name={social.name} size={20} customIcons={t.branding?.socialIcons} />
                  </a>
                ))}
              </div>

              <div className="border-t border-white/10 pt-6 flex justify-between items-center">
                <button 
                  onClick={() => {
                    setLang(lang === 'EN' ? 'RU' : 'EN');
                    closeMenu();
                  }}
                  className="text-xs uppercase tracking-widest flex items-center gap-2 text-muted"
                >
                  <Globe size={14} />
                  {lang}
                </button>
                <div className="text-[10px] uppercase tracking-widest text-muted/50">
                  {t.footer.rights}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.main 
        initial={{ opacity: 0 }}
        animate={{ opacity: isLoading ? 0 : 1 }}
        transition={{ duration: 1, delay: 0.5 }}
        className="pt-16 px-6 md:px-12 relative z-10"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={lang}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Hero Section */}
            <section className="h-[100svh] min-h-[600px] flex flex-col justify-end pb-12 lg:pb-16 mb-16 relative -mx-6 md:-mx-12 -mt-16 overflow-hidden">
              {/* Background Media */}
              <div className="absolute inset-0 pointer-events-none z-0">
                {/* Desktop Background */}
                <div className="hidden md:block w-full h-full">
                  {t.hero.backgroundVideoDesktop ? (
                    <motion.video
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 1.5 }}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="w-full h-full object-cover"
                    >
                      <source src={t.hero.backgroundVideoDesktop} type="video/mp4" />
                    </motion.video>
                  ) : t.hero.backgroundImageDesktop ? (
                    <motion.img 
                      initial={{ opacity: 0, scale: 1.1 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                      src={t.hero.backgroundImageDesktop} 
                      alt="" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                </div>

                {/* Mobile Background */}
                <div className="block md:hidden w-full h-full">
                  {t.hero.backgroundVideoMobile ? (
                    <motion.video
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 1.5 }}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="w-full h-full object-cover"
                    >
                      <source src={t.hero.backgroundVideoMobile} type="video/mp4" />
                    </motion.video>
                  ) : t.hero.backgroundImageMobile ? (
                    <motion.img 
                      initial={{ opacity: 0, scale: 1.1 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                      src={t.hero.backgroundImageMobile} 
                      alt="" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                </div>
                
                {/* Overlay to ensure text readability */}
                <div className="absolute inset-0 bg-black/10 z-[1]" />
              </div>

              <div className="px-6 md:px-12 relative z-10 w-full">
                <motion.h1 
                  initial={{ opacity: 0, y: 40 }}
                  animate={!isLoading ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
                  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                  className="text-[17vw] xs:text-[16vw] sm:text-[15vw] md:text-[12vw] lg:text-[120px] xl:text-[130px] leading-[0.82] font-bold tracking-tightest mb-6 whitespace-pre-line"
                >
                  {t.hero.title}
                </motion.h1>
                
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
                  <div className="lg:col-span-8">
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={!isLoading ? { opacity: 1 } : { opacity: 0 }}
                      transition={{ delay: 0.5, duration: 1 }}
                      className="flex flex-col gap-2"
                    >
                      <span className="text-lg sm:text-xl lg:text-2xl text-white font-bold tracking-tightest">
                        {t.hero.subtitle.split('\n')[0]}
                      </span>
                      {t.hero.subtitle.split('\n')[1] && (
                        <span className="text-base sm:text-lg lg:text-xl text-white font-light leading-none max-w-3xl">
                          {t.hero.subtitle.split('\n')[1]}
                        </span>
                      )}
                    </motion.div>
                  </div>
                  <div className="lg:col-span-4 flex items-center justify-start lg:justify-end gap-4">
                    {(t.hero.buttonOrder || ['viewProjects', 'contact']).map((btnKey) => {
                      if (btnKey === 'viewProjects') {
                        return (
                          <motion.button 
                            key="viewProjects"
                            initial={{ opacity: 0, y: 20 }}
                            animate={!isLoading ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                            transition={{ delay: 0.8 }}
                            onClick={() => document.getElementById('work')?.scrollIntoView({ behavior: 'smooth' })}
                            className="group flex items-center gap-3 lg:gap-4 px-6 py-3 lg:px-8 lg:py-4 bg-black/40 md:bg-black/20 md:backdrop-blur-md border border-white/20 rounded-full hover:bg-white hover:text-black transition-all duration-500"
                            style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
                          >
                            <span className="text-[10px] lg:text-xs uppercase tracking-widest font-bold">{t.hero.viewProjects}</span>
                            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full border border-white/20 flex items-center justify-center group-hover:border-current group-hover:rotate-45 transition-all duration-500">
                              {t.branding?.buttonIcons?.ViewProjects ? (
                                <img src={t.branding.buttonIcons.ViewProjects} alt="" className="w-4 h-4 lg:w-5 lg:h-5 object-contain group-hover:invert" />
                              ) : (
                                <ArrowUpRight size={16} className="lg:w-5 lg:h-5" />
                              )}
                            </div>
                          </motion.button>
                        );
                      }
                      if (btnKey === 'contact') {
                        return (
                          <motion.button 
                            key="contact"
                            initial={{ opacity: 0, y: 20 }}
                            animate={!isLoading ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                            transition={{ delay: 0.9 }}
                            onClick={() => setIsContactModalOpen(true)}
                            className="group w-12 h-12 lg:w-16 lg:h-16 flex items-center justify-center bg-white text-black rounded-full hover:bg-zinc-200 transition-all duration-500"
                          >
                            {t.branding?.buttonIcons?.Contact ? (
                              <img src={t.branding.buttonIcons.Contact} alt="" className="w-6 h-6 lg:w-8 lg:h-8 object-contain invert transition-transform duration-500 group-hover:rotate-12" />
                            ) : (
                              <Mail size={20} className="lg:w-6 lg:h-6 transition-transform duration-500 group-hover:rotate-12" />
                            )}
                          </motion.button>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              </div>
            </section>

            {/* About Section */}
            <section id="about" className="mb-24 lg:mb-32 pt-8 lg:pt-12 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 scroll-mt-16 relative">
              <div className="lg:col-span-4">
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8 }}
                  className="space-y-8"
                >
                  <h2 className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-8">
                    {t.about.title}
                  </h2>
                  
                  {/* About Avatar */}
                  <div className="flex flex-col gap-8">
                      <div 
                        className="aspect-square w-full bg-zinc-900 border-none overflow-hidden relative group rounded-full max-w-[340px] xl:max-w-[400px] mx-auto lg:mx-auto"
                      >
                        <motion.img 
                          initial={{ opacity: 0, scale: 1.05 }}
                          whileInView={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                          viewport={{ once: true }}
                          src={t.about.photo} 
                          alt={t.about.title}
                          className="absolute inset-0 w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>

                     {/* Quote under Avatar */}
                    {t.about.quote && (
                      <div className="max-w-[440px] xl:max-w-[480px] mx-auto px-2 text-center flex justify-center">
                        <div className="relative py-2 px-6 flex justify-center items-center">
                          <span className="absolute left-0 top-0 text-3xl text-white/20 font-serif select-none">“</span>
                          <p className="text-base sm:text-lg xl:text-xl font-light italic text-muted leading-relaxed text-center">
                            {fixDanglingPrepositions(t.about.quote)}
                          </p>
                          <span className="absolute right-0 bottom-0 text-3xl text-white/20 font-serif select-none">”</span>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>

              <div className="lg:col-span-8">
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-120px" }}
                  transition={{ duration: 0.8, delay: 0.1 }}
                >
                  <div className="mb-10 lg:mb-16">
                    <h3 className={`font-bold tracking-tightest mb-8 leading-[1.1] max-w-4xl ${
                      lang === 'RU' ? 'text-2xl sm:text-3xl lg:text-5xl' : 'text-3xl sm:text-4xl lg:text-6xl'
                    }`}>
                      {lang === 'RU' ? (
                        <>
                          <span className="block md:inline">Михаил Марсель</span>
                          <span className="hidden md:inline"> — </span>
                          <span className="block md:inline">Мульти-дизайнер.</span>
                        </>
                      ) : (
                        <>
                          <span className="block md:inline">Michael Marsel</span>
                          <span className="hidden md:inline"> — </span>
                          <span className="block md:inline">Multi-Designer.</span>
                        </>
                      )}
                    </h3>
                    <p className="text-base sm:text-xl lg:text-2xl text-muted font-light leading-relaxed max-w-4xl">
                      {fixDanglingPrepositions(t.about.text)}
                    </p>
                  </div>
   
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 border-y border-white/10 mb-12 lg:mb-16">
                    {t.about.stats.map((stat, i) => (
                      <div 
                        key={i}
                        className={`py-8 flex flex-col items-center justify-center text-center border-r border-white/10 even:border-r-0 lg:even:border-r lg:last:border-r-0 ${i < 2 ? 'border-b border-white/10 lg:border-b-0' : ''}`}
                      >
                        <span className="text-4xl lg:text-6xl font-bold tracking-tightest mb-2">{stat.value}</span>
                        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">{stat.label}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-10">
                    <div>
                      <h3 className="text-xs uppercase tracking-[0.2em] text-muted mb-6 flex items-center gap-4">
                        <span className="w-8 h-px bg-white/20" />
                        {t.about.stackTitle}
                      </h3>
                      <div className="flex flex-wrap gap-3">
                        {t.about.stack.map((item, i) => (
                          <span key={i} className="inline-flex items-center justify-center px-4 py-2 border border-white/20 rounded-full text-[10px] font-semibold tracking-widest uppercase hover:bg-white hover:text-black transition-all duration-500 leading-none">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-xs uppercase tracking-[0.2em] text-muted mb-6 flex items-center gap-4">
                        <span className="w-8 h-px bg-white/20" />
                        {t.about.toolsTitle}
                      </h3>
                      <div className="flex flex-wrap gap-3">
                        {t.about.tools.map((tool, i) => (
                          <span key={i} className="inline-flex items-center justify-center px-4 py-2 border border-white/20 rounded-full text-[10px] font-semibold tracking-widest uppercase hover:bg-white hover:text-black transition-all duration-500 leading-none">
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </section>

            {/* Work Section */}
            <section id="work" className="mb-24 md:mb-32 pt-8 md:pt-12 grid grid-cols-1 md:grid-cols-12 gap-12 scroll-mt-16 relative">
              <div className="md:col-span-4">
                <motion.h2 {...fadeIn} className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-12">
                  {t.work.title}
                </motion.h2>
                
                {/* Tab Switcher */}
                <motion.div 
                  {...fadeIn} 
                  className="relative inline-flex p-1 bg-white/5 backdrop-blur-md rounded-full border border-white/10"
                  style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
                >
                  <button 
                    onClick={() => setActiveWorkTab('projects')}
                    className={`relative z-10 px-6 py-2 text-[10px] uppercase tracking-widest font-bold transition-colors duration-500 ${activeWorkTab === 'projects' ? 'text-black' : 'text-white/40 hover:text-white/60'}`}
                  >
                    {lang === 'EN' ? 'Projects' : 'Проекты'}
                    {activeWorkTab === 'projects' && (
                      <motion.div 
                        layoutId="activeTab"
                        className="absolute inset-0 bg-white rounded-full -z-10"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </button>
                  <button 
                    onClick={() => setActiveWorkTab('dribbble')}
                    className={`relative z-10 px-6 py-2 text-[10px] uppercase tracking-widest font-bold transition-colors duration-500 ${activeWorkTab === 'dribbble' ? 'text-black' : 'text-white/40 hover:text-white/60'}`}
                  >
                    {lang === 'EN' ? 'Dribbble' : 'Dribbble'}
                    {activeWorkTab === 'dribbble' && (
                      <motion.div 
                        layoutId="activeTab"
                        className="absolute inset-0 bg-white rounded-full -z-10"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </button>
                </motion.div>
              </div>
              
              <div className="md:col-span-8">
                <div>
                  <AnimatePresence mode="popLayout">
                    <motion.div
                      key={activeWorkTab}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.6 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-16"
                    >
                      {(activeWorkTab === 'projects' ? projects : dribbbleProjects).slice(0, visibleProjects).map((project, i) => (
                        <motion.div 
                          layout="position"
                          key={project.id || `${activeWorkTab}-${i}`}
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ 
                            delay: (i % 6) * 0.1, 
                            duration: 0.8,
                            ease: [0.16, 1, 0.3, 1]
                          }}
                        >
                          <ProjectCard project={project} index={i} />
                        </motion.div>
                      ))}
                    </motion.div>
                  </AnimatePresence>
                  <div ref={projectsEndRef} className="h-1" />
                </div>
 
                {(activeWorkTab === 'projects' ? projects : dribbbleProjects).length > visibleProjects && (
                  <motion.div 
                    layout
                    {...fadeIn}
                    className="mt-16 flex justify-center md:justify-end"
                  >
                    <button 
                      onClick={() => setVisibleProjects(prev => prev + (window.innerWidth < 768 ? 5 : 6))}
                      className="group flex items-center gap-4 px-8 py-4 border border-white/20 rounded-full hover:bg-white hover:text-black transition-all duration-500"
                    >
                      <span className="text-xs uppercase tracking-widest font-bold">{t.work.loadMore}</span>
                      <div className="w-8 h-8 rounded-full border border-white/20 group-hover:border-current flex items-center justify-center transition-all duration-500">
                        <Plus size={16} />
                      </div>
                    </button>
                  </motion.div>
                )}
              </div>
            </section>
 
            {/* Clients Marquee Section (Work with) - Hidden per request */}
            {/* 
            {t.clients.logos.length > 0 && (
              <section className="mb-24 md:mb-32 py-12 md:py-16 relative overflow-hidden border-y border-white/5 bg-white/[0.01] -mx-6 md:-mx-12">
                <div className="flex w-max">
                  <motion.div 
                    animate={{ x: ["0%", "-50%"] }}
                    transition={{ 
                      duration: 25, 
                      repeat: Infinity, 
                      ease: "linear",
                    }}
                    className="flex items-center will-change-transform"
                  >
                    {[...t.clients.logos, ...t.clients.logos].map((logo, i) => (
                      <div 
                        key={i} 
                        className="h-8 md:h-10 w-auto flex-shrink-0 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all duration-500 mx-12 md:mx-16"
                      >
                        <img 
                          src={logo} 
                          alt={`Client ${i}`} 
                          className="h-full w-auto object-contain pointer-events-none"
                          referrerPolicy="no-referrer"
                          loading="eager"
                        />
                      </div>
                    ))}
                  </motion.div>
                </div>
              </section>
            )}
            */}
 
 
 
            {/* Experience Section (Roadmap) */}
            <section id="experience" className="relative mb-24 lg:mb-32 scroll-mt-16">
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                className="w-full"
              >
                <div className="mb-8 px-6 md:px-12">
                  <h2 className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
                    {t.roadmap.title}
                  </h2>
                </div>

                {/* ========== МОБИЛЬНАЯ ВЕРСИЯ (< 1024px) ========== */}
                <MobileExperience items={t.roadmap.items} />
                
                {/* ========== ДЕСКТОПНАЯ ВЕРСИЯ (>= 1024px) ========== */}
                <DesktopExperience 
                  items={t.roadmap.items}
                  hoveredRoadmapIndex={hoveredRoadmapIndex}
                  setHoveredRoadmapIndex={setHoveredRoadmapIndex}
                  setHoveredRoadmapImage={setHoveredRoadmapImage}
                />
              </motion.div>

              {/* Floating Image Follower - Only on Desktop when mouse has actively moved */}
              <AnimatePresence mode="wait">
                {hoveredRoadmapImage && window.innerWidth >= 1024 && hasMouseMoved && (
                  <motion.div
                    style={{ 
                      x: springX, 
                      y: springY,
                      position: 'fixed' as const,
                      top: 0,
                      left: 0,
                      pointerEvents: 'none' as const,
                      zIndex: 999
                    }}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <div className="-translate-x-1/2 -translate-y-1/2 w-[240px] lg:w-[300px] xl:w-[360px] aspect-square overflow-hidden shadow-[0_40px_120px_-20px_rgba(0,0,0,0.6)]">
                      <motion.img
                        key={hoveredRoadmapImage}
                        src={hoveredRoadmapImage}
                        alt="Preview"
                        className="w-full h-full object-cover block"
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        transition={{ 
                          opacity: { duration: 0.4 },
                          scale: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
                          y: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
                        }}
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
 
            {/* Pricing Section */}
            {t.pricing && (
              <section id="pricing" className="mb-24 md:mb-48 py-24 md:py-40 relative scroll-mt-16 flex flex-col items-center">
                {/* Background Image for Pricing Section */}
                <div className="absolute inset-0 z-0 pointer-events-none md:-mx-12 -mx-6 transition-all">
                   <motion.img 
                      initial={{ scale: 1.05, opacity: 0 }}
                      whileInView={{ scale: 1, opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                      src={ASSETS.PRICING.HEADER || '/materials/card1.jpg'} 
                      alt="" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                </div>

                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-120px" }}
                  transition={{ duration: 0.8 }}
                  className="w-full flex flex-col items-center relative z-10"
                >
                  <div className="max-w-4xl mx-auto text-center mb-16 px-4 flex flex-col items-center text-center">
                    <h2 className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-8 text-center">
                      {t.pricing.title}
                    </h2>
                    <div className="text-center flex flex-col items-center">
                      <h3 className={`font-bold tracking-tightest mb-8 leading-[1.1] text-center ${
                        lang === 'RU' ? 'text-2xl sm:text-3xl lg:text-5xl' : 'text-3xl sm:text-4xl lg:text-6xl'
                      }`}>
                        {lang === 'RU' ? 'Прайс-лист' : 'Price List'}
                      </h3>
                      <p className="text-lg md:text-xl text-muted font-light leading-relaxed mx-auto max-w-xl text-center">
                        {lang === 'RU' ? (
                          <>
                            {fixDanglingPrepositions('Детальный список всех услуг, пакетов и условий работы.')}
                            <br />
                            {fixDanglingPrepositions('Кликните на папку, чтобы открыть прайс-лист.')}
                          </>
                        ) : (
                          fixDanglingPrepositions('Detailed list of all services, packages, and terms of work. Click the folder to explore the price list.')
                        )}
                      </p>
                    </div>
                  </div>
                  
                  <div className="w-full flex justify-center relative">
                    {/* Background Glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl h-full bg-white/[0.03] blur-[100px] rounded-full pointer-events-none" />
                    
                    <div className="relative z-10 w-full max-w-xl px-4 flex justify-center">
                      <FolderPriceTrigger 
                        lang={lang as Language} 
                        onClick={() => setIsPriceListOpen(true)} 
                      />
                    </div>
                  </div>
                </motion.div>
              </section>
            )}

            {/* Reviews Section */}
            <section id="testimonials" className="mb-24 md:mb-48 pt-8 md:pt-12 relative scroll-mt-16 flex flex-col items-center">
              <motion.div 
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-120px" }}
                transition={{ duration: 0.8 }}
                className="w-full flex flex-col items-center"
              >
                <div className="max-w-4xl mx-auto text-center mb-20 px-4 flex flex-col items-center text-center">
                  <h2 className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-8 text-center">
                    {t.testimonials.title}
                  </h2>
                  <div className="text-center flex flex-col items-center">
                    <h3 className={`font-bold tracking-tightest mb-8 leading-[1.1] whitespace-pre-line mx-auto text-center ${
                      lang === 'RU' ? 'text-2xl sm:text-3xl lg:text-5xl' : 'text-3xl sm:text-4xl lg:text-6xl'
                    }`}>
                      {fixDanglingPrepositions(t.testimonials.intro)}
                    </h3>
                    <p className="text-lg md:text-xl text-muted font-light leading-relaxed mx-auto max-w-xl text-center">
                      {lang === 'RU' ? (
                        <>
                          {fixDanglingPrepositions('Я верю в построение долгосрочных отношений,')}
                          <br />
                          {fixDanglingPrepositions('через качество и доверие.')}
                        </>
                      ) : (
                        fixDanglingPrepositions('I believe in building long-term relationships through quality and trust.')
                      )}
                    </p>
                  </div>
                </div>
                <div className="w-full flex justify-center px-1 md:px-4">
                  <div className="w-full max-w-4xl flex justify-center">
                    <TestimonialStack testimonials={t.testimonials.items} />
                  </div>
                </div>
              </motion.div>
            </section>


        {/* Shop Section - Hidden for now
        <ShopSection 
          shop={{ ...t.shop, items: shopProducts }} 
          fadeIn={fadeIn} 
          onProductClick={(product) => {
            setSelectedShopProduct(product);
            setIsShopModalOpen(true);
          }} 
          onViewAllClick={() => setIsFullShopModalOpen(true)}
        />
        */}

        {/* FAQ Section */}
        <section id="faq" className="mb-24 md:mb-32 pt-8 md:pt-12 grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-12 scroll-mt-16 relative">
          <div className="md:col-span-4">
            <motion.h2 {...fadeIn} className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-2 md:mb-8">
              {t.faq.title}
            </motion.h2>
          </div>
          <div className="md:col-span-8">
            <div className="flex flex-col border-y border-white/10 divide-y divide-white/10">
              {t.faq.items.map((item, i) => (
                <FAQItem 
                  key={i} 
                  item={item} 
                  index={i} 
                  fadeIn={fadeIn} 
                  onPriceListClick={(scrollToExtras) => {
                    if (scrollToExtras) {
                      setPriceListScrollToExtras(true);
                    }
                    setIsPriceListOpen(true);
                  }}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="border-t-0 lg:border-t border-white/10 pt-2 lg:pt-12 scroll-mt-16 relative">
          <motion.div {...fadeIn} className="mb-8 lg:mb-16">
            <h2 className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-10">
              {t.contact.title}
            </h2>
            <div className="text-5xl sm:text-6xl md:text-8xl lg:text-7xl font-bold tracking-tightest block mb-10 lg:mb-12 whitespace-pre-line leading-[0.82] will-change-transform transform-gpu">
              {t.contact.cta}
            </div>

            <button
              onClick={() => setIsContactModalOpen(true)}
              className="group mb-12 flex items-center gap-3 lg:gap-4 px-6 py-2.5 lg:px-8 lg:py-3 bg-white text-black rounded-full hover:bg-zinc-200 transition-all duration-500"
            >
              <span className="text-[10px] lg:text-xs uppercase tracking-widest font-bold">{t.contact.requestProject}</span>
              <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full border border-black/10 flex items-center justify-center group-hover:rotate-45 transition-all duration-500">
                {t.branding?.buttonIcons?.Request ? (
                  <img src={t.branding.buttonIcons.Request} alt="" className="w-4 h-4 lg:w-5 lg:h-5 object-contain invert" />
                ) : (
                  <ArrowUpRight size={16} className="lg:w-5 lg:h-5" />
                )}
              </div>
            </button>
            
            <div 
              className="flex flex-row items-center gap-4 sm:gap-6 md:gap-10 max-w-full overflow-visible mb-2"
            >
              <a 
                href={`mailto:${t.contact.email}`}
                className="flex items-center justify-center group transition-all duration-500 p-1.5 md:p-2 flex-shrink-0 hover:opacity-50"
                title="Email"
              >
                {t.branding?.buttonIcons?.Email ? (
                  <img src={t.branding.buttonIcons.Email} alt="" className="w-5 h-5 md:w-8 md:h-8 object-contain transition-all duration-500" />
                ) : (
                  <Mail size={22} className="text-white group-hover:text-muted transition-all duration-500 md:w-6 md:h-6 lg:w-8 lg:h-8" />
                )}
              </a>
              <div className="flex flex-row items-center gap-4 sm:gap-6 md:gap-10">
                {t.contact.socials.map((social, i) => (
                  <a 
                    key={i}
                    href={social.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center group transition-all duration-500 p-1.5 md:p-2 flex-shrink-0 hover:opacity-50"
                    title={social.name}
                  >
                    <SocialIcon name={social.name} size={window.innerWidth < 768 ? 20 : 24} customIcons={t.branding?.socialIcons} className="text-white group-hover:text-muted transition-all duration-500 md:scale-110" />
                  </a>
                ))}
              </div>
            </div>
          </motion.div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 text-[10px] uppercase tracking-widest text-muted py-6 border-t border-white/10 text-left">
            <div className="flex items-center justify-start gap-4">
              <span>{t.footer.rights}</span>
            </div>
            <span className="hidden sm:block text-muted/80">by Michael Marsel</span>
          </div>
        </section>

          </motion.div>
        </AnimatePresence>
      </motion.main>
    </div>
    </ErrorBoundary>
  );
}

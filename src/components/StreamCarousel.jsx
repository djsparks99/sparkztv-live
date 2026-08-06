import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Eye, Radio, Play, Award, VolumeX } from "lucide-react";
import { fileUrl } from "@/lib/api";
import HlsPlayer from "@/components/HlsPlayer";
import { useAuth } from "@/lib/auth-context";
import { motion, AnimatePresence } from "framer-motion";

const FALLBACK_THUMBS = [
  "https://images.unsplash.com/photo-1541126274323-dbac58d14741?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwxfHx1bmRlcmdyb3VuZCUyMHJhdmUlMjBkaiUyMHNldHxlbnwwfHx8fDE3ODU0NDAwMzJ8MA&ixlib=rb-4.1.0&q=85",
  "https://images.unsplash.com/photo-1516873240891-4bf014598ab4?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHw0fHx1bmRlcmdyb3VuZCUyMHJhdmUlMjBkaiUyMHNldHxlbnwwfHx8fDE3ODU0NDAwMzJ8MA&ixlib=rb-4.1.0&q=85",
  "https://images.unsplash.com/photo-1496337589254-7e19d01cec44?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwzfHx1bmRlcmdyb3VuZCUyMHJhdmUlMjBkaiUyMHNldHxlbnwwfHx8fDE3ODU0NDAwMzJ8MA&ixlib=rb-4.1.0&q=85",
];

const DUMMY_USERNAMES = ["pirate_fm", "acid_vault", "dub_station", "test", "demo", "undefined", "channel"];

function hashPick(str, arr) {
  if (!str) return arr[0];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return arr[Math.abs(h) % arr.length];
}

export default function StreamCarousel({ allChannels = [], channels = [] }) {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0); // -1 for prev, 1 for next
  const [isHovered, setIsHovered] = useState(false);
  const autoplayTimerRef = useRef(null);

  const channelsList = (allChannels && allChannels.length > 0) ? allChannels : channels;

  // 1. Process channels
  const seenUsernames = new Set();
  const validChannels = (channelsList || []).filter((c) => {
    if (!c) return false;
    const username = (c.username || "").trim().toLowerCase();
    const displayName = (c.display_name || "").trim().toLowerCase();
    const channelId = (c.channel_id || "").trim().toLowerCase();

    if (!username || username === "undefined" || username === "channel" || username === "null") {
      return false;
    }

    if (
      c.is_dummy ||
      c.isDummy ||
      DUMMY_USERNAMES.includes(username) ||
      DUMMY_USERNAMES.includes(displayName) ||
      channelId.startsWith("chan-pirate") ||
      channelId.startsWith("chan-acid") ||
      channelId.startsWith("chan-dub")
    ) {
      return false;
    }

    if (seenUsernames.has(username)) return false;
    seenUsernames.add(username);
    return true;
  });

  // Sort channels: Live first, then by viewer count, then fallback to djsparkz preference
  const sortedChannels = [...validChannels].sort((a, b) => {
    const aLive = Boolean(a.is_live || a.isLive);
    const bLive = Boolean(b.is_live || b.isLive);
    if (aLive !== bLive) {
      return bLive ? 1 : -1;
    }
    const aViews = Number(a.viewer_count || a.viewerCount || a.views || 0);
    const bViews = Number(b.viewer_count || b.viewerCount || b.views || 0);
    if (bViews !== aViews) {
      return bViews - aViews;
    }
    const aSparkz = (a.username || "").toLowerCase() === "djsparkz";
    const bSparkz = (b.username || "").toLowerCase() === "djsparkz";
    if (aSparkz !== bSparkz) {
      return bSparkz ? 1 : -1;
    }
    return 0;
  });

  // Take top 5 channels as slides
  const slides = sortedChannels.slice(0, 5);

  // Fallback slide if empty
  if (slides.length === 0) {
    slides.push({
      username: "djsparkz",
      display_name: "djsparkz",
      photo_url: null,
      thumbnail_url: null,
      stream_title: "Static Signal — Offline",
      bio: "Underground resident DJ.",
      viewer_count: 0,
      is_live: false,
    });
  }

  const liveChannels = validChannels.filter((c) => Boolean(c.is_live || c.isLive));
  const totalLiveViewers = liveChannels.reduce(
    (sum, c) => sum + Number(c.viewer_count || c.viewerCount || c.views || 0),
    0
  );

  // 2. Navigation handlers
  const handleNext = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  };

  const handlePrev = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleDotClick = (index) => {
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  };

  // Autoplay management
  useEffect(() => {
    if (isHovered || slides.length <= 1) {
      if (autoplayTimerRef.current) {
        clearInterval(autoplayTimerRef.current);
      }
      return;
    }

    autoplayTimerRef.current = setInterval(() => {
      handleNext();
    }, 6000);

    return () => {
      if (autoplayTimerRef.current) {
        clearInterval(autoplayTimerRef.current);
      }
    };
  }, [currentIndex, isHovered, slides.length]);

  const activeChannel = slides[currentIndex];
  const isLive = Boolean(activeChannel.is_live || activeChannel.isLive);
  const activeSlug = activeChannel.username || activeChannel.channel_id || activeChannel.id || "channel";
  const activeViews = Number(activeChannel.viewer_count || activeChannel.viewerCount || activeChannel.views || 0);

  // Resolve Thumbnail Source
  const thumbnailSource = activeChannel.thumbnail_url || activeChannel.thumbnailUrl || activeChannel.preview_image || activeChannel.previewImage;
  const activeThumb = thumbnailSource
    ? (thumbnailSource.startsWith("http") ? thumbnailSource : fileUrl(thumbnailSource))
    : hashPick(activeSlug, FALLBACK_THUMBS);

  // Resolve Avatar with PNG fallback (to avoid SVG warnings)
  const isMe = user && (
    (user.uid && user.uid === activeChannel.user_uid) ||
    (user.username && user.username.toLowerCase() === activeSlug.toLowerCase())
  );
  const avatarUrl = activeChannel.photo_url || 
                    activeChannel.photoUrl || 
                    (activeChannel.user && (activeChannel.user.photo_url || activeChannel.user.photoUrl)) ||
                    (isMe && (user?.photo_url || user?.photoUrl)) ||
                    `https://api.dicebear.com/7.x/bottts/png?seed=${activeSlug}`;

  // Framer motion variants
  const slideVariants = {
    enter: (dir) => ({
      x: dir > 0 ? "100%" : "-100%",
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        x: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 },
      },
    },
    exit: (dir) => ({
      x: dir < 0 ? "100%" : "-100%",
      opacity: 0,
      transition: {
        x: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 },
      },
    }),
  };

  return (
    <section 
      id="stream-carousel"
      className="relative border-b border-[#27272a] bg-[#050505] text-white overflow-hidden select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-testid="stream-carousel"
    >
      {/* Dark Industrial Grid Scanlines */}
      <div className="grid-lines absolute inset-0 opacity-20 pointer-events-none" />
      
      {/* Top Header Row */}
      <div className="relative mx-auto max-w-[1440px] px-6 pt-8 pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between border-b border-[#1a1a1e] pb-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">// NETWORK FEED</div>
            <h1 className="mt-0.5 font-display text-2xl font-black uppercase tracking-tight text-white sm:text-3xl lg:text-4xl">
              SIGNAL CAROUSEL // <span className="text-[#e5ff00]">LIVE CHANNELS</span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 border border-[#27272a] bg-[#09090b] px-3 py-1.5 font-mono text-[10px] text-zinc-300">
              <span className="relative flex h-2 w-2">
                <span className={`absolute inline-flex h-full w-full rounded-full bg-[#e5ff00] opacity-75 ${totalLiveViewers > 0 ? "animate-ping" : ""}`} />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#e5ff00]" />
              </span>
              <span>{totalLiveViewers} TOTAL LIVE VIEWERS</span>
            </div>
            <Link
              to="/register"
              className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#e5ff00] hover:underline sm:inline-block border border-[#e5ff00]/20 bg-[#e5ff00]/5 px-3 py-1.5 hover:bg-[#e5ff00]/10 transition-colors"
            >
              + GO LIVE NOW
            </Link>
          </div>
        </div>
      </div>

      {/* Main Carousel Slider Stage */}
      <div className="relative mx-auto max-w-[1440px] px-6 py-6 sm:py-8 min-h-[460px] flex items-center justify-center">
        <div className="w-full relative overflow-hidden min-h-[420px] lg:min-h-[380px]">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center w-full"
            >
              {/* Left Column: Metadata & Detailed Info */}
              <div className="flex flex-col justify-center lg:col-span-5 py-4">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  {/* Status Badge */}
                  <div className="inline-flex items-center gap-2 border border-[#27272a] bg-[#09090b] px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-zinc-400">
                    <span className={`relative flex h-2 w-2`}>
                      <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isLive ? "bg-red-500 animate-ping" : "bg-zinc-500"}`} />
                      <span className={`relative inline-flex h-2 w-2 rounded-full ${isLive ? "bg-red-500" : "bg-zinc-500"}`} />
                    </span>
                    <span>{isLive ? "TRANSMISSION ONLINE" : "SIGNAL STANDBY"}</span>
                  </div>

                  {/* Category/Genre Tag */}
                  {activeChannel.category && (
                    <span className="border border-[#e5ff00]/30 bg-[#e5ff00]/10 text-[#e5ff00] font-mono text-[9px] uppercase tracking-widest px-2.5 py-1">
                      {activeChannel.category}
                    </span>
                  )}
                </div>

                {/* Stream Title */}
                <h2 className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black uppercase tracking-tighter text-white leading-[1.05]">
                  {isLive 
                    ? (activeChannel.stream_title || "Live underground broadcast") 
                    : "Static Signal — Standby mode."}
                </h2>

                {/* Broadcaster Profile Card */}
                <div className="mt-6 flex items-center gap-3 border border-[#1e1e21] bg-[#09090b] p-3.5 max-w-md">
                  <img
                    src={avatarUrl.startsWith("http") ? avatarUrl : fileUrl(avatarUrl)}
                    alt={activeChannel.display_name || activeSlug}
                    className="h-10 w-10 shrink-0 border border-[#e5ff00] object-cover bg-black"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.target.src = `https://api.dicebear.com/7.x/bottts/png?seed=${activeSlug}`;
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-base font-black text-white truncate uppercase">
                        {activeChannel.display_name || activeChannel.username}
                      </h3>
                      <span className="font-mono text-[10px] text-zinc-500 shrink-0">@{activeSlug}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 font-mono text-[10px] text-zinc-400">
                      {activeChannel.bio || "Underground network streamer."}
                    </p>
                  </div>
                </div>

                {/* Stream Metrics / Info */}
                <div className="mt-6 flex flex-wrap items-center gap-6 font-mono text-xs text-zinc-400 border-t border-[#1a1a1e] pt-5">
                  {isLive ? (
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-[#e5ff00]" />
                      <span className="text-[#e5ff00] font-bold">{activeViews}</span> VIEWERS TUNED IN
                    </div>
                  ) : (
                    <div className="text-zinc-500 font-mono text-[11px] uppercase">
                      // LAST BROADCAST RECENTLY
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <Award className="h-4 w-4 text-[#e5ff00]" />
                    <span>FEATURED SIGNALS</span>
                  </div>
                </div>

                {/* Action Links */}
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link 
                    to={`/channel/${activeSlug}`}
                    data-testid={`carousel-tune-in-${activeSlug}`}
                    className="btn-primary inline-flex items-center gap-2 px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider"
                  >
                    <Radio className="h-4 w-4" /> {isLive ? "TUNE IN LIVE" : "VIEW FREQUENCY"}
                  </Link>
                  <Link 
                    to="/directory" 
                    className="border border-[#27272a] bg-[#09090b] hover:bg-zinc-900 transition-colors inline-flex items-center gap-2 px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-white"
                  >
                    ALL SIGNAL CHANNELS
                  </Link>
                </div>
              </div>

              {/* Right Column: Featured Player & Preview Thumbnail Overlay */}
              <div className="lg:col-span-7">
                <div className="group flex flex-col overflow-hidden border border-[#27272a] bg-[#0a0a0a] transition-all hover:border-[#e5ff00] w-full shadow-2xl relative">
                  
                  {/* Player / 16:9 Landscape Banner Container */}
                  <div className="relative aspect-[16/9] max-h-[380px] w-full overflow-hidden bg-black">
                    
                    {/* Active Live Player Stream */}
                    <div className="w-full h-full relative" data-testid="live-player-container">
                      <HlsPlayer
                        playbackId={activeChannel.playback_id || activeChannel.playbackId}
                        isLive={isLive}
                        muted={true}
                        autoPlay={true}
                        controls={false}
                      />
                    </div>

                    {/* Preview Thumbnail Overlay (Only shows if OFFLINE) */}
                    {!isLive && (
                      <div className="absolute inset-0 z-20 bg-black flex items-center justify-center">
                        <img
                          src={activeThumb}
                          alt={activeChannel.display_name || activeSlug}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover opacity-80"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/60 flex flex-col items-center justify-center p-4 text-center">
                          <span className="border border-[#e5ff00]/40 bg-black/85 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-[#e5ff00] mb-2.5">
                            SIGNAL OFFLINE — STANDBY PREVIEW
                          </span>
                          <p className="font-mono text-xs text-zinc-400 max-w-sm">
                            DJ is currently off the grid. Click "VIEW FREQUENCY" to view past broadcasts and schedule.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Bottom overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent pointer-events-none z-25" />

                    {/* Badges in Upper Corner */}
                    <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2 z-30">
                      <span className="flex items-center gap-1.5 bg-[#e5ff00] px-2.5 py-0.5 font-mono text-[10px] font-black uppercase text-black">
                        <Award className="h-3.5 w-3.5" /> FEATURED
                      </span>
                      {isLive ? (
                        <span className="live-badge !px-2.5 !py-0.5 !text-[10px] bg-red-600 text-white flex items-center gap-1">
                          <span className="dot live-dot animate-pulse h-1.5 w-1.5 bg-white rounded-full inline-block" /> LIVE NOW
                        </span>
                      ) : (
                        <span className="chip !px-2.5 !py-0.5 !text-[10px] !bg-zinc-900/90 !text-zinc-400 !border-zinc-800">STANDBY</span>
                      )}
                    </div>

                    {/* Live indicator / volume icon placeholder */}
                    {isLive && (
                      <div className="absolute right-3 top-3 flex items-center gap-1.5 border border-[#27272a] bg-black/90 px-2.5 py-1 font-mono text-[10px] font-bold text-[#e5ff00] backdrop-blur-md z-30">
                        <VolumeX className="h-3 w-3 text-[#e5ff00]" />
                        <span>MUTED PREVIEW</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Floating Side Arrows for desktop slide cycling */}
        {slides.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-40 h-10 w-10 flex items-center justify-center border border-[#27272a] bg-[#050505]/90 text-zinc-400 hover:text-[#e5ff00] hover:border-[#e5ff00] transition-colors rounded-sm"
              aria-label="Previous Slide"
              data-testid="carousel-prev"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-40 h-10 w-10 flex items-center justify-center border border-[#27272a] bg-[#050505]/90 text-zinc-400 hover:text-[#e5ff00] hover:border-[#e5ff00] transition-colors rounded-sm"
              aria-label="Next Slide"
              data-testid="carousel-next"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      {/* Slide dots and indicator line */}
      {slides.length > 1 && (
        <div className="relative mx-auto max-w-[1440px] px-6 pb-8 flex items-center justify-between font-mono text-[10px] text-zinc-500">
          <div>
            SLIDE <span className="text-white">{String(currentIndex + 1).padStart(2, "0")}</span> / {String(slides.length).padStart(2, "0")}
          </div>

          <div className="flex items-center gap-2">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => handleDotClick(idx)}
                className={`h-2 transition-all rounded-none ${idx === currentIndex ? "w-8 bg-[#e5ff00]" : "w-2 bg-zinc-700 hover:bg-zinc-500"}`}
                aria-label={`Go to slide ${idx + 1}`}
                data-testid={`carousel-dot-${idx}`}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

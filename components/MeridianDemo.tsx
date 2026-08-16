"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type MutableRefObject, type PointerEvent } from "react";

// Design handoff: design_handoff_meridian_demo/ — high-fidelity, values are final.
// Try-on images are real Apparel VTO outputs (public/meridian/); never swap in generated ones.

const PRODUCTS = [
  { name: "White Collar Shirt", price: "$89", color: "White", key: "person" },
  { name: "Houndstooth Blazer", price: "$249", color: "Black/White", key: "blazer" },
  { name: "Green Velvet Blazer", price: "$279", color: "Forest", key: "velvet" },
  { name: "Black Leather Jacket", price: "$349", color: "Black", key: "leather" },
  { name: "Peach Sweater", price: "$129", color: "Peach", key: "sweater" },
  { name: "Floral Blazer", price: "$179", color: "Multi", key: "floral" },
] as const;

const CARD_W = 310;
const CARD_GAP = 12;
const CARD_STEP = CARD_W + CARD_GAP;
const LEFT_PEEK = 24;
const PHONE_W = 402;
const PHONE_H = 874;
const FRAME_PAD = 11;
const FRAME_H = PHONE_H + 2 * FRAME_PAD;
const PHONE_HEIGHT_PCT = 0.72;

const HANKEN = "var(--font-hanken), 'Hanken Grotesk', sans-serif";
const PLEX = "var(--font-plex), 'IBM Plex Sans', sans-serif";

/** MERIDIAN GOODS wordmark — both O's carry a vertical stroke (⊕ effect). */
function Wordmark({ fontSize, letterSpacing, color, strokeWidth }: {
  fontSize: number;
  letterSpacing: string;
  color: string;
  strokeWidth: number;
}) {
  const barredO = (
    <span style={{ position: "relative", display: "inline-block" }}>
      O
      <span
        style={{
          position: "absolute",
          left: "50%",
          top: "-5%",
          height: "110%",
          width: strokeWidth,
          background: "currentColor",
          transform: "translateX(-50%)",
        }}
      />
    </span>
  );
  return (
    <span
      style={{
        fontFamily: HANKEN,
        fontWeight: 600,
        fontSize,
        letterSpacing,
        color,
        whiteSpace: "nowrap",
      }}
    >
      MERIDIAN G{barredO}
      {barredO}DS
    </span>
  );
}

function StatusBar() {
  const c = "#fff";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "21px 24px 19px",
        boxSizing: "border-box",
        position: "relative",
        zIndex: 20,
        width: "100%",
      }}
    >
      <div style={{ flex: 1, height: 22, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 1.5 }}>
        <span style={{ fontFamily: '-apple-system, "SF Pro", system-ui', fontWeight: 590, fontSize: 17, lineHeight: "22px", color: c }}>
          9:41
        </span>
      </div>
      <div style={{ flex: 1, height: 22, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, paddingTop: 1, paddingRight: 1 }}>
        <svg width="19" height="12" viewBox="0 0 19 12">
          <rect x="0" y="7.5" width="3.2" height="4.5" rx="0.7" fill={c} />
          <rect x="4.8" y="5" width="3.2" height="7" rx="0.7" fill={c} />
          <rect x="9.6" y="2.5" width="3.2" height="9.5" rx="0.7" fill={c} />
          <rect x="14.4" y="0" width="3.2" height="12" rx="0.7" fill={c} />
        </svg>
        <svg width="17" height="12" viewBox="0 0 17 12">
          <path d="M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z" fill={c} />
          <path d="M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z" fill={c} />
          <circle cx="8.5" cy="10.5" r="1.5" fill={c} />
        </svg>
        <svg width="27" height="13" viewBox="0 0 27 13">
          <rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke={c} strokeOpacity="0.35" fill="none" />
          <rect x="2" y="2" width="20" height="9" rx="2" fill={c} />
          <path d="M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z" fill={c} fillOpacity="0.4" />
        </svg>
      </div>
    </div>
  );
}

function ArrowButton({ dir, onClick, enabled }: { dir: "prev" | "next"; onClick: () => void; enabled: boolean }) {
  return (
    <button
      type="button"
      aria-label={dir === "prev" ? "Previous person" : "Next person"}
      onClick={onClick}
      className="meridian-arrow"
      style={{
        position: "absolute",
        [dir === "prev" ? "left" : "right"]: 10,
        top: "50%",
        transform: "translateY(-50%)",
        width: 34,
        height: 34,
        borderRadius: "50%",
        border: "none",
        background: "rgba(20,20,22,0.55)",
        backdropFilter: "blur(6px)",
        color: "#FAFAFA",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: enabled ? 1 : 0,
        pointerEvents: enabled ? "auto" : "none",
        transition: "opacity .25s",
      }}
    >
      {dir === "prev" ? (
        <svg width="9" height="16" viewBox="0 0 9 16" fill="none">
          <path d="M8 1L1.5 8L8 15" stroke="#FAFAFA" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="9" height="16" viewBox="0 0 9 16" fill="none">
          <path d="M1 1L7.5 8L1 15" stroke="#FAFAFA" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}

function ProductSection({ product, first, scaleRef, autoSwipe }: {
  product: (typeof PRODUCTS)[number];
  first: boolean;
  scaleRef: MutableRefObject<number>;
  autoSwipe: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [qty, setQty] = useState(10);
  const [size, setSize] = useState("");
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const moved = useRef(false);
  const dragRef = useRef(0);

  useEffect(() => {
    if (!autoSwipe) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % 8), 2600);
    return () => clearInterval(timer);
  }, [autoSwipe]);

  const onDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    startX.current = e.clientX;
    moved.current = false;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    dragRef.current = 0;
    setDragging(true);
    setDrag(0);
  }, []);

  const onMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      let d = (e.clientX - startX.current) / (scaleRef.current || 1);
      if (Math.abs(d) > 5) moved.current = true;
      setIndex((i) => {
        if ((i === 0 && d > 0) || (i === 7 && d < 0)) d *= 0.3;
        dragRef.current = d;
        setDrag(d);
        return i;
      });
    },
    [dragging, scaleRef],
  );

  const onUp = useCallback(() => {
    if (!dragging) return;
    const d = dragRef.current;
    setIndex((i) => {
      if (d < -60 && i < 7) return i + 1;
      if (d > 60 && i > 0) return i - 1;
      return i;
    });
    setDrag(0);
    setDragging(false);
  }, [dragging]);

  const suppressClick = useCallback((e: React.MouseEvent) => {
    if (moved.current) {
      e.preventDefault();
      e.stopPropagation();
      moved.current = false;
    }
  }, []);

  const trackX = LEFT_PEEK - index * CARD_STEP + drag;

  return (
    <div style={{ borderTop: first ? "none" : "1px solid #2C2C2E" }}>
      <div style={{ position: "relative", marginTop: 18 }}>
        <div
          style={{ overflow: "hidden", touchAction: "pan-y", cursor: dragging ? "grabbing" : "grab" }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onClickCapture={suppressClick}
        >
          <div
            style={{
              display: "flex",
              gap: CARD_GAP,
              willChange: "transform",
              transform: `translate3d(${trackX}px,0,0)`,
              transition: dragging ? "none" : "transform .38s cubic-bezier(.22,.61,.36,1)",
            }}
          >
            {Array.from({ length: 8 }, (_, i) => {
              const n = String(i + 1).padStart(2, "0");
              return (
                <div key={n} style={{ flex: "none", width: CARD_W, height: 340, background: "#232326" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/meridian/${product.key}-${n}.jpg`}
                    alt={`${product.name} — try-on ${i + 1} of 8`}
                    draggable={false}
                    loading={i === 0 ? "eager" : "lazy"}
                    style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block", userSelect: "none" }}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <ArrowButton dir="prev" enabled={index > 0} onClick={() => setIndex((i) => Math.max(0, i - 1))} />
        <ArrowButton dir="next" enabled={index < 7} onClick={() => setIndex((i) => Math.min(7, i + 1))} />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 12 }}>
        {Array.from({ length: 8 }, (_, i) => (
          <span
            key={i}
            onClick={() => setIndex(i)}
            style={{ width: 6, height: 6, borderRadius: "50%", background: i === index ? "#FAFAFA" : "#48484C", cursor: "pointer" }}
          />
        ))}
      </div>

      <p style={{ margin: "10px 24px 0", fontSize: 12, lineHeight: 1.5, color: "#9A9AA0", textAlign: "center" }}>
        Eight people, measured — Fitzpatrick I, III, IV and VI.
      </p>

      <div style={{ padding: "14px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <span style={{ fontFamily: HANKEN, fontWeight: 600, fontSize: 19, letterSpacing: "0.01em" }}>{product.name}</span>
          <span style={{ fontSize: 16, fontWeight: 500 }}>{product.price}</span>
        </div>
        <div style={{ marginTop: 4, fontSize: 13, color: "#9A9AA0" }}>{product.color}</div>
      </div>

      <div style={{ margin: "16px 24px 0", borderTop: "1px solid #2C2C2E", paddingTop: 16, paddingBottom: 28 }}>
        <div style={{ fontFamily: HANKEN, fontWeight: 600, fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", color: "#9A9AA0" }}>
          Sample order for Store 114
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", border: "1px solid #3A3A3C", height: 44, boxSizing: "border-box" }}>
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setQty((q) => Math.max(10, q - 10))}
              style={{ width: 40, height: "100%", background: "none", border: "none", color: "#FAFAFA", fontSize: 17, cursor: "pointer", opacity: qty <= 10 ? 0.35 : 1 }}
            >
              &#8722;
            </button>
            <span style={{ minWidth: 44, textAlign: "center", fontSize: 15, fontWeight: 500 }}>{qty}</span>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => setQty((q) => Math.min(990, q + 10))}
              style={{ width: 40, height: "100%", background: "none", border: "none", color: "#FAFAFA", fontSize: 17, cursor: "pointer" }}
            >
              +
            </button>
          </div>
          <div style={{ position: "relative", flex: 1 }}>
            <select
              value={size}
              aria-label="Size"
              onChange={(e) => setSize(e.target.value)}
              style={{
                width: "100%",
                height: 44,
                background: "transparent",
                border: "1px solid #3A3A3C",
                borderRadius: 0,
                color: "#FAFAFA",
                fontFamily: PLEX,
                fontSize: 14,
                padding: "0 14px",
                appearance: "none",
                cursor: "pointer",
              }}
            >
              <option value="" disabled>
                Size
              </option>
              <option value="S">S</option>
              <option value="M">M</option>
              <option value="L">L</option>
              <option value="XL">XL</option>
            </select>
            <span
              style={{
                position: "absolute",
                right: 14,
                top: "50%",
                marginTop: -2,
                width: 0,
                height: 0,
                borderLeft: "4px solid transparent",
                borderRight: "4px solid transparent",
                borderTop: "5px solid #9A9AA0",
                pointerEvents: "none",
              }}
            />
          </div>
        </div>
        <button
          type="button"
          className="meridian-order"
          style={{
            width: "100%",
            height: 46,
            marginTop: 10,
            background: "#FAFAFA",
            color: "#111111",
            border: "none",
            fontFamily: HANKEN,
            fontWeight: 600,
            fontSize: 12,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Place sample order
        </button>
        <div style={{ marginTop: 9, fontSize: 11, color: "#9A9AA0" }}>Demo — no order is placed.</div>
      </div>
    </div>
  );
}

export function MeridianDemo() {
  const bodyRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(PHONE_HEIGHT_PCT);
  const [autoSwipe, setAutoSwipe] = useState(false);

  // ?autoswipe=1 — for video captures: first carousel advances every 2.6 s
  useEffect(() => {
    setAutoSwipe(new URLSearchParams(window.location.search).has("autoswipe"));
  }, []);

  useEffect(() => {
    const applyScale = () => {
      const body = bodyRef.current;
      const ph = phoneRef.current;
      if (!body || !ph) return;
      const byHeight = (body.offsetHeight * PHONE_HEIGHT_PCT) / FRAME_H;
      const byWidth = (body.offsetWidth - 32) / (PHONE_W + 2 * FRAME_PAD);
      const s = Math.max(0.2, Math.min(byHeight, byWidth));
      scaleRef.current = s;
      ph.style.transform = `scale(${s})`;
    };
    applyScale();
    window.addEventListener("resize", applyScale);
    return () => window.removeEventListener("resize", applyScale);
  }, []);

  return (
    <div className="meridian-page">
      <style>{`
        .meridian-page{height:100vh;display:flex;flex-direction:column;background:#FFFFFF;color:#111111;overflow:hidden}
        .meridian-body{flex:1;display:flex;min-height:0}
        .meridian-left{flex:none;width:560px;margin-left:120px;padding-top:72px}
        .meridian-phonewrap{flex:1;display:flex;align-items:center;justify-content:center;padding-right:100px;min-height:0}
        .meridian-scroll{scrollbar-width:none}
        .meridian-scroll::-webkit-scrollbar{display:none}
        .meridian-arrow:hover{background:rgba(20,20,22,0.8)!important}
        .meridian-order:hover{background:#E9E9E9!important}
        @media (max-width:1100px){
          .meridian-page{overflow:auto;height:auto;min-height:100vh}
          .meridian-body{flex-direction:column}
          .meridian-left{width:auto;margin:0;padding:40px 28px 0}
          .meridian-phonewrap{padding:32px 0 56px;min-height:720px}
        }
      `}</style>

      {/* CASTING chrome stays visible above the MERIDIAN stage — mark only, it links back home */}
      <div
        className="flex flex-none items-center px-4 py-2 text-xs"
        style={{ background: "var(--background)", color: "var(--muted)" }}
      >
        <Link href="/" aria-label="CASTING — home" className="flex h-8 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/casting-mark-light.svg" alt="" aria-hidden className="h-[13px] w-auto" />
          <span className="font-semibold" style={{ fontSize: 14, letterSpacing: "0.15em", color: "#111111" }}>
            CASTING
          </span>
        </Link>
      </div>

      <div className="meridian-body">
      <div className="meridian-left">
        <Wordmark fontSize={42} letterSpacing="0.14em" color="#211E1A" strokeWidth={2.5} />
        <div style={{ marginTop: 14, fontFamily: HANKEN, fontWeight: 600, fontSize: 12, letterSpacing: "0.3em", color: "#6F6A62" }}>
          A FICTIONAL RETAILER · CREATED FOR THIS DEMO
        </div>
        <p style={{ margin: "48px 0 0", maxWidth: 470, fontSize: 17, lineHeight: 1.65, color: "#111111", textWrap: "pretty" }}>
          Store 114 · Brooklyn — what a customer sees on the product page after CASTING: the same shirt on eight measured
          people — and the rest of the drop below it. Swipe and scroll the phone.
        </p>
        <p style={{ margin: "22px 0 0", maxWidth: 430, fontSize: 12.5, lineHeight: 1.6, color: "#767676", textWrap: "pretty" }}>
          Try-on images are real Perfect Corp Apparel VTO output on CASTING&apos;s measured panel. MERIDIAN GOODS is
          fictional.
        </p>
      </div>

      <div ref={bodyRef} className="meridian-phonewrap">
        <div ref={phoneRef} style={{ flex: "none", transform: `scale(${PHONE_HEIGHT_PCT})` }}>
          <div
            style={{
              background: "#1B1B1D",
              borderRadius: 60,
              padding: FRAME_PAD,
              boxShadow: "0 34px 70px rgba(0,0,0,0.28), inset 0 0 0 1px rgba(255,255,255,0.09)",
              colorScheme: "dark",
            }}
          >
            <div
              style={{
                width: PHONE_W,
                height: PHONE_H,
                borderRadius: 48,
                overflow: "hidden",
                position: "relative",
                background: "#000",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.12)",
                WebkitFontSmoothing: "antialiased",
              }}
            >
              {/* dynamic island */}
              <div
                style={{
                  position: "absolute",
                  top: 11,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 126,
                  height: 37,
                  borderRadius: 24,
                  background: "#000",
                  zIndex: 50,
                }}
              />
              {/* status bar */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 }}>
                <StatusBar />
              </div>
              {/* scrollable catalogue */}
              <div className="meridian-scroll" style={{ height: "100%", overflowY: "auto", overflowX: "hidden" }}>
                <div
                  style={{
                    minHeight: "100%",
                    display: "flex",
                    flexDirection: "column",
                    background: "#1C1C1E",
                    fontFamily: PLEX,
                    color: "#FAFAFA",
                    boxSizing: "border-box",
                    paddingTop: 62,
                    colorScheme: "dark",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 22px 11px",
                      borderBottom: "1px solid #2C2C2E",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        style={{
                          position: "relative",
                          width: 19,
                          height: 19,
                          border: "1.5px solid #FAFAFA",
                          borderRadius: "50%",
                          display: "inline-block",
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            left: "50%",
                            top: -3,
                            bottom: -3,
                            width: 1.5,
                            background: "#FAFAFA",
                            transform: "translateX(-50%)",
                          }}
                        />
                      </span>
                      <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <Wordmark fontSize={11.5} letterSpacing="0.13em" color="#FAFAFA" strokeWidth={1.2} />
                        <span style={{ fontFamily: HANKEN, fontWeight: 600, fontSize: 7.5, letterSpacing: "0.16em", color: "#9A9AA0" }}>
                          A FICTIONAL RETAILER · CREATED FOR THIS DEMO
                        </span>
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: "#9A9AA0" }}>Store 114</span>
                  </div>

                  {PRODUCTS.map((product, si) => (
                    <ProductSection
                      key={product.key}
                      product={product}
                      first={si === 0}
                      scaleRef={scaleRef}
                      autoSwipe={autoSwipe && si === 0}
                    />
                  ))}

                  <div style={{ height: 34 }} />
                </div>
              </div>
              {/* home indicator */}
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  zIndex: 60,
                  height: 34,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "flex-end",
                  paddingBottom: 8,
                  pointerEvents: "none",
                }}
              >
                <div style={{ width: 139, height: 5, borderRadius: 100, background: "rgba(255,255,255,0.7)" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

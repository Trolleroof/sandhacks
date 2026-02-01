import { animate, stagger, utils } from "animejs";

// Check if user prefers reduced motion
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Animation utilities for Reality Memory UI
export const animations = {
  /**
   * Hero section reveal animation
   * Used on landing page for title, subtitle, and buttons
   */
  heroReveal(targets: string | Element | Element[]) {
    if (prefersReducedMotion()) return;

    return animate(targets, {
      opacity: [0, 1],
      translateY: [30, 0],
      duration: 800,
      ease: "outExpo",
      delay: stagger(100),
    });
  },

  /**
   * Step cards stagger animation
   * Used for "How it works" section on landing page
   */
  staggerCards(targets: string | Element | Element[]) {
    if (prefersReducedMotion()) return;

    return animate(targets, {
      opacity: [0, 1],
      translateY: [40, 0],
      scale: [0.95, 1],
      duration: 600,
      ease: "outQuad",
      delay: stagger(150, { start: 100 }),
    });
  },

  /**
   * Mode toggle slider animation
   * Animates the underline/indicator when switching modes
   */
  modeToggle(target: Element, direction: "left" | "right") {
    if (prefersReducedMotion()) return;

    return animate(target, {
      translateX: direction === "left" ? 0 : "100%",
      duration: 300,
      ease: "inOutQuad",
    });
  },

  /**
   * Result card entrance animation
   * Used when search results appear
   */
  resultCardEntrance(targets: string | Element | Element[]) {
    if (prefersReducedMotion()) return;

    return animate(targets, {
      opacity: [0, 1],
      translateY: [20, 0],
      scale: [0.95, 1],
      duration: 400,
      ease: "outQuad",
      delay: stagger(80),
    });
  },

  /**
   * Guidance arrow pulse animation
   * Continuous pulse for the direction compass
   */
  guidanceArrowPulse(target: string | Element) {
    if (prefersReducedMotion()) return;

    return animate(target, {
      scale: [1, 1.1, 1],
      duration: 1000,
      loop: true,
      ease: "inOutSine",
    });
  },

  /**
   * Success glow animation
   * Used when user arrives at destination
   */
  successGlow(target: string | Element) {
    if (prefersReducedMotion()) return;

    return animate(target, {
      boxShadow: [
        "0 0 0 rgba(34, 197, 94, 0)",
        "0 0 40px rgba(34, 197, 94, 0.6)",
        "0 0 0 rgba(34, 197, 94, 0)",
      ],
      duration: 1500,
      ease: "inOutQuad",
    });
  },

  /**
   * Mapping pulse animation
   * Shows while mapping is active
   */
  mappingPulse(target: string | Element) {
    if (prefersReducedMotion()) return;

    return animate(target, {
      opacity: [0.5, 1, 0.5],
      scale: [1, 1.05, 1],
      duration: 2000,
      loop: true,
      ease: "inOutSine",
    });
  },

  /**
   * Fade in animation
   * Generic fade in for any element
   */
  fadeIn(targets: string | Element | Element[], delay = 0) {
    if (prefersReducedMotion()) return;

    return animate(targets, {
      opacity: [0, 1],
      duration: 400,
      delay,
      ease: "outQuad",
    });
  },

  /**
   * Slide up animation
   * Used for panels and drawers
   */
  slideUp(target: string | Element) {
    if (prefersReducedMotion()) return;

    return animate(target, {
      translateY: ["100%", 0],
      opacity: [0, 1],
      duration: 400,
      ease: "outCubic",
    });
  },

  /**
   * Rotate compass arrow
   * Smoothly rotates compass to new bearing
   */
  rotateCompass(target: string | Element, bearing: number) {
    if (prefersReducedMotion()) {
      // Still update rotation, just without animation
      utils.set(target, { rotate: bearing });
      return;
    }

    return animate(target, {
      rotate: bearing,
      duration: 300,
      ease: "outQuad",
    });
  },

  /**
   * Number count up animation
   * Used for distance display
   */
  countUp(target: string | Element, endValue: number, decimals = 1) {
    if (prefersReducedMotion()) {
      if (target instanceof Element) {
        target.textContent = endValue.toFixed(decimals);
      }
      return;
    }

    const obj = { value: 0 };
    return animate(obj, {
      value: endValue,
      duration: 600,
      ease: "outQuad",
      onUpdate: () => {
        if (target instanceof Element) {
          target.textContent = obj.value.toFixed(decimals);
        }
      },
    });
  },

  /**
   * Memory scan reveal - cards slide in from different directions
   * Used for ProblemSection target audience cards
   */
  memoryScanReveal(targets: Element[]) {
    if (prefersReducedMotion()) return;

    // Define slide directions for each card (alternating pattern)
    const directions = [
      { x: -60, y: 0 },    // Card 1: slide from left
      { x: 0, y: -60 },    // Card 2: slide from top
      { x: 60, y: 0 },     // Card 3: slide from right
      { x: 0, y: 60 },     // Card 4: slide from bottom
    ];

    return targets.map((target, index) => {
      const dir = directions[index % directions.length];
      return animate(target, {
        opacity: [0, 1],
        translateX: [dir.x, 0],
        translateY: [dir.y, 0],
        scale: [0.9, 1],
        duration: 700,
        ease: "outExpo",
        delay: index * 120,
      });
    });
  },

  /**
   * Stop all animations on target
   */
  stop(target: string | Element | Element[]) {
    // In anime.js v4, we can use the returned animation's pause/cancel method
    // For now, just set final state
    utils.set(target, { animationPlayState: "paused" });
  },
};

export default animations;

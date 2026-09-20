"use client";

import gsap from "gsap";
import { ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  getLocationPath,
  getLocationSlugFromPath,
} from "@/src/application/location-routing";
import type { Location } from "@/src/domain/site";
import { browserLocationPreferenceStore } from "@/src/infrastructure/browser-location-preference-store";
import {
  trackLocationSwitch,
  trackOgLinkOpen,
} from "@/src/infrastructure/google-analytics";
import { SiteFooter } from "@/src/components/site-footer";
import { ThemeControl } from "@/src/components/theme-control";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
const pageCanvasSelector = "[data-page-canvas]";
const pageInteractionSurfaceSelector = "[data-page-interaction-surface]";
const navigationMotion = { duration: 0.32, ease: "power2.inOut" } as const;

function setMenuIcon(
  button: HTMLButtonElement,
  isOpen: boolean,
  timeline?: gsap.core.Timeline,
): void {
  const strokes = [
    [".navigation-toggle-line-top", { y: isOpen ? 8 : 0, rotation: isOpen ? 45 : 0 }],
    [".navigation-toggle-line-middle", { scaleX: isOpen ? 0 : 1 }],
    [".navigation-toggle-line-bottom", { y: isOpen ? -8 : 0, rotation: isOpen ? -45 : 0 }],
  ] as const;

  for (const [selector, transform] of strokes) {
    const stroke = button.querySelector<SVGLineElement>(selector);
    if (!stroke) continue;
    // Each stroke starts on an exact closed-state pixel row, then moves to center.
    const properties = { ...transform, transformOrigin: "50% 50%", smoothOrigin: false };
    if (timeline) {
      // All strokes inherit the drawer's duration and ease, beginning at time zero.
      timeline.to(stroke, properties, 0);
    } else {
      gsap.set(stroke, properties);
    }
  }
}

function getPageCanvasParts(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(pageCanvasSelector));
}

function setPageInteractionSurfacesInert(isInert: boolean): void {
  document
    .querySelectorAll<HTMLElement>(pageInteractionSurfaceSelector)
    .forEach((part) => {
      part.inert = isInert;
    });
}

function getDrawerOverlay(): HTMLDivElement | null {
  return document.querySelector<HTMLDivElement>(".drawer-overlay");
}

function setDrawerAvailable(drawer: HTMLElement, isAvailable: boolean): void {
  drawer.inert = !isAvailable;
  drawer.setAttribute("aria-hidden", String(!isAvailable));
}

type NavigationLocation = Pick<Location, "id" | "slug" | "displayName">;

type SiteHeaderProps = Readonly<{
  children: ReactNode;
  siteName: string;
  tenantId: string;
  locations: readonly NavigationLocation[];
}>;

type CloseOptions = Readonly<{
  immediate?: boolean;
  restoreFocus?: boolean;
}>;

type ScrollLockStyles = Readonly<{
  bodyOverflow: string;
  documentOverflow: string;
}>;

export function SiteHeader({
  children,
  siteName,
  tenantId,
  locations,
}: SiteHeaderProps) {
  const pathname = usePathname();
  const navigationRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const animationRef = useRef<gsap.core.Timeline | null>(null);
  const drawerOpenRef = useRef(false);
  const drawerClosingRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const previousPathnameRef = useRef(pathname);
  const navigationFocusPendingRef = useRef(false);
  const scrollLockStylesRef = useRef<ScrollLockStyles | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isNavigationReady, setIsNavigationReady] = useState(false);

  const currentSlug = getLocationSlugFromPath(pathname, locations);
  const currentLocationId = locations.find((location) => location.slug === currentSlug)?.id;

  const stopAnimation = useCallback(() => {
    animationRef.current?.kill();
    animationRef.current = null;
  }, []);

  const focusMainContent = useCallback(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, []);

  const lockPageScroll = useCallback(() => {
    if (scrollLockStylesRef.current) {
      return;
    }

    scrollLockStylesRef.current = {
      bodyOverflow: document.body.style.overflow,
      documentOverflow: document.documentElement.style.overflow,
    };
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  }, []);

  const unlockPageScroll = useCallback(() => {
    const previousStyles = scrollLockStylesRef.current;

    if (!previousStyles) {
      return;
    }

    document.body.style.overflow = previousStyles.bodyOverflow;
    document.documentElement.style.overflow =
      previousStyles.documentOverflow;
    scrollLockStylesRef.current = null;
  }, []);

  const closeDrawer = useCallback(
    ({ immediate = false, restoreFocus = true }: CloseOptions = {}) => {
      const drawer = drawerRef.current;
      const overlay = getDrawerOverlay();
      const opener = menuButtonRef.current;

      if (
        !drawer ||
        !overlay ||
        !opener ||
        (!drawerOpenRef.current &&
          !(immediate && drawerClosingRef.current))
      ) {
        return;
      }

      drawerOpenRef.current = false;
      drawerClosingRef.current = true;
      stopAnimation();

      const duration = immediate || reducedMotionRef.current ? 0 : navigationMotion.duration;
      const drawerWidth = drawer.getBoundingClientRect().width;
      const pageCanvasParts = getPageCanvasParts();

      const finishClose = () => {
        if (drawerOpenRef.current) {
          return;
        }

        setIsDrawerOpen(false);
        setPageInteractionSurfacesInert(false);
        gsap.set(overlay, {
          autoAlpha: 0,
          pointerEvents: "none",
        });
        drawerClosingRef.current = false;
        animationRef.current = null;
        unlockPageScroll();

        if (restoreFocus) {
          opener.focus({ preventScroll: true });
        } else {
          // A departing navigation link must not retain focus inside an inert drawer.
          focusMainContent();
        }

        setDrawerAvailable(drawer, false);
      };

      if (duration === 0) {
        setMenuIcon(opener, false);
        gsap.set(drawer, { x: drawerWidth });
        gsap.set(pageCanvasParts, { x: 0 });
        finishClose();
        return;
      }

      const timeline = gsap.timeline({
        defaults: navigationMotion,
        onComplete: finishClose,
      });

      timeline
        .to(drawer, { x: drawerWidth }, 0)
        .to(pageCanvasParts, { x: 0 }, 0)
        .to(overlay, { opacity: 0 }, 0);

      setMenuIcon(opener, false, timeline);

      animationRef.current = timeline;
    },
    [focusMainContent, stopAnimation, unlockPageScroll],
  );

  const openDrawer = useCallback(() => {
    const drawer = drawerRef.current;
    const overlay = getDrawerOverlay();
    const opener = menuButtonRef.current;

    if (
      !drawer ||
      !overlay ||
      !opener ||
      drawerOpenRef.current
    ) {
      return;
    }

    const shouldPreserveAnimationProgress = animationRef.current !== null;
    drawerOpenRef.current = true;
    drawerClosingRef.current = false;
    setIsDrawerOpen(true);
    stopAnimation();

    const drawerWidth = drawer.getBoundingClientRect().width;
    const pageCanvasParts = getPageCanvasParts();
    const duration = reducedMotionRef.current ? 0 : navigationMotion.duration;

    setDrawerAvailable(drawer, true);
    opener.focus({ preventScroll: true });
    setPageInteractionSurfacesInert(true);
    lockPageScroll();
    gsap.set(overlay, {
      pointerEvents: "auto",
      visibility: "visible",
    });
    if (!shouldPreserveAnimationProgress) {
      gsap.set(drawer, { x: drawerWidth });
      gsap.set(pageCanvasParts, { x: 0 });
      gsap.set(overlay, { opacity: 0 });
    }

    if (duration === 0) {
      setMenuIcon(opener, true);
      gsap.set(drawer, { x: 0 });
      gsap.set(pageCanvasParts, { x: -drawerWidth });
      gsap.set(overlay, { opacity: 0.16 });
      animationRef.current = null;
      return;
    }

    const timeline = gsap.timeline({
      defaults: navigationMotion,
      onComplete: () => {
        if (!drawerOpenRef.current) {
          return;
        }

        animationRef.current = null;
      },
    });

    timeline
      .to(drawer, { x: 0 }, 0)
      .to(pageCanvasParts, { x: -drawerWidth }, 0)
      .to(overlay, { opacity: 0.16 }, 0);

    setMenuIcon(opener, true, timeline);

    animationRef.current = timeline;
  }, [lockPageScroll, stopAnimation]);

  const toggleDrawer = useCallback(() => {
    if (drawerOpenRef.current) {
      closeDrawer();
    } else {
      openDrawer();
    }
  }, [closeDrawer, openDrawer]);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const syncHeaderHeight = () => {
      document.documentElement.style.setProperty(
        "--site-header-height",
        `${header.getBoundingClientRect().height}px`,
      );
    };
    syncHeaderHeight();
    const observer = new ResizeObserver(syncHeaderHeight);
    observer.observe(header);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--site-header-height");
    };
  }, []);

  useEffect(() => {
    if (!currentLocationId) return;

    const rememberLocation = () => {
      void browserLocationPreferenceStore.setLastLocationId(tenantId, currentLocationId);
    };
    rememberLocation();
    // Returning from the original page may restore this page from the browser cache.
    window.addEventListener("pageshow", rememberLocation);
    return () => {
      window.removeEventListener("pageshow", rememberLocation);
    };
  }, [currentLocationId, tenantId]);

  useEffect(() => {
    const drawer = drawerRef.current;
    const overlay = getDrawerOverlay();
    const opener = menuButtonRef.current;

    if (!drawer || !overlay || !opener) {
      return;
    }

    const reducedMotion = window.matchMedia(reducedMotionQuery);

    const syncDrawerGeometry = () => {
      const drawerWidth = drawer.getBoundingClientRect().width;
      const pageCanvasParts = getPageCanvasParts();

      if (drawerOpenRef.current) {
        stopAnimation();
        drawerClosingRef.current = false;
        setMenuIcon(opener, true);
        setDrawerAvailable(drawer, true);
        setPageInteractionSurfacesInert(true);
        lockPageScroll();
        gsap.set(drawer, { x: 0 });
        gsap.set(pageCanvasParts, { x: -drawerWidth });
        gsap.set(overlay, {
          autoAlpha: 0.16,
          pointerEvents: "auto",
        });
        return;
      }

      const drawerContainedFocus =
        document.activeElement instanceof Element &&
        drawer.contains(document.activeElement);

      stopAnimation();
      drawerClosingRef.current = false;
      setIsDrawerOpen(false);
      setMenuIcon(opener, false);
      setPageInteractionSurfacesInert(false);
      unlockPageScroll();
      gsap.set(drawer, { x: drawerWidth });
      gsap.set(pageCanvasParts, { x: 0 });
      gsap.set(overlay, {
        autoAlpha: 0,
        pointerEvents: "none",
      });

      if (drawerContainedFocus) {
        opener.focus({ preventScroll: true });
      }

      setDrawerAvailable(drawer, false);
    };

    const syncReducedMotion = () => {
      reducedMotionRef.current = reducedMotion.matches;

      if (reducedMotion.matches && animationRef.current) {
        syncDrawerGeometry();
      }
    };

    syncReducedMotion();
    syncDrawerGeometry();
    setIsNavigationReady(true);
    reducedMotion.addEventListener("change", syncReducedMotion);
    window.addEventListener("resize", syncDrawerGeometry);

    return () => {
      reducedMotion.removeEventListener("change", syncReducedMotion);
      window.removeEventListener("resize", syncDrawerGeometry);
      stopAnimation();
      drawerOpenRef.current = false;
      drawerClosingRef.current = false;
      setMenuIcon(opener, false);
      setPageInteractionSurfacesInert(false);
      unlockPageScroll();
      gsap.set(getPageCanvasParts(), { clearProps: "transform" });
      gsap.set(drawer, { clearProps: "transform" });
      gsap.set(overlay, {
        clearProps: "opacity,visibility,pointerEvents",
      });
    };
  }, [lockPageScroll, stopAnimation, unlockPageScroll]);

  useEffect(() => {
    const overlay = getDrawerOverlay();

    if (!overlay) {
      return;
    }

    const handleOverlayClick = () => {
      closeDrawer();
    };

    overlay.addEventListener("click", handleOverlayClick);

    return () => {
      overlay.removeEventListener("click", handleOverlayClick);
    };
  }, [closeDrawer]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const drawer = drawerRef.current;
      const navigation = navigationRef.current;
      const toggle = menuButtonRef.current;

      if (
        !drawer ||
        !navigation ||
        !toggle ||
        (!drawerOpenRef.current && !drawerClosingRef.current)
      ) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusTargets = Array.from(
        navigation.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((target) => !target.closest("[inert]"));
      const firstFocusTarget = focusTargets[0] ?? toggle;
      const currentIndex = focusTargets.indexOf(
        document.activeElement as HTMLElement,
      );

      if (currentIndex === -1) {
        event.preventDefault();
        firstFocusTarget.focus();
      } else if (event.shiftKey && currentIndex === 0) {
        event.preventDefault();
        focusTargets.at(-1)?.focus();
      } else if (!event.shiftKey && currentIndex === focusTargets.length - 1) {
        event.preventDefault();
        firstFocusTarget.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDrawer]);

  useEffect(() => {
    if (previousPathnameRef.current !== pathname) {
      previousPathnameRef.current = pathname;
      const shouldFocusMain = navigationFocusPendingRef.current ||
        drawerOpenRef.current || drawerClosingRef.current;
      navigationFocusPendingRef.current = false;
      closeDrawer({ immediate: true, restoreFocus: false });

      if (shouldFocusMain) {
        focusMainContent();
      }
    }
  }, [closeDrawer, focusMainContent, pathname]);

  return (
    <div className="site-canvas">
      <div
        ref={navigationRef}
        className="site-navigation"
        role={isDrawerOpen ? "dialog" : undefined}
        aria-modal={isDrawerOpen || undefined}
        aria-label={isDrawerOpen ? "Location navigation" : undefined}
      >
        <header
          ref={headerRef}
          className="site-header"
        >
          <a className="skip-link" href="#main-content" inert={isDrawerOpen}>
            Skip to main content
          </a>
          <div className="site-header-inner">
            <Link className="site-brand" href="/">
              {siteName}
            </Link>
            <button
              ref={menuButtonRef}
              className="navigation-toggle"
              type="button"
              aria-controls="location-drawer"
              aria-expanded={isDrawerOpen}
              aria-haspopup="dialog"
              disabled={!isNavigationReady}
              aria-label={isDrawerOpen ? "Close location navigation" : "Open location navigation"}
              onBlur={(event) => {
                delete event.currentTarget.dataset.pointerFocus;
              }}
              onClick={toggleDrawer}
              onKeyDown={(event) => {
                delete event.currentTarget.dataset.pointerFocus;
              }}
              onPointerDown={(event) => {
                if (event.isPrimary) {
                  event.currentTarget.dataset.pointerFocus = "true";
                }
              }}
            >
              <svg
                className="navigation-toggle-icon"
                viewBox="0 0 30 24"
                aria-hidden="true"
                focusable="false"
              >
                <line className="navigation-toggle-line navigation-toggle-line-top" x1="3" y1="4" x2="27" y2="4" />
                <line className="navigation-toggle-line navigation-toggle-line-middle" x1="3" y1="12" x2="27" y2="12" />
                <line className="navigation-toggle-line navigation-toggle-line-bottom" x1="3" y1="20" x2="27" y2="20" />
              </svg>
            </button>
          </div>
        </header>

        <div
          ref={drawerRef}
          className="location-drawer"
          id="location-drawer"
          data-navigation-ready={isNavigationReady}
          aria-hidden={!isDrawerOpen}
          inert={!isDrawerOpen}
        >
          <nav aria-label="Location calendars">
            <ul className="location-list">
              {locations.map((location) => {
                const isCurrent = location.slug === currentSlug;

                return (
                  <li key={location.id}>
                    <Link
                      className="location-link"
                      href={getLocationPath(location)}
                      aria-current={isCurrent ? "page" : undefined}
                      onClick={(event) => {
                        const opensInAnotherContext =
                          event.metaKey ||
                          event.ctrlKey ||
                          event.shiftKey ||
                          event.altKey ||
                          event.button !== 0;

                        navigationFocusPendingRef.current =
                          !isCurrent && !opensInAnotherContext;
                        if (!isCurrent && !opensInAnotherContext && currentSlug) {
                          trackLocationSwitch(currentSlug, location.slug);
                        }
                        closeDrawer({
                          immediate: !isCurrent && !opensInAnotherContext,
                          restoreFocus: isCurrent || opensInAnotherContext,
                        });
                      }}
                    >
                      <span>{location.displayName}</span>
                      <ArrowRight className="location-link-icon" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="original-destination">
              <a
                className="original-link"
                href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/og/`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => {
                  if (event.button === 0) {
                    trackOgLinkOpen(currentSlug ?? "other");
                  }
                }}
              >
                Old version
                <ExternalLink className="original-link-icon" aria-hidden="true" />
              </a>
            </div>
          </nav>
          <div className="location-drawer-settings">
            <ThemeControl />
          </div>
        </div>
      </div>

      <main
        ref={mainRef}
        className="site-main"
        data-page-canvas=""
        data-page-interaction-surface=""
        id="main-content"
        tabIndex={-1}
      >
        <div className="site-main-content">{children}</div>
      </main>

      <SiteFooter />

      <div
        className="drawer-overlay"
        aria-hidden="true"
      />
    </div>
  );
}

"use client";

import gsap from "gsap";
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

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
const pageCanvasSelector = "[data-page-canvas]";
const pageInteractionSurfaceSelector = "[data-page-interaction-surface]";

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

function setOpenerAvailable(
  opener: HTMLButtonElement,
  isAvailable: boolean,
): void {
  opener.disabled = !isAvailable;
  opener.inert = !isAvailable;

  if (isAvailable) {
    opener.removeAttribute("aria-hidden");
  } else {
    opener.setAttribute("aria-hidden", "true");
  }
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
  const drawerRef = useRef<HTMLDivElement>(null);
  const drawerCloseButtonRef = useRef<HTMLButtonElement>(null);
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
  const currentLocation = locations.find(
    (location) => location.slug === currentSlug,
  );
  const currentLocationId = currentLocation?.id;

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

      const duration = immediate || reducedMotionRef.current ? 0 : 0.28;
      const drawerWidth = drawer.getBoundingClientRect().width;
      const pageCanvasParts = getPageCanvasParts();

      const finishClose = () => {
        if (drawerOpenRef.current) {
          return;
        }

        setIsDrawerOpen(false);
        setPageInteractionSurfacesInert(false);
        setOpenerAvailable(opener, true);
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
        gsap.set(drawer, { x: -drawerWidth });
        gsap.set(pageCanvasParts, { x: 0 });
        finishClose();
        return;
      }

      const timeline = gsap.timeline({
        defaults: { duration, ease: "power2.inOut" },
        onComplete: finishClose,
      });

      timeline
        .to(drawer, { x: -drawerWidth }, 0)
        .to(pageCanvasParts, { x: 0 }, 0)
        .to(overlay, { opacity: 0 }, 0);

      animationRef.current = timeline;
    },
    [focusMainContent, stopAnimation, unlockPageScroll],
  );

  const openDrawer = useCallback(() => {
    const drawer = drawerRef.current;
    const overlay = getDrawerOverlay();
    const opener = menuButtonRef.current;
    const closeButton = drawerCloseButtonRef.current;

    if (
      !drawer ||
      !overlay ||
      !opener ||
      !closeButton ||
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
    const duration = reducedMotionRef.current ? 0 : 0.32;

    setDrawerAvailable(drawer, true);
    closeButton.focus({ preventScroll: true });
    setOpenerAvailable(opener, false);
    setPageInteractionSurfacesInert(true);
    lockPageScroll();
    gsap.set(overlay, {
      pointerEvents: "auto",
      visibility: "visible",
    });
    if (!shouldPreserveAnimationProgress) {
      gsap.set(drawer, { x: -drawerWidth });
      gsap.set(pageCanvasParts, { x: 0 });
      gsap.set(overlay, { opacity: 0 });
    }

    if (duration === 0) {
      gsap.set(drawer, { x: 0 });
      gsap.set(pageCanvasParts, { x: drawerWidth });
      gsap.set(overlay, { opacity: 0.16 });
      animationRef.current = null;
      return;
    }

    const timeline = gsap.timeline({
      defaults: { duration, ease: "power2.out" },
      onComplete: () => {
        if (!drawerOpenRef.current) {
          return;
        }

        animationRef.current = null;
      },
    });

    timeline
      .to(drawer, { x: 0 }, 0)
      .to(pageCanvasParts, { x: drawerWidth }, 0)
      .to(overlay, { opacity: 0.16 }, 0);

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
    if (currentLocationId) {
      void browserLocationPreferenceStore.setLastLocationId(
        tenantId,
        currentLocationId,
      );
    }
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
        setDrawerAvailable(drawer, true);
        setOpenerAvailable(opener, false);
        setPageInteractionSurfacesInert(true);
        lockPageScroll();
        gsap.set(drawer, { x: 0 });
        gsap.set(pageCanvasParts, { x: drawerWidth });
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
      setOpenerAvailable(opener, true);
      setPageInteractionSurfacesInert(false);
      unlockPageScroll();
      gsap.set(drawer, { x: -drawerWidth });
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
      setPageInteractionSurfacesInert(false);
      setOpenerAvailable(opener, true);
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
      const toggle = menuButtonRef.current;

      if (
        !drawer ||
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

      const drawerTargets =
        drawerOpenRef.current || drawerClosingRef.current
        ? Array.from(
            drawer.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((target) => !target.closest("[inert]"))
        : [];
      const focusTargets =
        drawerOpenRef.current || drawerClosingRef.current
        ? drawerTargets
        : [toggle];
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
      <header
        className="site-header"
        data-page-canvas=""
        data-page-interaction-surface=""
      >
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <div className="site-header-inner">
          <button
            ref={menuButtonRef}
            className="navigation-toggle"
            type="button"
            aria-controls="location-drawer"
            aria-expanded={isDrawerOpen}
            aria-haspopup="dialog"
            aria-hidden={isDrawerOpen || undefined}
            disabled={!isNavigationReady || isDrawerOpen}
            aria-label="Open location navigation"
            onClick={toggleDrawer}
          >
            <span className="navigation-toggle-icon" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
          <Link className="site-brand" href="/">
            {siteName}
          </Link>
        </div>
      </header>

      <div
        ref={drawerRef}
        className="location-drawer"
        id="location-drawer"
        data-navigation-ready={isNavigationReady}
        role="dialog"
        aria-modal={isDrawerOpen || undefined}
        aria-label="Location navigation"
        aria-hidden={!isDrawerOpen}
        inert={!isDrawerOpen}
      >
        <div className="location-drawer-header">
          <button
            ref={drawerCloseButtonRef}
            className="drawer-close"
            type="button"
            aria-label="Close location navigation"
            onClick={() => closeDrawer()}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
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

                      void browserLocationPreferenceStore.setLastLocationId(
                        tenantId,
                        location.id,
                      );
                      navigationFocusPendingRef.current =
                        !isCurrent && !opensInAnotherContext;
                      closeDrawer({
                        immediate: !isCurrent && !opensInAnotherContext,
                        restoreFocus: isCurrent || opensInAnotherContext,
                      });
                    }}
                  >
                    <span>{location.displayName}</span>
                    {isCurrent ? (
                      <span className="current-location-label">Current</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
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

      <footer
        className="site-footer"
        data-page-canvas=""
        data-page-interaction-surface=""
      >
        <a href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/og/`} aria-label="OG — original LAAW.life site">OG</a>
      </footer>

      <div
        className="drawer-overlay"
        data-page-canvas=""
        aria-hidden="true"
      />
    </div>
  );
}

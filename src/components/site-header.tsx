"use client";

import gsap from "gsap";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  getLocationPath,
  getLocationSlugFromPath,
} from "@/src/application/location-routing";
import type { Location } from "@/src/domain/site";
import { browserLocationPreferenceStore } from "@/src/infrastructure/browser-location-preference-store";

const wideNavigationQuery = "(min-width: 48rem)";
const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

type NavigationLocation = Pick<Location, "id" | "slug" | "displayName">;

type SiteHeaderProps = Readonly<{
  siteName: string;
  tenantId: string;
  locations: readonly NavigationLocation[];
}>;

type CloseOptions = Readonly<{
  immediate?: boolean;
  restoreFocus?: boolean;
}>;

export function SiteHeader({
  siteName,
  tenantId,
  locations,
}: SiteHeaderProps) {
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDialogElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const animationRef = useRef<gsap.core.Timeline | null>(null);
  const modeRef = useRef<"narrow" | "wide">("narrow");
  const reducedMotionRef = useRef(false);
  const previousPathnameRef = useRef(pathname);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const currentSlug = getLocationSlugFromPath(pathname, locations);
  const currentLocation = locations.find(
    (location) => location.slug === currentSlug,
  );
  const currentLocationId = currentLocation?.id;

  const stopAnimation = useCallback(() => {
    animationRef.current?.kill();
    animationRef.current = null;
  }, []);

  const closeMobileDrawer = useCallback(
    ({ immediate = false, restoreFocus = true }: CloseOptions = {}) => {
      const drawer = drawerRef.current;

      if (!drawer?.open || modeRef.current === "wide") {
        return;
      }

      stopAnimation();

      const duration = immediate || reducedMotionRef.current ? 0 : 0.28;
      const drawerWidth = drawer.getBoundingClientRect().width;
      const timeline = gsap.timeline({
        defaults: { duration, ease: "power2.inOut" },
        onComplete: () => {
          if (drawer.open) {
            drawer.close();
          }

          setIsMobileDrawerOpen(false);
          animationRef.current = null;

          if (restoreFocus) {
            menuButtonRef.current?.focus();
          }
        },
      });

      timeline
        .to(drawer, { x: -drawerWidth }, 0)
        .to(document.body, { paddingLeft: 0 }, 0)
        .to(drawer, { "--drawer-backdrop-alpha": 0 }, 0);

      animationRef.current = timeline;
    },
    [stopAnimation],
  );

  const openMobileDrawer = useCallback(() => {
    const drawer = drawerRef.current;

    if (!drawer || drawer.open || modeRef.current === "wide") {
      return;
    }

    stopAnimation();
    setIsMobileDrawerOpen(true);
    drawer.showModal();

    const drawerWidth = drawer.getBoundingClientRect().width;
    const duration = reducedMotionRef.current ? 0 : 0.32;

    gsap.set(drawer, {
      x: -drawerWidth,
      "--drawer-backdrop-alpha": 0,
    });

    const timeline = gsap.timeline({
      defaults: { duration, ease: "power2.out" },
      onComplete: () => {
        const currentLink = drawer.querySelector<HTMLElement>(
          '[aria-current="page"]',
        );

        (currentLink ?? drawer.querySelector<HTMLElement>("button"))?.focus();
        animationRef.current = null;
      },
    });

    timeline
      .to(drawer, { x: 0 }, 0)
      .to(document.body, { paddingLeft: drawerWidth }, 0)
      .to(drawer, { "--drawer-backdrop-alpha": 0.16 }, 0);

    animationRef.current = timeline;
  }, [stopAnimation]);

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

    if (!drawer) {
      return;
    }

    const wideViewport = window.matchMedia(wideNavigationQuery);
    const reducedMotion = window.matchMedia(reducedMotionQuery);

    const syncReducedMotion = () => {
      reducedMotionRef.current = reducedMotion.matches;
    };

    const syncViewportMode = () => {
      stopAnimation();
      const isWide = wideViewport.matches;
      modeRef.current = isWide ? "wide" : "narrow";

      if (drawer.open) {
        drawer.close();
      }

      setIsMobileDrawerOpen(false);

      if (isWide) {
        drawer.show();
        gsap.set(drawer, {
          x: 0,
          "--drawer-backdrop-alpha": 0,
        });
        gsap.set(document.body, {
          paddingLeft: drawer.getBoundingClientRect().width,
        });
      } else {
        gsap.set(drawer, {
          x: -drawer.getBoundingClientRect().width,
          "--drawer-backdrop-alpha": 0,
        });
        gsap.set(document.body, { paddingLeft: 0 });
      }
    };

    syncReducedMotion();
    syncViewportMode();
    wideViewport.addEventListener("change", syncViewportMode);
    reducedMotion.addEventListener("change", syncReducedMotion);

    return () => {
      wideViewport.removeEventListener("change", syncViewportMode);
      reducedMotion.removeEventListener("change", syncReducedMotion);
      stopAnimation();

      if (drawer.open) {
        drawer.close();
      }

      gsap.set(document.body, { clearProps: "paddingLeft" });
      gsap.set(drawer, {
        clearProps: "transform,--drawer-backdrop-alpha",
      });
    };
  }, [stopAnimation]);

  useEffect(() => {
    if (previousPathnameRef.current !== pathname) {
      previousPathnameRef.current = pathname;
      closeMobileDrawer({ immediate: true, restoreFocus: false });
    }
  }, [closeMobileDrawer, pathname]);

  return (
    <header className="site-header">
      <a className="skip-link" href="#main-content">
        Skip to calendar
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
          aria-expanded={isMobileDrawerOpen}
          aria-label={
            isMobileDrawerOpen
              ? "Close location navigation"
              : "Open location navigation"
          }
          onClick={openMobileDrawer}
        >
          <span className="navigation-toggle-icon" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
      </div>

      <dialog
        ref={drawerRef}
        className="location-drawer"
        id="location-drawer"
        aria-labelledby="location-drawer-title"
        onCancel={(event) => {
          event.preventDefault();
          closeMobileDrawer();
        }}
        onClick={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const clickedBackdrop =
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom;

          if (clickedBackdrop) {
            closeMobileDrawer();
          }
        }}
      >
        <div className="location-drawer-header">
          <h2 id="location-drawer-title">Choose a location</h2>
          <button
            className="drawer-close"
            type="button"
            aria-label="Close location navigation"
            onClick={() => closeMobileDrawer()}
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
                    onClick={() => {
                      void browserLocationPreferenceStore.setLastLocationId(
                        tenantId,
                        location.id,
                      );
                      closeMobileDrawer({ restoreFocus: isCurrent });
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
      </dialog>
    </header>
  );
}

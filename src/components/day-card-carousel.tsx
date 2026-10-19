"use client";

import { shouldReduceMotion } from "@/src/application/motion-preference";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
  type UIEvent as ReactUIEvent,
} from "react";

import {
  dayCardCount,
  getDayCardDates,
  getDayCardCarouselDates,
} from "@/src/application/calendar-dates";
import type { CalendarAgenda } from "@/src/application/ports";
import { Card } from "@/src/components/card";
import { DayCard } from "@/src/components/day-card";
import { trackGoogleAnalyticsEvent } from "@/src/infrastructure/google-analytics";

const swipeThresholdPixels = 48;

type DayCardCarouselProps = Readonly<{
  agenda: CalendarAgenda;
  children?: ReactNode;
  currentDateKey: string | null;
  locationId: string;
  onTodayControlMotion: (motion: TodayControlMotion) => void;
  returnToTodayRequest: number;
}>;

export type TodayControlMotion = Readonly<{
  direction: "backward" | "forward";
  progress: number;
}>;

type SwipeStart = {
  activeIndex: number;
  axisLock: "horizontal" | "pending" | "vertical";
  touchId: number;
  x: number;
  y: number;
};

type PointerDrag = {
  activeIndex: number;
  axisLock: "horizontal" | "pending";
  hasDragged: boolean;
  pointerId: number;
  pointerType: "mouse" | "pen";
  startScrollLeft: number;
  startX: number;
  startY: number;
};

type CarouselInteractionMethod =
  | "arrow"
  | "date_control"
  | "dot"
  | "keyboard"
  | "mouse_drag"
  | "pen_drag"
  | "touch_swipe";

function clampDayIndex(index: number, itemCount: number): number {
  return Math.min(Math.max(index, 0), itemCount - 1);
}

function getClosestCardIndex(viewport: HTMLDivElement): number {
  const cards = viewport.querySelectorAll<HTMLElement>("[data-carousel-item]");
  const viewportRect = viewport.getBoundingClientRect();
  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  cards.forEach((card, index) => {
    const cardRect = card.getBoundingClientRect();
    const distance = Math.abs(viewportRect.left - cardRect.left);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  return closestIndex;
}

function getPointerNavigationThreshold(
  viewport: HTMLDivElement,
  activeIndex: number,
): number {
  const cards = viewport.querySelectorAll<HTMLElement>("[data-carousel-item]");
  const activeCard = cards.item(activeIndex);
  const adjacentCard = cards.item(activeIndex === 0 ? 1 : activeIndex - 1);
  if (!activeCard || !adjacentCard) return Number.POSITIVE_INFINITY;

  const activeRect = activeCard.getBoundingClientRect();
  const adjacentRect = adjacentCard.getBoundingClientRect();
  const activeCenter = activeRect.left + activeRect.width / 2;
  const adjacentCenter = adjacentRect.left + adjacentRect.width / 2;
  return Math.abs(adjacentCenter - activeCenter) / 2;
}

export function DayCardCarousel({
  agenda,
  children,
  currentDateKey,
  locationId,
  onTodayControlMotion,
  returnToTodayRequest,
}: DayCardCarouselProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(0);
  const handledReturnToTodayRequestRef = useRef(0);
  const previousCurrentDateKeyRef = useRef<string | null>(null);
  const previousScrollLeftRef = useRef(0);
  const pointerDragRef = useRef<PointerDrag | null>(null);
  const programmaticTargetIndexRef = useRef<number | null>(null);
  const resizeTimerRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const swipeStartRef = useRef<SwipeStart | null>(null);
  const suppressClickRef = useRef(false);
  const todayControlDirectionRef = useRef<TodayControlMotion["direction"]>(
    "forward",
  );
  const pendingLoadedIndexRef = useRef<number | null>(null);
  const [visibleUpcomingDayCount, setVisibleUpcomingDayCount] = useState(dayCardCount);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const dayCardDates = useMemo(
    () => currentDateKey === null ? [] : getDayCardCarouselDates(currentDateKey, visibleUpcomingDayCount),
    [currentDateKey, visibleUpcomingDayCount],
  );
  const visibleDayCount = dayCardDates.length;
  const todayIndex = Math.max(dayCardDates.findIndex(({ dateKey }) => dateKey === currentDateKey), 0);
  const hasNoAvailableSources =
    agenda.sourceCount > 0 &&
    agenda.failedSourceCount === agenda.sourceCount;
  const hasMoreDays = currentDateKey !== null && !hasNoAvailableSources &&
    getDayCardDates(currentDateKey, visibleUpcomingDayCount + dayCardCount)
      .slice(visibleUpcomingDayCount)
      .every(({ dateKey }) => agenda.availableDateKeys.includes(dateKey));
  const itemCount = dayCardDates.length + (hasMoreDays ? 1 : 0);
  const selectedIndex = selectedDateKey === "load-more" && hasMoreDays
    ? dayCardDates.length
    : dayCardDates.findIndex(({ dateKey }) => dateKey === selectedDateKey);
  const activeIndex = selectedIndex >= 0 ? selectedIndex : todayIndex;
  const hasNoAvailableDates =
    dayCardDates.length > 0 &&
    dayCardDates.every(({ dateKey }) =>
      !agenda.availableDateKeys.includes(dateKey),
    );

  const positionViewport = useCallback((
    requestedIndex: number,
    behavior: ScrollBehavior,
  ) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const nextIndex = clampDayIndex(requestedIndex, itemCount);
    const cards = viewport.querySelectorAll<HTMLElement>("[data-carousel-item]");
    const nextCard = cards.item(nextIndex);
    if (!nextCard) return;

    const viewportRect = viewport.getBoundingClientRect();
    const cardRect = nextCard.getBoundingClientRect();
    const startDelta = cardRect.left - viewportRect.left;

    viewport.scrollTo({
      behavior,
      left: viewport.scrollLeft + startDelta,
    });
  }, [itemCount]);

  const scrollToCard = useCallback((requestedIndex: number) => {
    const nextIndex = clampDayIndex(requestedIndex, itemCount);
    const nextDate = dayCardDates[nextIndex];
    if (!nextDate && (!hasMoreDays || nextIndex !== dayCardDates.length)) return;

    if (resizeTimerRef.current !== null) {
      window.clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = null;
    }
    const reduceMotion = shouldReduceMotion();
    activeIndexRef.current = nextIndex;
    programmaticTargetIndexRef.current = nextIndex;
    setSelectedDateKey(nextDate?.dateKey === currentDateKey ? null : nextDate?.dateKey ?? "load-more");
    positionViewport(nextIndex, reduceMotion ? "auto" : "smooth");
  }, [currentDateKey, dayCardDates, hasMoreDays, itemCount, positionViewport]);

  const trackNavigation = useCallback((
    fromIndex: number,
    toIndex: number,
    interactionMethod: CarouselInteractionMethod,
    interactionSource: string,
    resultingAction?: "return_to_today",
  ) => {
    const fromDay = dayCardDates[clampDayIndex(fromIndex, itemCount)];
    const toDay = dayCardDates[clampDayIndex(toIndex, itemCount)];
    if (itemCount === 0) return;

    trackGoogleAnalyticsEvent("carousel_navigation", {
      direction: toIndex === fromIndex
        ? "same"
        : toIndex > fromIndex
          ? "forward"
          : "backward",
      ...(fromDay ? { from_date: fromDay.dateKey } : {}),
      from_index: fromIndex,
      from_relative_label: fromDay?.relativeLabel ?? "Load seven more days",
      interaction_method: interactionMethod,
      interaction_source: interactionSource,
      location_id: locationId,
      ...(resultingAction === undefined
        ? {}
        : {
            ...(fromDay ? { displayed_date: fromDay.dateKey } : {}),
            displayed_day: fromDay?.relativeLabel ?? "Load seven more days",
            resulting_action: resultingAction,
          }),
      ...(toDay ? { to_date: toDay.dateKey } : {}),
      to_index: toIndex,
      to_relative_label: toDay?.relativeLabel ?? "Load seven more days",
      visible_day_count: visibleDayCount,
    });
  }, [dayCardDates, itemCount, locationId, visibleDayCount]);

  const trackBoundaryAttempt = useCallback((
    currentIndex: number,
    attemptedDirection: "backward" | "forward",
    interactionMethod: CarouselInteractionMethod,
    interactionSource: string,
  ) => {
    const currentDay = dayCardDates[clampDayIndex(currentIndex, itemCount)];
    if (itemCount === 0) return;

    trackGoogleAnalyticsEvent("carousel_boundary_attempt", {
      attempted_direction: attemptedDirection,
      boundary: attemptedDirection === "backward" ? "start" : "end",
      ...(currentDay ? { current_date: currentDay.dateKey } : {}),
      current_index: currentIndex,
      current_relative_label: currentDay?.relativeLabel ?? "Load seven more days",
      interaction_method: interactionMethod,
      interaction_source: interactionSource,
      location_id: locationId,
      visible_day_count: visibleDayCount,
    });
  }, [dayCardDates, itemCount, locationId, visibleDayCount]);

  const navigateFromInteraction = useCallback((
    fromIndex: number,
    requestedIndex: number,
    interactionMethod: CarouselInteractionMethod,
    interactionSource: string,
  ) => {
    const normalizedFromIndex = clampDayIndex(fromIndex, itemCount);
    if (requestedIndex < 0 || requestedIndex >= itemCount) {
      trackBoundaryAttempt(
        normalizedFromIndex,
        requestedIndex < normalizedFromIndex ? "backward" : "forward",
        interactionMethod,
        interactionSource,
      );
      scrollToCard(normalizedFromIndex);
      return;
    }

    trackNavigation(
      normalizedFromIndex,
      requestedIndex,
      interactionMethod,
      interactionSource,
    );
    scrollToCard(requestedIndex);
  }, [itemCount, scrollToCard, trackBoundaryAttempt, trackNavigation]);

  const handleArrowKey = useCallback((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
      (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable]")) return;
    event.preventDefault();
    viewportRef.current?.focus({ preventScroll: true });
    const fromIndex = activeIndexRef.current;
    const targetIndex = fromIndex + (event.key === "ArrowRight" ? 1 : -1);
    navigateFromInteraction(fromIndex, targetIndex, "keyboard", "carousel_viewport");
    if (hasMoreDays && targetIndex === dayCardDates.length) {
      viewportRef.current?.querySelector<HTMLButtonElement>(".day-card-load-more")?.focus({ preventScroll: true });
    }
  }, [dayCardDates.length, hasMoreDays, navigateFromInteraction]);

  useEffect(() => {
    const fromIdlePage = (event: KeyboardEvent) => {
      const viewport = viewportRef.current;
      const focused = document.activeElement;
      if (!viewport || viewport.closest("[inert]") || document.querySelector("dialog[open]")) return;
      if (focused !== document.body && focused !== document.documentElement && focused?.id !== "main-content") return;
      handleArrowKey(event);
    };
    document.addEventListener("keydown", fromIdlePage);
    return () => document.removeEventListener("keydown", fromIdlePage);
  }, [handleArrowKey]);

  const updateActiveCard = useCallback((viewport: HTMLDivElement) => {
    if (pendingLoadedIndexRef.current !== null) return;
    const cards = viewport.querySelectorAll<HTMLElement>("[data-carousel-item]");
    const viewportRect = viewport.getBoundingClientRect();
    const closestIndex = getClosestCardIndex(viewport);
    const programmaticTargetIndex = programmaticTargetIndexRef.current;
    if (programmaticTargetIndex !== null) {
      const targetCard = cards.item(programmaticTargetIndex);
      if (!targetCard) return;
      const targetRect = targetCard.getBoundingClientRect();
      if (Math.abs(viewportRect.left - targetRect.left) > 2) return;
      programmaticTargetIndexRef.current = null;
    }
    const closestDate = dayCardDates[closestIndex];
    if (closestDate) {
      setSelectedDateKey(closestDate.dateKey === currentDateKey ? null : closestDate.dateKey);
    } else if (hasMoreDays && closestIndex === dayCardDates.length) {
      setSelectedDateKey("load-more");
    }
  }, [currentDateKey, dayCardDates, hasMoreDays]);

  const updateTodayControlMotion = useCallback((viewport: HTMLDivElement) => {
    const cards = viewport.querySelectorAll<HTMLElement>("[data-day-card]");
    const todayCard = cards.item(todayIndex);
    const tomorrowCard = cards.item(todayIndex + 1);
    if (!todayCard || !tomorrowCard) return;

    const scrollLeft = viewport.scrollLeft;
    const scrollDelta = scrollLeft - previousScrollLeftRef.current;
    if (scrollDelta > 0.25) {
      todayControlDirectionRef.current = "forward";
    } else if (scrollDelta < -0.25) {
      todayControlDirectionRef.current = "backward";
    }
    previousScrollLeftRef.current = scrollLeft;

    const viewportRect = viewport.getBoundingClientRect();
    const todayRect = todayCard.getBoundingClientRect();
    const tomorrowRect = tomorrowCard.getBoundingClientRect();
    const snapDistance = tomorrowRect.left - todayRect.left;
    const rawProgress = snapDistance > 0
      ? Math.min(Math.max(Math.abs(viewportRect.left - todayRect.left) / snapDistance, 0), 1)
      : 0;
    const progress = rawProgress < 0.005
      ? 0
      : rawProgress > 0.995
        ? 1
        : rawProgress;

    onTodayControlMotion({
      direction: todayControlDirectionRef.current,
      progress,
    });
  }, [onTodayControlMotion, todayIndex]);

  const handleScroll = useCallback((event: ReactUIEvent<HTMLDivElement>) => {
    const viewport = event.currentTarget;
    if (scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current);
    }
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      updateTodayControlMotion(viewport);
      updateActiveCard(viewport);
      scrollFrameRef.current = null;
    });
  }, [updateActiveCard, updateTodayControlMotion]);

  const handlePointerDown = useCallback((
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (!event.isPrimary || pointerDragRef.current !== null) return;
    suppressClickRef.current = false;
    if (event.pointerType === "touch") return;
    if (event.target instanceof Element && event.target.closest("button, a")) return;
    if (
      event.button !== 0 ||
      (event.pointerType !== "mouse" && event.pointerType !== "pen")
    ) {
      return;
    }

    if (resizeTimerRef.current !== null) {
      window.clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = null;
    }
    programmaticTargetIndexRef.current = null;
    const startsInOverflowingSchedule = event.target instanceof Element &&
      event.target.closest(".day-card-schedule[data-overflow='true']") !== null;
    pointerDragRef.current = {
      activeIndex: getClosestCardIndex(event.currentTarget),
      axisLock: startsInOverflowingSchedule ? "pending" : "horizontal",
      hasDragged: false,
      pointerId: event.pointerId,
      pointerType: event.pointerType === "pen" ? "pen" : "mouse",
      startScrollLeft: event.currentTarget.scrollLeft,
      startX: event.clientX,
      startY: event.clientY,
    };
    if (startsInOverflowingSchedule) return;

    event.currentTarget.dataset.pointerDragging = "true";
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    event.preventDefault();
  }, []);

  const handlePointerMove = useCallback((
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const drag = pointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (drag.axisLock === "pending") {
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) <= 6) return;
      if (Math.abs(deltaY) >= Math.abs(deltaX)) {
        pointerDragRef.current = null;
        return;
      }

      drag.axisLock = "horizontal";
      event.currentTarget.dataset.pointerDragging = "true";
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.focus({ preventScroll: true });
    }
    if (Math.abs(deltaX) > 3) drag.hasDragged = true;
    event.currentTarget.scrollLeft = drag.startScrollLeft - deltaX;
    event.preventDefault();
  }, []);

  const finishPointerDrag = useCallback((
    event: ReactPointerEvent<HTMLDivElement>,
    suppressClick: boolean,
    trackInteraction: boolean,
  ) => {
    const drag = pointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (drag.axisLock === "pending") {
      pointerDragRef.current = null;
      return;
    }

    const deltaX = event.clientX - drag.startX;
    const destinationIndex = trackInteraction
      ? getClosestCardIndex(event.currentTarget)
      : drag.activeIndex;
    const navigationThreshold = getPointerNavigationThreshold(
      event.currentTarget,
      drag.activeIndex,
    );
    pointerDragRef.current = null;
    delete event.currentTarget.dataset.pointerDragging;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    suppressClickRef.current = suppressClick && drag.hasDragged;
    if (suppressClickRef.current) {
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
    if (trackInteraction && drag.hasDragged) {
      const interactionMethod = drag.pointerType === "pen"
        ? "pen_drag"
        : "mouse_drag";
      if (destinationIndex !== drag.activeIndex) {
        trackNavigation(
          drag.activeIndex,
          destinationIndex,
          interactionMethod,
          "carousel_viewport",
        );
      } else if (
        Math.abs(deltaX) >= navigationThreshold &&
        ((drag.activeIndex === 0 && deltaX > 0) ||
          (drag.activeIndex === itemCount - 1 && deltaX < 0))
      ) {
        trackBoundaryAttempt(
          drag.activeIndex,
          deltaX > 0 ? "backward" : "forward",
          interactionMethod,
          "carousel_viewport",
        );
      }
    }
    scrollToCard(destinationIndex);
  }, [itemCount, scrollToCard, trackBoundaryAttempt, trackNavigation]);

  const handlePointerUp = useCallback((
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.pointerType === "touch") return;
    finishPointerDrag(event, true, true);
  }, [finishPointerDrag]);

  const handleTouchStart = useCallback((
    event: ReactTouchEvent<HTMLDivElement>,
  ) => {
    if (event.touches.length !== 1) {
      swipeStartRef.current = null;
      return;
    }

    const touch = event.touches.item(0);
    if (!touch) return;
    programmaticTargetIndexRef.current = null;
    swipeStartRef.current = {
      activeIndex: getClosestCardIndex(event.currentTarget),
      axisLock: "pending",
      touchId: touch.identifier,
      x: touch.clientX,
      y: touch.clientY,
    };
  }, []);

  const handleTouchMove = useCallback((
    event: ReactTouchEvent<HTMLDivElement>,
  ) => {
    const start = swipeStartRef.current;
    if (!start || start.axisLock !== "pending") return;

    const touch = Array.from(event.touches).find(
      ({ identifier }) => identifier === start.touchId,
    );
    if (!touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) <= 6) return;
    start.axisLock = Math.abs(deltaX) > Math.abs(deltaY)
      ? "horizontal"
      : "vertical";
  }, []);

  const handleTouchEnd = useCallback((
    event: ReactTouchEvent<HTMLDivElement>,
  ) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;
    if (start.axisLock === "vertical") return;

    const touch = Array.from(event.changedTouches).find(
      ({ identifier }) => identifier === start.touchId,
    );
    if (!touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (
      Math.abs(deltaX) < swipeThresholdPixels ||
      Math.abs(deltaX) <= Math.abs(deltaY)
    ) {
      return;
    }

    navigateFromInteraction(
      start.activeIndex,
      start.activeIndex + (deltaX < 0 ? 1 : -1),
      "touch_swipe",
      "carousel_viewport",
    );
  }, [navigateFromInteraction]);

  const handlePointerCancel = useCallback((
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.pointerType === "touch") return;
    finishPointerDrag(event, false, false);
  }, [finishPointerDrag]);

  const handleLostPointerCapture = useCallback((
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    finishPointerDrag(event, false, false);
  }, [finishPointerDrag]);

  useEffect(() => () => {
    if (scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current);
    }
    if (resizeTimerRef.current !== null) {
      window.clearTimeout(resizeTimerRef.current);
    }
  }, []);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || currentDateKey === null) return;
    previousScrollLeftRef.current = viewport.scrollLeft;
    updateTodayControlMotion(viewport);
  }, [currentDateKey, updateTodayControlMotion]);

  useEffect(() => {
    if (
      currentDateKey === null ||
      returnToTodayRequest === handledReturnToTodayRequestRef.current
    ) {
      return;
    }

    handledReturnToTodayRequestRef.current = returnToTodayRequest;
    const fromIndex = clampDayIndex(activeIndexRef.current, itemCount);
    trackNavigation(
      fromIndex,
      todayIndex,
      "date_control",
      "header_date_control",
      "return_to_today",
    );
    scrollToCard(todayIndex);
    viewportRef.current?.focus({ preventScroll: true });
  }, [
    currentDateKey,
    itemCount,
    returnToTodayRequest,
    scrollToCard,
    todayIndex,
    trackNavigation,
  ]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleResize = () => {
      if (pointerDragRef.current !== null) return;
      if (resizeTimerRef.current !== null) {
        window.clearTimeout(resizeTimerRef.current);
      }
      // Native scroll snapping settles after the viewport's resize event.
      // Debounce until the new card widths settle, then restore the selection.
      resizeTimerRef.current = window.setTimeout(() => {
        const targetIndex = activeIndexRef.current;
        programmaticTargetIndexRef.current = targetIndex;
        positionViewport(targetIndex, "auto");
        updateTodayControlMotion(viewport);
        resizeTimerRef.current = null;
      }, 100);
    };
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, [currentDateKey, positionViewport, updateTodayControlMotion]);

  useLayoutEffect(() => {
    if (currentDateKey === null || previousCurrentDateKeyRef.current === currentDateKey) return;
    previousCurrentDateKeyRef.current = currentDateKey;
    // Position Today before paint on first hydration; preserve a browsed date at midnight.
    activeIndexRef.current = activeIndex;
    programmaticTargetIndexRef.current = activeIndex;
    positionViewport(activeIndex, "instant");
    if (viewportRef.current) updateTodayControlMotion(viewportRef.current);
  }, [activeIndex, currentDateKey, positionViewport, updateTodayControlMotion]);

  const loadMoreDays = () => {
    if (!hasMoreDays || currentDateKey === null) return;
    if (scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = null;
    }
    const nextCount = visibleUpcomingDayCount + dayCardCount;
    const firstNewDay = getDayCardDates(currentDateKey, nextCount)[visibleUpcomingDayCount];
    pendingLoadedIndexRef.current = visibleDayCount;
    activeIndexRef.current = visibleDayCount;
    programmaticTargetIndexRef.current = visibleDayCount;
    setSelectedDateKey(firstNewDay.dateKey);
    setVisibleUpcomingDayCount(nextCount);
    trackGoogleAnalyticsEvent("carousel_load_more", {
      added_day_count: dayCardCount,
      location_id: locationId,
      visible_day_count: nextCount + 1,
    });
  };

  useLayoutEffect(() => {
    const nextIndex = pendingLoadedIndexRef.current;
    if (nextIndex === null) return;
    pendingLoadedIndexRef.current = null;
    positionViewport(nextIndex, "instant");
    viewportRef.current?.focus({ preventScroll: true });
    if (viewportRef.current) updateTodayControlMotion(viewportRef.current);
  }, [positionViewport, updateTodayControlMotion, visibleDayCount]);

  if (currentDateKey === null) {
    return (
      <section
        className="day-carousel"
        aria-label="Daily schedule"
        aria-busy="true"
        aria-roledescription="carousel"
      >
        <div className="day-carousel-loading-frame">
          <Card className="day-card day-card-loading">
            <div className="day-card-heading" aria-hidden="true" />
            <p className="day-card-message" role="status">
              Loading today&apos;s schedule…
            </p>
          </Card>
        </div>
      </section>
    );
  }

  const activeDay = dayCardDates[activeIndex];

  return (
    <section
      className="day-carousel"
      aria-label="Daily schedule"
      aria-busy="false"
      aria-roledescription="carousel"
      data-active-index={activeIndex}
      onKeyDown={(event) => handleArrowKey(event.nativeEvent)}
    >
      <div className="day-carousel-shell">
        <button
          className="day-carousel-arrow day-carousel-arrow-previous"
          type="button"
          aria-controls="day-card-carousel-viewport"
          aria-label="Previous day"
          disabled={activeIndex === 0}
          onClick={(event) => {
            const fromIndex = activeIndexRef.current;
            navigateFromInteraction(
              fromIndex,
              fromIndex - 1,
              "arrow",
              "previous_arrow",
            );
            if (fromIndex === 1 && event.detail === 0) {
              viewportRef.current?.focus({ preventScroll: true });
            }
          }}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <div
          className="day-carousel-viewport"
          id="day-card-carousel-viewport"
          ref={viewportRef}
          role="group"
          aria-label="Day cards"
          tabIndex={0}
          onClickCapture={(event) => {
            if (!suppressClickRef.current) return;
            suppressClickRef.current = false;
            event.preventDefault();
            event.stopPropagation();
          }}
          onLostPointerCapture={handleLostPointerCapture}
          onPointerCancel={handlePointerCancel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onTouchCancel={() => {
            swipeStartRef.current = null;
          }}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          onTouchStart={handleTouchStart}
          onWheel={() => {
            programmaticTargetIndexRef.current = null;
          }}
          onScroll={handleScroll}
        >
          <div className="day-carousel-track">
            {dayCardDates.map(({ dateKey, relativeLabel }, index) => (
              <DayCard
                agenda={agenda}
                dateKey={dateKey}
                index={index}
                isActive={activeIndex === index}
                key={dateKey}
                relativeLabel={relativeLabel}
              />
            ))}
            {hasMoreDays ? (
              <Card
                as="button"
                type="button"
                borderless
                className="day-card day-card-more day-card-load-more"
                data-active={activeIndex === dayCardDates.length}
                data-carousel-item=""
                id="day-card-load-more"
                onClick={loadMoreDays}
              >
                <span className="day-card-load-more-label">Load seven more days</span>
              </Card>
            ) : null}
          </div>
        </div>
        <button
          className="day-carousel-arrow day-carousel-arrow-next"
          type="button"
          aria-controls="day-card-carousel-viewport"
          aria-label="Next day"
          disabled={activeIndex === itemCount - 1}
          onClick={(event) => {
            const fromIndex = activeIndexRef.current;
            navigateFromInteraction(
              fromIndex,
              fromIndex + 1,
              "arrow",
              "next_arrow",
            );
            if (fromIndex === itemCount - 2 && event.detail === 0) {
              const target = hasMoreDays
                ? viewportRef.current?.querySelector<HTMLButtonElement>(".day-card-load-more")
                : viewportRef.current;
              target?.focus({ preventScroll: true });
            }
          }}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>

      <div className="day-carousel-pagination" role="group" aria-label="Choose a day">
        {dayCardDates.map(({ dateKey, relativeLabel }, index) => (
          <button
            className="day-carousel-dot"
            type="button"
            aria-controls={`day-card-${dateKey}`}
            aria-current={activeIndex === index ? true : undefined}
            aria-label={`Go to ${relativeLabel}`}
            data-day-index={index}
            key={dateKey}
            onClick={() => navigateFromInteraction(
              activeIndexRef.current,
              index,
              "dot",
              "pagination_dot",
            )}
          >
            <span aria-hidden="true" />
          </button>
        ))}
        {hasMoreDays ? (
          <button
            className="day-carousel-dot day-carousel-more-dot"
            type="button"
            aria-controls="day-card-load-more"
            aria-current={activeIndex === dayCardDates.length ? true : undefined}
            aria-label="Go to load more days"
            onClick={() => navigateFromInteraction(activeIndexRef.current, dayCardDates.length, "dot", "pagination_dot")}
          ><span aria-hidden="true" /></button>
        ) : null}
      </div>

      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {activeDay
          ? `Showing ${activeDay.relativeLabel}, day ${activeIndex + 1} of ${visibleDayCount}.`
          : `Load seven more days. ${visibleDayCount} days currently loaded.`}
      </p>

      {agenda.failedSourceCount > 0 && !hasNoAvailableSources ? (
        <p className="day-carousel-note" role="status">
          Some calendar sources could not be checked during the latest update.
        </p>
      ) : null}
      {hasNoAvailableSources || hasNoAvailableDates ? (
        <p className="day-carousel-note" role="status">
          Schedules are temporarily unavailable. The full calendar is still available below.
        </p>
      ) : null}
      {children}
    </section>
  );
}

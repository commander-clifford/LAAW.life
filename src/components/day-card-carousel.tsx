"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
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

function clampDayIndex(index: number): number {
  return Math.min(Math.max(index, 0), dayCardCount - 1);
}

function getClosestCardIndex(viewport: HTMLDivElement): number {
  const cards = viewport.querySelectorAll<HTMLElement>("[data-day-card]");
  const viewportRect = viewport.getBoundingClientRect();
  const viewportCenter = viewportRect.left + viewportRect.width / 2;
  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  cards.forEach((card, index) => {
    const cardRect = card.getBoundingClientRect();
    const cardCenter = cardRect.left + cardRect.width / 2;
    const distance = Math.abs(viewportCenter - cardCenter);
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
  const cards = viewport.querySelectorAll<HTMLElement>("[data-day-card]");
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
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const dayCardDates = useMemo(
    () => currentDateKey === null ? [] : getDayCardDates(currentDateKey),
    [currentDateKey],
  );
  const selectedIndex = dayCardDates.findIndex(
    ({ dateKey }) => dateKey === selectedDateKey,
  );
  const activeIndex = Math.max(selectedIndex, 0);
  const hasNoAvailableSources =
    agenda.sourceCount > 0 &&
    agenda.failedSourceCount === agenda.sourceCount;
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

    const nextIndex = clampDayIndex(requestedIndex);
    const cards = viewport.querySelectorAll<HTMLElement>("[data-day-card]");
    const nextCard = cards.item(nextIndex);
    if (!nextCard) return;

    const viewportRect = viewport.getBoundingClientRect();
    const cardRect = nextCard.getBoundingClientRect();
    const centerDelta =
      cardRect.left + cardRect.width / 2 -
      (viewportRect.left + viewportRect.width / 2);

    viewport.scrollTo({
      behavior,
      left: viewport.scrollLeft + centerDelta,
    });
  }, []);

  const scrollToCard = useCallback((requestedIndex: number) => {
    const nextIndex = clampDayIndex(requestedIndex);
    const nextDate = dayCardDates[nextIndex];
    if (!nextDate) return;

    if (resizeTimerRef.current !== null) {
      window.clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = null;
    }
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    activeIndexRef.current = nextIndex;
    programmaticTargetIndexRef.current = nextIndex;
    setSelectedDateKey(nextDate.dateKey);
    positionViewport(nextIndex, reduceMotion ? "auto" : "smooth");
  }, [dayCardDates, positionViewport]);

  const trackNavigation = useCallback((
    fromIndex: number,
    toIndex: number,
    interactionMethod: CarouselInteractionMethod,
    interactionSource: string,
    resultingAction?: "return_to_today",
  ) => {
    const fromDay = dayCardDates[clampDayIndex(fromIndex)];
    const toDay = dayCardDates[clampDayIndex(toIndex)];
    if (!fromDay || !toDay) return;

    trackGoogleAnalyticsEvent("carousel_navigation", {
      direction: toIndex === fromIndex
        ? "same"
        : toIndex > fromIndex
          ? "forward"
          : "backward",
      from_date: fromDay.dateKey,
      from_index: fromIndex,
      from_relative_label: fromDay.relativeLabel,
      interaction_method: interactionMethod,
      interaction_source: interactionSource,
      location_id: locationId,
      ...(resultingAction === undefined
        ? {}
        : {
            displayed_date: fromDay.dateKey,
            displayed_day: fromDay.relativeLabel,
            resulting_action: resultingAction,
          }),
      to_date: toDay.dateKey,
      to_index: toIndex,
      to_relative_label: toDay.relativeLabel,
      visible_day_count: dayCardCount,
    });
  }, [dayCardDates, locationId]);

  const trackBoundaryAttempt = useCallback((
    currentIndex: number,
    attemptedDirection: "backward" | "forward",
    interactionMethod: CarouselInteractionMethod,
    interactionSource: string,
  ) => {
    const currentDay = dayCardDates[clampDayIndex(currentIndex)];
    if (!currentDay) return;

    trackGoogleAnalyticsEvent("carousel_boundary_attempt", {
      attempted_direction: attemptedDirection,
      boundary: attemptedDirection === "backward" ? "start" : "end",
      current_date: currentDay.dateKey,
      current_index: currentIndex,
      current_relative_label: currentDay.relativeLabel,
      interaction_method: interactionMethod,
      interaction_source: interactionSource,
      location_id: locationId,
      visible_day_count: dayCardCount,
    });
  }, [dayCardDates, locationId]);

  const navigateFromInteraction = useCallback((
    fromIndex: number,
    requestedIndex: number,
    interactionMethod: CarouselInteractionMethod,
    interactionSource: string,
  ) => {
    const normalizedFromIndex = clampDayIndex(fromIndex);
    if (requestedIndex < 0 || requestedIndex >= dayCardCount) {
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
  }, [scrollToCard, trackBoundaryAttempt, trackNavigation]);

  const updateActiveCard = useCallback((viewport: HTMLDivElement) => {
    const cards = viewport.querySelectorAll<HTMLElement>("[data-day-card]");
    const viewportRect = viewport.getBoundingClientRect();
    const viewportCenter = viewportRect.left + viewportRect.width / 2;
    const closestIndex = getClosestCardIndex(viewport);
    const programmaticTargetIndex = programmaticTargetIndexRef.current;
    if (programmaticTargetIndex !== null) {
      const targetCard = cards.item(programmaticTargetIndex);
      const targetRect = targetCard.getBoundingClientRect();
      const targetCenter = targetRect.left + targetRect.width / 2;
      if (Math.abs(viewportCenter - targetCenter) > 2) return;
      programmaticTargetIndexRef.current = null;
    }
    const closestDate = dayCardDates[closestIndex];
    if (closestDate) {
      setSelectedDateKey(closestDate.dateKey);
    }
  }, [dayCardDates]);

  const updateTodayControlMotion = useCallback((viewport: HTMLDivElement) => {
    const cards = viewport.querySelectorAll<HTMLElement>("[data-day-card]");
    const todayCard = cards.item(0);
    const tomorrowCard = cards.item(1);
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
    const viewportCenter = viewportRect.left + viewportRect.width / 2;
    const todayCenter = todayRect.left + todayRect.width / 2;
    const tomorrowCenter = tomorrowRect.left + tomorrowRect.width / 2;
    const snapDistance = tomorrowCenter - todayCenter;
    const rawProgress = snapDistance > 0
      ? Math.min(Math.max((viewportCenter - todayCenter) / snapDistance, 0), 1)
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
  }, [onTodayControlMotion]);

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
          (drag.activeIndex === dayCardCount - 1 && deltaX < 0))
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
  }, [scrollToCard, trackBoundaryAttempt, trackNavigation]);

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
    const fromIndex = clampDayIndex(activeIndexRef.current);
    trackNavigation(
      fromIndex,
      0,
      "date_control",
      "header_date_control",
      "return_to_today",
    );
    scrollToCard(0);
  }, [
    currentDateKey,
    returnToTodayRequest,
    scrollToCard,
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

  useEffect(() => {
    if (currentDateKey === null) return;
    const previousDateKey = previousCurrentDateKeyRef.current;
    previousCurrentDateKeyRef.current = currentDateKey;
    if (previousDateKey === null || previousDateKey === currentDateKey) return;

    positionViewport(activeIndex, "auto");
  }, [activeIndex, currentDateKey, positionViewport]);

  if (currentDateKey === null) {
    return (
      <section
        className="day-carousel"
        aria-label="Seven-day schedule"
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
      aria-label="Seven-day schedule"
      aria-busy="false"
      aria-roledescription="carousel"
      data-active-index={activeIndex}
    >
      <div className="day-carousel-shell">
        <button
          className="day-carousel-arrow day-carousel-arrow-previous"
          type="button"
          aria-controls="day-card-carousel-viewport"
          aria-label="Previous day"
          disabled={activeIndex === 0}
          onClick={() => {
            const fromIndex = activeIndexRef.current;
            navigateFromInteraction(
              fromIndex,
              fromIndex - 1,
              "arrow",
              "previous_arrow",
            );
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
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              const fromIndex = activeIndexRef.current;
              navigateFromInteraction(
                fromIndex,
                fromIndex - 1,
                "keyboard",
                "carousel_viewport",
              );
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              const fromIndex = activeIndexRef.current;
              navigateFromInteraction(
                fromIndex,
                fromIndex + 1,
                "keyboard",
                "carousel_viewport",
              );
            }
          }}
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
          </div>
        </div>
        <button
          className="day-carousel-arrow day-carousel-arrow-next"
          type="button"
          aria-controls="day-card-carousel-viewport"
          aria-label="Next day"
          disabled={activeIndex === dayCardCount - 1}
          onClick={() => {
            const fromIndex = activeIndexRef.current;
            navigateFromInteraction(
              fromIndex,
              fromIndex + 1,
              "arrow",
              "next_arrow",
            );
          }}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>

      <div className="day-carousel-pagination" aria-label="Choose a day">
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
      </div>

      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        Showing {activeDay.relativeLabel}, day {activeIndex + 1} of {dayCardCount}.
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

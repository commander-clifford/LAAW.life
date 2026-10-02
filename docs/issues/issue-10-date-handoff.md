# Issue #10: opt-in date-handoff prototype

Preview `ivy/?dateHandoff=shared` or `hawthorne/?dateHandoff=shared`. Ordinary URLs retain the current date motion. This is a separate design prototype requiring visual approval before release.

An aria-hidden clone of the calendar date moves from the Today card to the existing header/container edge as physical carousel progress changes. The weekday remains separate; Today labeling and event content are unchanged. The in-card date is visible at the starting position, the clone during travel, and the header date at the endpoint. Reversing navigation reverses the handoff. Existing accessible dates and the carousel's single live announcement remain in place; the clone is excluded from accessibility.

Reduced motion switches between the original and destination at the midpoint without a moving clone. Reduced-motion touch uses immediate swipe-end navigation instead of a competing native horizontal fling; vertical page/event scrolling and zoom remain available. No temporary scrolling lock or delayed return is used.

Validation: lint, type checks, 67 application tests, production static build (41 files), and the full Chromium suite. Dedicated 393/1280px normal/reduced scenarios cover midway clipping/visibility, forward/reverse keyboard navigation, dots, arrows, mouse and pen drag, touch swipe, responsive resize, and Return to Today.

Review the progress-linked motion in both directions and compare it with the ordinary URL. Screen-reader announcement quality and the final visual direction still require human review. This branch does not ship the prototype as the default.

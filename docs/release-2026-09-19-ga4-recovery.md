# Restore GA4 in the September 19 production build

The September 16 deployment collected visits in GA4 Realtime. By September 19,
the live site had a newer visual build whose HTML no longer loaded the GA tag.
The production source still included the GA component; the measurement ID had
only been set in the original developer's ignored `.env.local`. A new build
without that local file therefore omitted analytics.

The fix versions the public measurement ID in `.env.production`, which Next.js
loads for production builds, and exempts that file from the blanket env-file
ignore rule. It remains guarded to the production domain. A `location_switch`
event now records a deliberate menu selection of the other location, with
source and destination slugs. Normal page views remain automatic and unchanged.

The site code and design come from current `origin/main`. The latest-source
production export built successfully and includes the measurement ID on the
home, Ivy Station, and Hawthorne pages. HostGator upload and live Realtime
confirmation are pending.

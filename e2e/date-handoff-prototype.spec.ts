import { expect, test } from "@playwright/test";

for (const width of [393, 1280]) {
  for (const reduced of [false, true]) {
    test(`date handoff is reversible at ${width}px, reduced motion ${reduced}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
      await page.goto("ivy/?dateHandoff=shared");
      const carousel = page.locator(".day-carousel");
      await expect(carousel).toHaveAttribute("aria-busy", "false");
      const layer = page.locator(".date-handoff-layer");
      const clone = layer.locator(".date-handoff-clone");
      const source = page.locator('[data-day-index="0"] .day-card-calendar-date');
      await expect(layer).toHaveAttribute("aria-hidden", "true");
      await expect(layer).toHaveAttribute("data-progress", "0");
      await expect(source).toHaveCSS("visibility", "visible");
      const viewport = page.locator(".day-carousel-viewport");
      await viewport.evaluate(element => {
        const cards = element.querySelectorAll('[data-day-card]');
        const step = cards[1].getBoundingClientRect().left - cards[0].getBoundingClientRect().left;
        (element as HTMLElement).style.scrollSnapType = 'none'; element.scrollLeft = step * .5;
      });
      await expect.poll(async () => Number(await layer.getAttribute('data-progress'))).toBeGreaterThan(.49);
      await expect.poll(async () => Number(await layer.getAttribute('data-progress'))).toBeLessThan(.51);
      if (reduced) {
        await expect(clone).toBeHidden();
      } else {
        await expect(clone).toHaveCSS('opacity', '1');
        await expect(source).toHaveCSS('visibility', 'hidden');
        await expect(page.locator('.location-today-calendar-date')).toHaveCSS('visibility', 'hidden');
        const stage = await layer.boundingBox(); const visual = await clone.boundingBox();
        expect(visual!.x).toBeGreaterThanOrEqual(stage!.x - 1);
        expect(visual!.x + visual!.width).toBeLessThanOrEqual(stage!.x + stage!.width + 1);
      }
      await viewport.evaluate(element => { element.scrollLeft = 0; (element as HTMLElement).style.removeProperty('scroll-snap-type'); });
      await expect(layer).toHaveAttribute('data-progress', '0');
      await expect(source).toHaveCSS('visibility', 'visible');
      await page.getByRole('button', { name: 'Go to Tomorrow', exact: true }).click();
      await expect(carousel).toHaveAttribute('data-active-index', '1');
      await expect(layer).toHaveAttribute('data-progress', '1');
      await expect(page.locator('.location-today-calendar-date')).toHaveCSS('visibility', 'visible');
      await page.getByRole('button', { name: /^Return to Today/ }).click();
      await expect(carousel).toHaveAttribute('data-active-index', '0');
      await expect(layer).toHaveAttribute('data-progress', '0');
      await viewport.focus(); await page.keyboard.press('ArrowRight');
      await expect(carousel).toHaveAttribute('data-active-index', '1');
      await page.keyboard.press('ArrowLeft');
      await expect(carousel).toHaveAttribute('data-active-index', '0');
      if (width === 1280) {
        await page.getByRole('button', { name: 'Next day', exact: true }).click();
        await expect(layer).toHaveAttribute('data-progress', '1');
        await page.getByRole('button', { name: 'Previous day', exact: true }).click();
        await expect(layer).toHaveAttribute('data-progress', '0');
        const box = (await viewport.boundingBox())!;
        await page.mouse.move(box.x + box.width * .75, box.y + 80); await page.mouse.down();
        await page.mouse.move(box.x + box.width * .1, box.y + 80, { steps: 8 }); await page.mouse.up();
        await expect(carousel).toHaveAttribute('data-active-index', '1');
        await page.getByRole('button', { name: /^Return to Today/ }).click();
        await expect(layer).toHaveAttribute('data-progress', '0');
        const pen = await page.context().newCDPSession(page);
        const startX = box.x + box.width * .75;
        const endX = box.x + box.width * .1;
        await pen.send('Input.dispatchMouseEvent', { type: 'mouseMoved', pointerType: 'pen', button: 'none', buttons: 0, x: startX, y: box.y + 80 });
        await pen.send('Input.dispatchMouseEvent', { type: 'mousePressed', pointerType: 'pen', button: 'left', buttons: 1, clickCount: 1, x: startX, y: box.y + 80 });
        for (let step = 1; step <= 6; step++) {
          await pen.send('Input.dispatchMouseEvent', { type: 'mouseMoved', pointerType: 'pen', button: 'none', buttons: 1, x: startX + (endX - startX) * step / 6, y: box.y + 80 });
        }
        await pen.send('Input.dispatchMouseEvent', { type: 'mouseReleased', pointerType: 'pen', button: 'left', buttons: 0, clickCount: 1, x: endX, y: box.y + 80 });
        await pen.detach();
        await expect(carousel).toHaveAttribute('data-active-index', '1');
        await expect(layer).toHaveAttribute('data-progress', '1');
        await page.getByRole('button', { name: /^Return to Today/ }).click();
      } else {
        const box = (await viewport.boundingBox())!;
        const session = await page.context().newCDPSession(page);
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width * .8, y: box.y + 80 }] });
        for (let step = 1; step <= 4; step++) {
          await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width * (.8 - .6 * step / 4), y: box.y + 80 }] });
          if (!reduced && step === 2) {
            await expect.poll(async () => Number(await layer.getAttribute('data-progress'))).toBeGreaterThan(.1);
            await expect.poll(async () => Number(await layer.getAttribute('data-progress'))).toBeLessThan(.9);
            await expect(clone).toHaveCSS('opacity', '1');
          }
        }
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await session.detach();
        await page.waitForTimeout(150);
        await expect(carousel).toHaveAttribute('data-active-index', '1');
        await page.getByRole('button', { name: /^Return to Today/ }).click();
      }
      await expect(layer).toHaveAttribute('data-progress', '0');
      await page.setViewportSize({ width: width === 393 ? 1280 : 393, height: 900 });
      await expect(source).toHaveCSS('visibility', 'visible');
      await expect(layer).toHaveAttribute('data-progress', '0');
      await expect(carousel).toHaveAttribute('data-active-index', '0');
    });
  }
}

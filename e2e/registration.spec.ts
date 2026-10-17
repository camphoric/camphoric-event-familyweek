import { expect, test, type RegistrationForm } from '@camphoric/camphoric-event-import-tools/e2e';

import event from '../index.ts';

// The registration form, as a registrant fills it in. Every test shares the one
// imported event (see README.md), so a completed registration stays.

// Ages count from the start of camp; a camper with no date of birth is an adult.
// A date of birth for someone this old when camp starts (a month past the
// birthday, so camp's start date can move a little without changing it)
function born(age: number) {
  const date = new Date(event.data.event.start ?? '');
  date.setUTCFullYear(date.getUTCFullYear() - age);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 10);
}

async function addCampers(registration: RegistrationForm, campers: [string, string, string?][]) {
  for (const [i, [first, last, birthdate]] of campers.entries()) {
    const camper = i === 0 ? registration.camper(1) : await registration.addCamper();
    await camper.fill('First Name', first);
    await camper.fill('Last Name', last);
    if (birthdate) await camper.fill('Date of Birth (if under 18)', birthdate);
  }
}

test('the form opens', async ({ page, registration }) => {
  await registration.open();
  await expect(page.getByRole('heading', { name: 'Welcome to BACDS Family Week\'s Online Registration!' })).toBeVisible();
});

// On a phone the rates table (six columns) is wider than the screen, and so is
// the whole page, so a tap can land on the wrong control. Expected to fail on
// mobile until the Camphoric client fits wide tables to the screen; once this
// passes there (failing the run as an unexpected pass), remove this
// annotation and the WIDE_RATES_TABLE ones below.
const WIDE_RATES_TABLE = 'the rates table is wider than a phone, so the page is too';

test('the form fits the screen\'s width', async ({ page, registration, isMobile }) => {
  test.fail(isMobile, WIDE_RATES_TABLE);
  await registration.open();
  // (A string: this repository's TypeScript has no DOM types)
  const [scrollWidth, clientWidth] = await page.evaluate<number[]>(
    '[document.documentElement.scrollWidth, document.documentElement.clientWidth]');
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});

// From the rates table: $900 for the first adult and $800 for each other
// adult, then $700 (13-16), $600 (6-12), $250 (2-5) and $0 (0-1).
test('a family is priced by age', async ({ registration }) => {
  await registration.open();
  await addCampers(registration, [
    ['Pat', 'Example'],
    ['Sam', 'Example'],
    ['Teen', 'Example', born(14)],
    ['Kid', 'Example', born(9)],
    ['Small', 'Example', born(4)],
    ['Baby', 'Example', born(0)],
  ]);
  await registration.expectTotal(900 + 800 + 700 + 600 + 250 + 0);
});

// Work trade takes $250 off the first adult and $200 off a teen
test('a work trade reduces the fee', async ({ registration }) => {
  await registration.open();
  await addCampers(registration, [['Pat', 'Example'], ['Teen', 'Example', born(14)]]);
  await registration.expectTotal(900 + 700);
  await registration.camper(1).check('I need a work trade discount');
  await registration.camper(2).check('I need a work trade discount');
  await registration.expectTotal(900 - 250 + 700 - 200);
});

test('a donation is added to the total', async ({ registration }) => {
  await registration.open();
  await addCampers(registration, [['Pat', 'Example']]);
  await registration.fill('Family Week Donation', '50');
  await registration.expectTotal(950);
});

test('a registration missing required answers isn\'t submitted', async ({ page, registration, isMobile }) => {
  test.fixme(isMobile, WIDE_RATES_TABLE);
  await registration.open();
  await registration.submit();
  await expect(registration.field('Street Address')).toHaveJSProperty('validity.valueMissing', true);
  await expect(page).toHaveURL(/\/register\/registration$/);
});

test('a registration goes through, paying by check', async ({ page, registration, isMobile }) => {
  test.fixme(isMobile, WIDE_RATES_TABLE);
  await registration.open();
  await registration.fill('Registrant email', 'pat@example.com');
  await registration.fill('Street Address', '1 Example Way');
  await registration.fill('City', 'Exampleton');
  await registration.fill('State or Province', 'CA');
  await registration.fill('ZIP Code or Postal Code', '94000');
  await registration.fill('Primary Phone Number', '+1 555 123 5678');
  await addCampers(registration, [['Pat', 'Example']]);
  await registration.expectTotal(900);

  await registration.submit();
  await registration.expectPaymentStep();
  await registration.payByCheck();
  await expect(page).toHaveURL(/\/register\/finished$/);
});

// Next, the behaviour particular to this camp:
test.fixme('a talent or management registration type changes the rates', () => {});
test.fixme('a meal type and dietary needs can be given for each camper', () => {});
test.fixme('the ride-sharing seats question only matters when offering a ride', () => {});

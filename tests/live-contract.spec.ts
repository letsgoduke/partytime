import { test, expect } from "@playwright/test";
// This suite exercises the browser against the real PostgREST wire shape. It does
// not replace hosted Supabase/Auth acceptance tests; SQL security is tested separately.
const privateToken = "a".repeat(64);
const invitation = "b".repeat(64);
const party = {
  id: "live-fixture",
  title: "A gathering with friends",
  hostName: "Casey",
  startsAt: "2026-10-30T23:00:00Z",
  generalLocation: "Austin",
  address: null,
  description: "Bring yourself. Contributions are optional.",
  budgetCents: 30000,
  confirmedCents: 0,
  pendingCents: 0,
  going: 1,
  maybe: 0,
  declined: 0,
  status: "published",
  rsvpsOpen: true,
  needs: [
    { id: "ice", title: "Ice", kind: "item", quantity: 1, claimedQuantity: 0 },
  ],
  paymentMethods: [],
  updates: [],
};
// Enable only for the separate configured build/dev command, so demo testing
// never accidentally claims that external integrations were exercised.
test("guest capability stays private when sharing an invitation", async ({
  page,
}) => {
  test.skip(
    !process.env.TEST_LIVE_CONTRACT,
    "Run npm run test:contract for the configured API adapter.",
  );
  await page.route(
    "https://contract.supabase.co/rest/v1/rpc/party_api",
    async (route) => {
      const { action } = route.request().postDataJSON();
      const data =
        action === "invitation"
          ? party
          : action === "rsvp"
            ? {
                guest: { id: "g42", name: "Casey", status: "going" },
                managementToken: privateToken,
                party: { ...party, address: "Private address" },
              }
            : action === "guest"
              ? {
                  party: { ...party, address: "Private address" },
                  guest: { id: "g42", name: "Casey", status: "going" },
                  claims: [],
                  pledges: [
                    { id: "p42", amountCents: 2000, status: "pledged" },
                  ],
                }
              : { ok: true };
      await route.fulfill({ json: data });
    },
  );
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(`/invite/${invitation}`);
  await page
    .getByRole("button", { name: "I’m coming", exact: true })
    .first()
    .click();
  await page.getByLabel("Your name").fill("Casey");
  await page.getByRole("button", { name: "Save my RSVP" }).click();
  await page.getByRole("button", { name: "Copy invitation link" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    `/invite/${invitation}`,
  );
  expect(
    await page.evaluate(() => navigator.clipboard.readText()),
  ).not.toContain(privateToken);
  await page.getByRole("button", { name: "Manage my commitments" }).click();
  await expect(page.getByText("$20 · pledged")).toBeVisible();
  await page
    .getByRole("button", { name: "Copy private management link" })
    .click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    `/manage#${privateToken}`,
  );
});

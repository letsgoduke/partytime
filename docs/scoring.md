# Money and social scores

All cash and appraised supply values are integer cents. Budget summaries count only confirmed cash against the cash target. Pending pledges and in-kind value remain separate; disputed and canceled pledges count toward neither received nor pending totals. Covering the remaining balance snapshots the current cash gap.

`src/domain` contains deterministic calculations and tests. These helpers also support previews; trusted database operations must independently authorize and verify the underlying records. A client preview never authorizes an award or verifies payment.

## Reputation

Reputation is a weighted fulfillment rate, not accumulated points. Attendance, cash, supplies, and volunteer work have configurable weights (1, 1, 1, 1). Verified fulfilled and failed activities count; excused cancellations and unverified records are neutral. Five verified activities are required before a numeric score appears. Each weight decays with a 180-day half-life. A Bayesian prior of four activities at 50% reliability moderates small samples and isolated failures. Scores round to one decimal place. Defaults match the SQL `scoring_rules` table and `refresh_scores` function. Confidence is effective evidence weight divided by evidence weight plus prior weight. Corrections require recalculation from the verified evidence history.

## Prestige

Verified community gifts award one point per dollar of cash or appraised supplies and 15 points per volunteer hour. Self contributions earn none. Duplicate activity or expense references are rejected; award generation must use canonical expense identifiers. Default per-activity credit is capped at 1,000 points. Titles begin at 100 (Contributor), 500 (Supporter), 2,000 (Patron), and 10,000 (Benefactor). Monetary amounts remain private even when a profile's score is public.

## Aura

Completed, verified, non-canceled events earn `round(10√attendees + 2√community dollars + 3√in-kind dollars)`. Only distinct linked profiles other than the host with both host-confirmed and guest-attested attendance count. Two distinct verified community participants must independently verify participation. Pending payments, unlinked contributors, and host funding must be removed at the server boundary. The rounded base award is capped at 500. It is then divided by `sqrt(1 + previous host awards in the last 30 days)` and rounded again; trusted server history determines that count. This applies even across changing groups. Completed volunteer assistance contributes through independently verified participation; the starting formula assigns no separate cash value to labor.

## Audit and reversals

The append-only ledger references the canonical verified activity, profile, and score system. Uniqueness prevents repeat awards. Corrections append an exact negative reversal referencing its original award; a reversal cannot itself be reversed or applied twice. Corrected underlying activities can use a new versioned activity reference after audit. Cached totals are derived from ledger entries, never submitted by clients. Reliability disputes amend verified evidence through authorized review and trigger recalculation, without hosts editing score totals.

Claim availability includes active and fulfilled reservations, excludes released or failed claims, and must be checked in an atomic transaction under a row lock. RSVP capacity must likewise be enforced server-side in the transaction that changes a guest to Going.

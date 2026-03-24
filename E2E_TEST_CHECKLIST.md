# DealBuddy PWA - E2E Test Checklist

**App URL:** https://app.deal-buddy.app
**Date:** 2026-03-24
**Tester:** _______________
**Device / Browser:** _______________
**OS Version:** _______________

---

## Flow 1: Onboarding

### Step 1: Open App as New User
- **What:** Open https://app.deal-buddy.app in a fresh browser (incognito/private mode, no existing session)
- **Expected:** Onboarding/welcome screen is displayed. No access to main app content before completing onboarding.
- **Fallback:** Clear all cookies/storage for the domain. Check if a session token exists in localStorage or cookies that skips onboarding. Verify the route redirects unauthenticated users.
- **Status:** ⬜ Not tested

### Step 2: Register with Email/Phone
- **What:** Complete the registration form using a valid email address or phone number, set a password
- **Expected:** Account is created successfully. Confirmation email/SMS is sent if applicable. User proceeds to the next onboarding step without errors.
- **Fallback:** Check network tab for API errors (4xx/5xx). Verify Supabase Auth or backend auth service is reachable. Check if email/phone validation regex is too strict or too loose.
- **Status:** ⬜ Not tested

### Step 3: Confirm Age (18+)
- **What:** Select or confirm date of birth / age gate confirming user is 18 years or older
- **Expected:** Age confirmation is accepted. User proceeds to avatar DNA step. If under 18 is entered, registration is blocked with a clear message.
- **Fallback:** Check if the age gate component renders correctly. Verify the date picker or age input accepts valid formats. Test boundary: exactly 18 years old today.
- **Status:** ⬜ Not tested

### Step 4: Choose Avatar DNA (Gender, Age, Origin, Hair)
- **What:** Select avatar DNA attributes: gender, age range, origin, and hair style/color
- **Expected:** All selection options load and are interactive. Selections are visually highlighted. A preview of the resulting avatar/card updates in real time. Selections are persisted when moving forward.
- **Fallback:** Check if avatar asset images load (network tab for 404s). Verify the DNA state is saved to the backend after submission. Check for console errors during rendering.
- **Status:** ⬜ Not tested

### Step 5: Receive Starter Card (Bronze, Matching DNA)
- **What:** Complete avatar DNA selection and proceed
- **Expected:** A bronze starter Battle Card is generated that matches the selected DNA attributes (correct gender, age, origin, hair). A card reveal animation plays. The card is saved to the user's inventory.
- **Fallback:** Check the card generation API response for correct DNA mapping. Verify the card rarity is "bronze". Check if the card image/assets load correctly. Query the database/API for the user's card inventory.
- **Status:** ⬜ Not tested

### Step 6: See Profile with Battle Card
- **What:** Navigate to the user profile screen after onboarding completion
- **Expected:** Profile displays the user's name/username, avatar, and the equipped bronze starter Battle Card. Card shows correct DNA attributes. All profile sections are accessible.
- **Fallback:** Check if the profile API returns the correct user data and card assignment. Verify the card component renders without errors. Check that the card image URL resolves.
- **Status:** ⬜ Not tested

---

## Flow 2: Core Deal Loop

### Step 7: Create a New Deal (Title, Stake, Opponent)
- **What:** Navigate to "Create Deal". Enter a deal title, set the stake (coins), and select or invite an opponent
- **Expected:** Deal form validates all required fields. Opponent can be selected from friends list or invited by username/code. Deal is created and appears in the user's active deals list with status "pending".
- **Fallback:** Check API response for deal creation endpoint. Verify form validation messages appear for missing fields. Check if the opponent search/autocomplete works. Confirm the deal appears in the database.
- **Status:** ⬜ Not tested

### Step 8: Opponent Receives Notification
- **What:** Log in as the opponent user (second device or browser)
- **Expected:** Opponent receives a push notification (if enabled) and/or an in-app notification about the incoming deal challenge. Notification contains the deal title and challenger's name.
- **Fallback:** Check the notifications API endpoint for the opponent's unread notifications. Verify the push notification service (FCM) is configured and the opponent has a valid push token. Check the in-app notification bell/badge.
- **Status:** ⬜ Not tested

### Step 9: Opponent Accepts Deal
- **What:** As the opponent, open the deal notification/invite and tap "Accept"
- **Expected:** Deal status changes from "pending" to "active" for both users. Both users see the deal in their active deals list. A confirmation is shown to the opponent.
- **Fallback:** Check the deal status update API call. Verify both users' deal lists refresh. Check for race conditions if both users interact simultaneously.
- **Status:** ⬜ Not tested

### Step 10: Both Play the Deal
- **What:** Both users engage with the deal (complete the challenge in real life)
- **Expected:** Deal remains in "active" status. Both users can view deal details, see the timer (if applicable), and access the "Report Result" action.
- **Fallback:** Check if the deal detail page loads correctly for both participants. Verify no premature expiration of the deal.
- **Status:** ⬜ Not tested

### Step 11: Winner Reports Result + Uploads Proof (Camera Only, No Gallery)
- **What:** As the winner, tap "Report Result", select "I won", and upload proof photo using the device camera
- **Expected:** Camera opens directly (no gallery/file picker option). Photo is captured and uploaded. Result is submitted with status "pending confirmation". The proof image is visible in the deal detail.
- **Fallback:** Verify the file input uses `capture="environment"` or `capture="user"` with `accept="image/*"` and does NOT allow gallery selection. Check the image upload API for errors. Verify the image is stored and retrievable (check storage bucket). Test on both iOS and Android.
- **Status:** ⬜ Not tested

### Step 12: Opponent Confirms Result
- **What:** As the opponent, open the deal and review the reported result and proof image. Tap "Confirm" to accept the result.
- **Expected:** Opponent can see the proof photo clearly. After confirming, deal status changes to "completed". Winner and loser are recorded. Both users are notified of the final result.
- **Fallback:** Check if the proof image loads for the opponent. Verify the confirmation API call succeeds. Check that the deal status transitions correctly in the database. Test the dispute flow if opponent taps "Dispute" instead.
- **Status:** ⬜ Not tested

### Step 13: XP + Coins Awarded to Both (Winner Gets More)
- **What:** After deal completion, check both users' XP and coin balances
- **Expected:** Winner receives more XP and coins than the loser. Both users receive some reward for completing the deal. A reward summary/animation is displayed. Balances update in real time on the profile.
- **Fallback:** Check the rewards API response for correct amounts. Verify the XP/coin transaction history. Compare winner vs loser rewards to ensure winner gets more. Check for double-award bugs on page refresh.
- **Status:** ⬜ Not tested

### Step 14: Streak Incremented
- **What:** Check the user's streak counter after completing the deal
- **Expected:** Streak counter increments by 1 for both users (or at minimum the winner). Streak is visible on the profile and/or deal summary. If this is the first deal, streak shows "1".
- **Fallback:** Check the streak API endpoint. Verify streak logic handles timezone boundaries correctly. Check if the streak resets correctly after a missed day.
- **Status:** ⬜ Not tested

### Step 15: Battle Pass XP Updated
- **What:** Navigate to the Battle Pass screen after deal completion
- **Expected:** Battle Pass XP bar reflects the newly earned XP. If a tier threshold is crossed, the new reward is unlocked and a celebration is shown. Progress percentage updates correctly.
- **Fallback:** Check the Battle Pass API for current XP and tier. Verify the XP delta matches what was awarded in Step 13. Check if the progress bar animation renders correctly. Verify tier unlock logic at boundary values.
- **Status:** ⬜ Not tested

---

## Flow 3: Push Notifications

### Step 16: Enable Push in Settings
- **What:** Navigate to Settings and enable push notifications. Accept the browser/OS permission prompt.
- **Expected:** Push permission prompt appears. After granting, the toggle shows "enabled". A push token is registered with the backend (FCM). A test notification may be sent to confirm setup.
- **Fallback:** Check if the service worker is registered (`navigator.serviceWorker.getRegistrations()`). Verify the FCM token is sent to the backend. Check `Notification.permission` status. Ensure HTTPS is active (push requires secure context).
- **Status:** ⬜ Not tested

### Step 17: Receive Push When Deal Is Accepted
- **What:** Have another user accept a deal challenge you created (while your app is in background or closed)
- **Expected:** A push notification appears on the device with the deal acceptance message. Tapping the notification opens the app and navigates to the deal detail.
- **Fallback:** Check FCM delivery status in Firebase Console. Verify the backend sends the push on deal acceptance event. Check the service worker's push event handler. Test with app in foreground vs background vs closed.
- **Status:** ⬜ Not tested

### Step 18: Receive Push When Result Is Reported
- **What:** Have the opponent report a deal result (while your app is in background or closed)
- **Expected:** A push notification appears informing that the opponent reported a result and asking for confirmation. Tapping opens the deal detail with the proof image.
- **Fallback:** Same as Step 17. Additionally verify the notification payload includes the deal ID for deep linking.
- **Status:** ⬜ Not tested

### Step 19: Streak Reminder at 18:00 UTC
- **What:** Wait for 18:00 UTC (or simulate via backend) when a user has an active streak that would break if no deal is completed today
- **Expected:** A push notification is sent reminding the user to complete a deal to maintain their streak. Notification text is clear and actionable.
- **Fallback:** Check the scheduled job/cron that sends streak reminders. Verify it runs at 18:00 UTC. Check the query logic that identifies at-risk streaks. Verify timezone handling (user's local time vs UTC).
- **Status:** ⬜ Not tested

---

## Flow 4: Shop & Rewards

### Step 20: Open Shop and Browse Frames
- **What:** Navigate to the Shop section and browse available card frames
- **Expected:** Shop loads with categories/filters. Card frames are displayed with preview images, names, prices (in coins), and rarity indicators. Scrolling and filtering work smoothly.
- **Fallback:** Check the shop API endpoint for product listings. Verify frame images load (check for 404s). Check if pricing data is present. Test pagination if the shop has many items.
- **Status:** ⬜ Not tested

### Step 21: Buy Coins via Stripe (Test Card 4242...)
- **What:** Select a coin package to purchase. Enter Stripe test card number `4242 4242 4242 4242` with any future expiry and any CVC. Complete the purchase.
- **Expected:** Stripe Checkout or payment sheet opens. Payment processes successfully with test card. Coins are credited to the user's balance immediately (or after webhook confirmation). A purchase confirmation is shown. Transaction appears in purchase history.
- **Fallback:** Check Stripe Dashboard (test mode) for the payment intent status. Verify the Stripe webhook endpoint is reachable and processes events. Check the user's coin balance in the database. Verify Stripe publishable key is the test key (starts with `pk_test_`).
- **Status:** ⬜ Not tested

### Step 22: Purchase a Frame with Coins
- **What:** Select a card frame in the shop and tap "Buy" / "Purchase". Confirm the coin spend.
- **Expected:** Coin balance decreases by the frame's price. Frame is added to the user's inventory. A purchase confirmation animation plays. The frame is now available in the card customization screen.
- **Fallback:** Check the purchase API response. Verify coin deduction is atomic (no double-spend). Check the user's inventory for the new frame. Verify insufficient coins shows an error (not a crash).
- **Status:** ⬜ Not tested

### Step 23: Card Auto-Assigned Matching DNA
- **What:** After purchasing a frame or receiving a new card, check the card's attributes
- **Expected:** The card automatically uses the user's DNA attributes (gender, age, origin, hair). The card visual matches the user's avatar DNA. No manual DNA selection is required for new cards.
- **Fallback:** Check the card generation logic for DNA propagation. Verify the user's DNA profile is stored and accessible. Compare the card's DNA attributes against the user's profile DNA.
- **Status:** ⬜ Not tested

### Step 24: Open a Card Pack and Cards Match User DNA
- **What:** Purchase or earn a card pack and open it
- **Expected:** Card pack opening animation plays. Cards are revealed one by one. All cards match the user's DNA attributes. Cards are added to the user's inventory. Card rarities follow the pack's drop rate distribution.
- **Fallback:** Check the pack opening API response for card data. Verify DNA matching logic on the backend. Check if the animation completes without errors. Verify all cards appear in inventory after opening.
- **Status:** ⬜ Not tested

### Step 25: Equip New Card and Celebration Animation
- **What:** Go to card inventory, select a new card, and tap "Equip" to set it as the active Battle Card
- **Expected:** Card is equipped and shown on the profile. A celebration/equip animation plays (confetti, glow, etc.). The previously equipped card is unequipped. The profile immediately reflects the new card.
- **Fallback:** Check the equip API call. Verify the profile card reference updates. Check if the animation assets load. Test equipping the same card twice (should be a no-op or show "already equipped").
- **Status:** ⬜ Not tested

---

## Flow 5: Social

### Step 26: Comment on a Deal
- **What:** Navigate to a completed deal and write a comment in the comments section
- **Expected:** Comment input is available. After submitting, the comment appears in the deal's comment thread with the user's name, avatar, and timestamp. Other users can see the comment.
- **Fallback:** Check the comments API endpoint. Verify the comment is stored in the database. Check for XSS protection (try submitting `<script>alert(1)</script>`). Verify empty comments are blocked.
- **Status:** ⬜ Not tested

### Step 27: Like a Deal
- **What:** Tap the "Like" button on a deal
- **Expected:** Like count increments by 1. The like button changes state (filled heart, color change, etc.). Tapping again unlikes (decrements count). Like is persisted across page reloads.
- **Fallback:** Check the like API call. Verify the like count in the database. Test rapid tapping (debounce/throttle). Check if the user can like their own deal (if intended).
- **Status:** ⬜ Not tested

### Step 28: Share a Deal Link
- **What:** Tap the "Share" button on a deal
- **Expected:** Native share sheet opens (on mobile) or a shareable link is copied to clipboard (on desktop). The link format is a valid deep link (e.g., `https://app.deal-buddy.app/deal/{id}`). Share preview (OG tags) shows deal title and image.
- **Fallback:** Check if the Web Share API is used (`navigator.share`). Verify the share URL format. Check OG meta tags for the deal page. Test the fallback for browsers that don't support Web Share API.
- **Status:** ⬜ Not tested

### Step 29: Open Shared Link and Deep Link Works
- **What:** Open the shared deal link in a new browser or on another device
- **Expected:** The link opens the app (if installed) or the web app. The user is navigated directly to the deal detail page. If not logged in, the user is prompted to log in first and then redirected to the deal.
- **Fallback:** Check the routing configuration for deal detail pages. Verify the deep link handler in the service worker or app manifest. Test with logged-in and logged-out states. Check that the deal ID in the URL resolves correctly.
- **Status:** ⬜ Not tested

### Step 30: Follow Another User
- **What:** Navigate to another user's profile and tap "Follow"
- **Expected:** Follow button changes to "Following" or "Unfollow". The followed user appears in the "Following" list. The follower appears in the other user's "Followers" list. Follower/following counts update.
- **Fallback:** Check the follow API endpoint. Verify the relationship is stored in the database. Test unfollowing. Check if following yourself is prevented.
- **Status:** ⬜ Not tested

### Step 31: View Leaderboard
- **What:** Navigate to the Leaderboard section
- **Expected:** Leaderboard displays ranked users with their XP, win/loss record, and streak. The current user's position is highlighted. Leaderboard can be filtered by time period (weekly, all-time) or category. Data loads within a reasonable time.
- **Fallback:** Check the leaderboard API response. Verify sorting is correct (highest XP first). Check for pagination on large datasets. Verify the current user appears in the list at the correct position.
- **Status:** ⬜ Not tested

---

## Flow 6: Tippen (Tip Groups)

### Step 32: Create a Tip Group
- **What:** Navigate to the Tippen section and create a new tip group with a name
- **Expected:** Tip group is created with a unique invite code. The creator is automatically the first member and admin. The group appears in the user's tip groups list. Group settings are accessible.
- **Fallback:** Check the tip group creation API. Verify the invite code is generated and unique. Check the group appears in the database. Verify the creator has admin privileges.
- **Status:** ⬜ Not tested

### Step 33: Invite Friend by Code
- **What:** Share the invite code with another user. As the other user, enter the code to join the tip group.
- **Expected:** The invite code is accepted. The new member appears in the group member list. The group appears in the new member's tip groups. A notification is sent to the group admin about the new member.
- **Fallback:** Check the join-by-code API endpoint. Test with an invalid/expired code (should show error). Verify the member count updates. Check if duplicate joins are prevented.
- **Status:** ⬜ Not tested

### Step 34: Submit Tips for Matches
- **What:** Open a tip group and submit predictions/tips for available matches
- **Expected:** Available matches are listed with teams/options. Tips can be submitted before the match deadline. Submitted tips are saved and visible. Tips cannot be changed after the deadline.
- **Fallback:** Check the matches API for available games. Verify the tip submission API. Check deadline enforcement (try submitting after deadline). Verify tips are stored correctly per user per match.
- **Status:** ⬜ Not tested

### Step 35: View Leaderboard Within Group
- **What:** Open the tip group and navigate to the group leaderboard
- **Expected:** Members are ranked by total points from correct tips. Points calculation is accurate. The current user's position is highlighted. Leaderboard updates after match results are finalized.
- **Fallback:** Check the group leaderboard API. Verify points calculation logic. Check if results are processed correctly after matches end. Compare individual tip scores against the leaderboard total.
- **Status:** ⬜ Not tested

---

## Flow 7: Error Cases

### Step 36: Register with Existing Email
- **What:** Attempt to register a new account using an email address that is already registered
- **Expected:** A clear, user-friendly error message is displayed (e.g., "This email is already registered"). The form does not clear valid fields. A "Forgot password?" or "Log in instead" link is offered. No stack trace or technical error is exposed.
- **Fallback:** Check the registration API response code and message. Verify the error is caught in the frontend and displayed. Check that the error does not reveal whether the email exists (security consideration) or intentionally does for UX.
- **Status:** ⬜ Not tested

### Step 37: Create Deal Without Title
- **What:** Attempt to create a deal with the title field left empty. Submit the form.
- **Expected:** Client-side validation prevents submission. A clear validation error message appears near the title field (e.g., "Title is required"). The form does not submit to the backend. Other valid fields retain their values.
- **Fallback:** Check if HTML5 `required` attribute is set on the title input. Verify JavaScript validation logic. Check if the backend also validates (submit via API directly). Ensure no deal is created in the database.
- **Status:** ⬜ Not tested

### Step 38: Buy Coins with Declined Card (4000 0000 0000 0002)
- **What:** Attempt to purchase coins using Stripe test card `4000 0000 0000 0002` (generic decline) with any future expiry and any CVC
- **Expected:** Stripe returns a decline error. A user-friendly error message is displayed (e.g., "Your card was declined. Please try a different payment method."). No coins are credited. No charge appears in Stripe Dashboard. The user can retry with a different card.
- **Fallback:** Check the Stripe payment intent status in the Dashboard. Verify the frontend handles the Stripe error response. Check that the webhook does not process a failed payment. Verify the user's coin balance is unchanged.
- **Status:** ⬜ Not tested

### Step 39: Open App Offline
- **What:** Disable network connectivity (airplane mode or DevTools offline). Open or reload the app.
- **Expected:** The app loads from the service worker cache (PWA offline support). A clear offline indicator is shown. Cached content (profile, previous deals) is accessible. Actions requiring network show an appropriate offline message. The app does not crash or show a blank screen.
- **Fallback:** Check if the service worker is installed and has cached assets (`Application > Cache Storage` in DevTools). Verify the offline fallback page exists. Check `manifest.json` for correct start_url. Test the service worker's fetch event handler.
- **Status:** ⬜ Not tested

### Step 40: Try Gallery Upload for Proof (Blocked, Camera Only)
- **What:** When reporting a deal result, attempt to upload a proof image from the device gallery instead of taking a live photo
- **Expected:** The gallery/file picker is NOT available. Only the camera capture option is presented. If on desktop (no camera), a clear message explains that camera-only proof is required. No workaround allows gallery uploads.
- **Fallback:** Inspect the file input element for `capture` attribute (should be `capture="environment"` or `capture="camera"`). Check if `accept="image/*"` is combined with `capture` to enforce camera-only. Test on iOS Safari and Android Chrome (behavior differs). Verify no JavaScript workaround bypasses the restriction.
- **Status:** ⬜ Not tested

---

## Test Summary

| Flow | Steps | Passed | Failed | Blocked | Not Tested |
|------|-------|--------|--------|---------|------------|
| 1. Onboarding | 1-6 | | | | 6 |
| 2. Core Deal Loop | 7-15 | | | | 9 |
| 3. Push Notifications | 16-19 | | | | 4 |
| 4. Shop & Rewards | 20-25 | | | | 6 |
| 5. Social | 26-31 | | | | 6 |
| 6. Tippen (Tip Groups) | 32-35 | | | | 4 |
| 7. Error Cases | 36-40 | | | | 5 |
| **Total** | **40** | | | | **40** |

---

## Notes

- All tests should be run on both iOS Safari and Android Chrome at minimum
- Stripe tests must use test mode keys (pk_test_ / sk_test_)
- Push notification tests require real devices (not simulators for full coverage)
- Camera-only tests (Step 11, 40) behave differently across browsers and OS versions
- Streak tests (Step 14, 19) are time-sensitive and may require backend manipulation or waiting

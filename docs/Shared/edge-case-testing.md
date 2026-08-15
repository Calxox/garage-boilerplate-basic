# Edge Case Testing Notes

Testing for the sprint demo. Went through the code first to see what validation actually exists, then tested on the live site (garage-boilerplate-basic-frontend-ruby.vercel.app) to check what's actually real. Commit tested: 2719206.

## Big one first - notes are broken

Tried making a note and it just gets stuck on "Saving..." forever. Nothing actually saves and you don't get any error message either, it just sits there like it's working. Checked the console and it's throwing a Firestore permissions error every time. Tried a normal note first before anything fancy just to make sure it wasn't something I did wrong, same result. This is not an edge case thing, the feature just doesn't work right now. Needs to get fixed before the demo or there's nothing to actually show for notes.

Because of this I couldn't test the stuff I was actually supposed to (empty/whitespace titles, huge note bodies) since nothing saves in the first place. Will go back and do those once it's working again.

## Other bugs I found

Forgot password link doesn't do anything, it doesn't send you an email, just reloads the sign in page.

Remember me checkbox - you can click it but it's not connected to anything, doesn't do anything when you submit.

Typo on the about page, under Renil's bio it says "Bachelor of Informaiton Technology" instead of Information.

Landing page still has leftover text on it that just says "Placeholder text" under the app name, never got swapped for real copy.

About/team page needs you to be logged in to see it. Not sure if that's on purpose but it feels weird, most team pages are public.

You can sign up with just spaces as your name and it lets you through.

No limit on password length, if you paste something really long you just get a vague error, no real explanation why it failed.

## Stuff that actually works fine

- can't log in if your email isn't verified yet, blocks you properly
- signing up with an email that's already used gives you a proper error message
- if your passwords don't match on signup it catches that before you even submit
- bad email format gets blocked right away
- password under 8 characters gets rejected properly
- if you're logged out and try to go to /dashboard or /about it sends you to sign in like it should

## How I tested

Read through the validation code, the auth logic and firestore rules first to know what to actually look for, then went through the live site clicking through everything. Made one throwaway account (edge-case-unverified-test@example.com) just to test what happens logging in before verifying your email - someone should delete that from firebase console when they get a chance.

- Renil

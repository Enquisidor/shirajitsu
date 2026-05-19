Feature: Extension sign-out via Clerk
  A signed-in user can sign out from the extension popup, which ends the Clerk session
  and returns the popup to the sign-in prompt so another user can sign in or the same
  user can re-authenticate.

  Background:
    Given the Chrome extension is installed
    And the user has an active Clerk session

  Scenario: Sign-out button shown when signed in
    When the user opens the extension popup
    Then the popup displays a "Sign out" button

  Scenario: Session ended and sign-in prompt returned on sign-out
    Given the user has opened the extension popup
    When the user clicks "Sign out"
    Then the Clerk session is ended
    And the popup displays the sign-in prompt
    And the analyse controls are not visible

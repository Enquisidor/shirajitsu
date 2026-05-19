Feature: Extension sign-in via Clerk OAuth
  The Chrome extension popup shows a sign-in prompt to users who have no active Clerk session.
  Clicking "Sign in" opens the Clerk OAuth popup, and upon completion the popup transitions
  to the analyse controls so the user can immediately begin using the extension.

  Background:
    Given the Chrome extension is installed

  Scenario: Sign-in prompt shown when no session exists
    Given the user has no active Clerk session
    When the user opens the extension popup
    Then the popup displays a sign-in prompt
    And the analyse controls are not visible

  Scenario: Clerk OAuth popup launched on sign-in click
    Given the user has no active Clerk session
    And the user has opened the extension popup
    When the user clicks "Sign in"
    Then the Clerk OAuth popup opens

  Scenario: Popup transitions to analyse view after successful sign-in
    Given the user has no active Clerk session
    And the user has opened the extension popup
    And the user has clicked "Sign in"
    When the user completes the Clerk OAuth flow
    Then the extension popup shows the analyse controls
    And the sign-in prompt is no longer visible

  Scenario: User identity shown after successful sign-in
    Given the user has completed the Clerk OAuth flow
    When the user opens the extension popup
    Then the popup displays the user's name or email address

  Scenario: Signed-in state persists across browser sessions
    Given the user has previously completed the Clerk OAuth flow
    When the user reopens Chrome and opens the extension popup
    Then the popup shows the analyse controls without prompting the user to sign in again

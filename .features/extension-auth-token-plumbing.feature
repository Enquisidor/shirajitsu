Feature: Extension JWT token plumbing for analysis requests
  When a signed-in user triggers page analysis, the extension obtains a valid JWT from
  the active Clerk session and attaches it to the request. The legacy manual-token path
  (chrome.storage.sync userToken) is no longer used anywhere in the extension.

  Background:
    Given the Chrome extension is installed
    And the user has an active Clerk session

  Scenario: Analysis request carries a valid Clerk JWT
    Given the user has opened the extension popup
    When the user clicks "Analyse this page"
    Then the analysis request is sent with a valid Clerk JWT in the Authorization header

  Scenario: Analysis blocked when no session exists
    Given the user has no active Clerk session
    And the user has opened the extension popup
    When the user attempts to trigger page analysis
    Then no analysis request is sent
    And the popup displays the sign-in prompt

  Scenario: Manual token path is not used
    Given the user has an active Clerk session
    When the user clicks "Analyse this page"
    Then the extension does not read a manually stored token to authorise the request

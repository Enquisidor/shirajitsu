Feature: Extension analysis settings — highlight color and per-selection model
  The extension allows the user to configure a persistent highlight color for all analyzed
  spans, and to override the global model setting for a single analysis submission from the
  popup. The highlight color is stored in extension settings and survives browser restarts.
  The per-selection model override applies only to the current submission and is not saved.

  Background:
    Given the Chrome extension is installed
    And the user has an active Clerk session
    And the user has opened a web page

  # ── Highlight color selection ──────────────────────────────────────────────

  Scenario: Chosen highlight color is applied to highlights from selection-based analysis
    Given the user has set a custom highlight color in the extension settings
    And the user has selected text on the page
    And the user has clicked "Analyze selection"
    When the analysis completes and Annotations are returned
    Then the inline highlights are rendered in the user's chosen highlight color

  Scenario: Chosen highlight color is applied to highlights from whole-page analysis
    Given the user has set a custom highlight color in the extension settings
    And the user has no text selected on the page
    And the user has clicked "Analyze whole page"
    When the analysis completes and Annotations are returned
    Then the inline highlights are rendered in the user's chosen highlight color

  Scenario: Highlight color persists across browser sessions
    Given the user has set a custom highlight color in the extension settings
    When the user closes and reopens the browser
    Then the extension settings still show the user's chosen highlight color
    And the highlight color is applied to the next analysis

  Scenario: Highlight color is layered on top of risk-level color coding
    Given the user has set a custom highlight color in the extension settings
    And the user has clicked "Analyze selection"
    When the analysis completes and Annotations with different risk levels are returned
    Then each highlight uses the user's chosen highlight color as its base color
    And risk-level color coding is still visually distinguishable within each highlight

  # ── Per-selection model settings ────────────────────────────────────────────

  Scenario: Model selection controls are shown in the popup when text is selected
    Given the user has selected text on the page
    When the user opens the extension popup
    Then the popup displays model selection controls

  Scenario: Per-selection model override is used for that submission
    Given the user has selected text on the page
    And the user has opened the extension popup
    And the user has selected a model that differs from the global default
    When the user clicks "Analyze selection"
    Then the analysis request is submitted using the model the user selected in the popup

  Scenario: Per-selection model override does not affect the global default setting
    Given the user has selected text on the page
    And the user has opened the extension popup
    And the user has selected a model that differs from the global default
    When the user clicks "Analyze selection"
    Then the global model default in the extension settings is unchanged

  Scenario: Popup reverts to global default model on next open after a per-selection override
    Given the user has selected a model in the popup that differs from the global default
    And the user has clicked "Analyze selection"
    When the user closes the popup and opens it again
    Then the model selection control shows the global default model

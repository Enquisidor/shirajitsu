Feature: Selection-aware popup CTA and analysis submission
  When the user opens the extension popup, the popup detects whether text is currently
  selected on the page and adjusts its primary call-to-action accordingly. Selecting text
  first is the primary interaction model; whole-page analysis is always secondary.
  The popup also validates the selected text before allowing submission, warning the user
  when the selection is too short to analyze.

  Background:
    Given the Chrome extension is installed
    And the user has an active Clerk session
    And the user has opened a web page

  Scenario: Popup shows "Analyze selection" CTA when text is selected
    Given the user has selected text on the page
    When the user opens the extension popup
    Then the popup displays an "Analyze selection" call-to-action
    And the popup displays a preview of the selected text truncated to approximately 80 characters

  Scenario: Popup shows "Analyze whole page" CTA when no text is selected
    Given the user has no text selected on the page
    When the user opens the extension popup
    Then the popup displays an "Analyze whole page" call-to-action
    And the popup does not display a text selection preview

  Scenario: "Analyze whole page" is visually de-emphasized relative to "Analyze selection"
    Given the user has selected text on the page
    When the user opens the extension popup
    Then the "Analyze selection" call-to-action is the visually primary action
    And the "Analyze whole page" call-to-action is visually de-emphasized

  Scenario: Mode label remains visible when a selection is present
    Given the user has selected text on the page
    When the user opens the extension popup
    Then the mode label is visible alongside the "Analyze selection" call-to-action

  Scenario: Mode label remains visible when no selection is present
    Given the user has no text selected on the page
    When the user opens the extension popup
    Then the mode label is visible alongside the "Analyze whole page" call-to-action

  Scenario: Selection preview is truncated with ellipsis when text exceeds preview length
    Given the user has selected text on the page longer than 80 characters
    When the user opens the extension popup
    Then the selection preview shows the first approximately 80 characters followed by an ellipsis

  Scenario: "Analyze selection" submits only the selected text
    Given the user has selected text on the page
    And the user has opened the extension popup
    When the user clicks "Analyze selection"
    Then the analysis request is submitted with only the selected text as its content

  Scenario: "Analyze whole page" submits the full page text
    Given the user has no text selected on the page
    And the user has opened the extension popup
    When the user clicks "Analyze whole page"
    Then the analysis request is submitted with the full extracted page text as its content

  Scenario: Context field is derived from page-level detection regardless of selection
    Given the user has selected text on the page
    And the user has opened the extension popup
    When the user clicks "Analyze selection"
    Then the analysis request includes the context field derived from the page-level detected mode

  Scenario: CTA updates to "Analyze selection" when user selects text while popup is open
    Given the user has no text selected on the page
    And the user has opened the extension popup
    When the user selects text on the page while the popup remains open
    Then the popup call-to-action updates to "Analyze selection"
    And a preview of the newly selected text is displayed

  Scenario: CTA reverts to "Analyze whole page" when user clears selection while popup is open
    Given the user has selected text on the page
    And the user has opened the extension popup
    When the user clears the text selection while the popup remains open
    Then the popup call-to-action reverts to "Analyze whole page"
    And the text selection preview is no longer displayed

  Scenario: Inline warning shown and submission blocked when selected text is too short
    Given the user has selected a single word on the page
    And the user has opened the extension popup
    When the user clicks "Analyze selection"
    Then the popup displays an inline warning that the selected text is too short to analyze
    And the analysis request is not submitted

  Scenario: Inline warning shown and submission blocked when selected text is a very short phrase
    Given the user has selected a very short phrase on the page
    And the user has opened the extension popup
    When the user clicks "Analyze selection"
    Then the popup displays an inline warning that the selected text is too short to analyze
    And the analysis request is not submitted

  Scenario: Whitespace-only selection is treated as no selection
    Given the user has selected only whitespace characters on the page
    When the user opens the extension popup
    Then the popup displays an "Analyze whole page" call-to-action
    And the popup does not display a text selection preview

  Scenario: Empty selection is treated as no selection
    Given the user has an empty selection on the page
    When the user opens the extension popup
    Then the popup displays an "Analyze whole page" call-to-action
    And the popup does not display a text selection preview

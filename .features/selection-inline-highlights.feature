Feature: Inline highlight anchoring for selection-based analysis
  When an analysis is run on a selected region of the page and the display mode is inline,
  highlights are anchored within the selected DOM range only — not relative to the full
  page text. When analysis is run on the whole page, existing highlight anchoring is unchanged.

  Background:
    Given the Chrome extension is installed
    And the user has an active Clerk session
    And the user has opened a web page
    And the display mode is set to inline

  Scenario: Highlights are applied within the selected region after selection-based analysis
    Given the user has selected text on the page
    And the user has opened the extension popup
    And the user has clicked "Analyze selection"
    When the analysis completes and Annotations are returned
    Then inline highlights are applied within the selected DOM range only

  Scenario: Highlight positions are resolved relative to the selected text
    Given the user has selected text on the page
    And the user has clicked "Analyze selection"
    When the analysis completes and Annotations with charOffset values are returned
    Then each highlight is positioned relative to the start of the selected text
    And not relative to the start of the full page text

  Scenario: Existing whole-page highlight anchoring is unchanged after whole-page analysis
    Given the user has no text selected on the page
    And the user has opened the extension popup
    And the user has clicked "Analyze whole page"
    When the analysis completes and Annotations are returned
    Then inline highlights are applied across the full page using the existing anchoring behavior

  Scenario: Sidebar display shows Annotations correctly after selection-based analysis
    Given the user has selected text on the page
    And the user has clicked "Analyze selection"
    When the analysis completes and Annotations are returned
    Then the sidebar displays the returned Annotations correctly

  Scenario: Sidebar display shows Annotations correctly after whole-page analysis
    Given the user has no text selected on the page
    And the user has clicked "Analyze whole page"
    When the analysis completes and Annotations are returned
    Then the sidebar displays the returned Annotations correctly

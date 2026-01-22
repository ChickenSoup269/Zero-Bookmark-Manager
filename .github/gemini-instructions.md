# Gemini Codebase Instructions

This document provides instructions for interacting with Gemini, a large language model from Google, to assist with development in this repository.

## General Principles

*   **Be specific:** The more specific your request, the better Gemini can understand and help. Instead of "fix the bug," try "The bookmarks are not saving when I click the 'add' button. I think the issue is in `components/bookmarks.js`. Please investigate and fix it."
*   **Provide context:** Mention relevant files, functions, or variables. This helps Gemini focus on the right parts of the code.
*   **One thing at a time:** It's often better to ask for one change at a time. This makes it easier to review and test the changes.

## Examples

### Asking for a new feature

"I want to add a feature that allows users to search for bookmarks by keyword. Please add a search bar to `bookmarks.html` and implement the search functionality in `components/bookmarks.js`."

### Asking to fix a bug

"There is a bug in the `deleteFolder` function in `components/controller/deleteFolder.js`. When a folder is deleted, the bookmarks within that folder are not being removed from the UI until the page is refreshed. Please fix this."

### Asking to refactor code

"The `main.js` file is getting too long. Please refactor the code related to event listeners into a new file called `components/events.js`."

### Asking for documentation

"Please add JSDoc comments to the `createFolder` function in `components/controller/createFolder.js` to explain what it does, its parameters, and what it returns."

## What Gemini can do

*   Read and understand the code in this repository.
*   Write new code (JavaScript, HTML, CSS).
*   Modify existing code.
*   Add comments and documentation.
*   Answer questions about the codebase.
*   Help with debugging.
*   Suggest improvements and refactoring.

## What Gemini cannot do

*   Run the development server or tests for you. You will need to do this yourself to verify the changes.
*   Access external services or APIs that are not public.
*   Read your mind. Be explicit in your requests.

By following these instructions, you can make the most of Gemini's capabilities to improve your development workflow.

// ---------- Live demo: calculation in JavaScript ----------
// Same logic as backend.c (same grammar, same error messages)
function evaluateExpression(text) {
  let pos = 0;

  function skipSpaces() {
    while (pos < text.length && /\s/.test(text[pos])) pos++;
  }

  // + and - (lowest priority)
  function parseExpression() {
    let value = parseTerm();
    while (true) {
      skipSpaces();
      const op = text[pos];
      if (op !== "+" && op !== "-") break;
      pos++;
      const right = parseTerm();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  }

  // * / % (higher priority)
  function parseTerm() {
    let value = parseFactor();
    while (true) {
      skipSpaces();
      const op = text[pos];
      if (op !== "*" && op !== "/" && op !== "%") break;
      pos++;
      const right = parseFactor();
      if ((op === "/" || op === "%") && right === 0) {
        throw new Error("Cannot divide by zero!");
      }
      if (op === "*") value *= right;
      else if (op === "/") value /= right;
      else value %= right; // same as fmod in C
    }
    return value;
  }

  // sign, bracket or number (highest priority)
  function parseFactor() {
    skipSpaces();
    if (text[pos] === "-") { pos++; return -parseFactor(); }
    if (text[pos] === "+") { pos++; return parseFactor(); }

    if (text[pos] === "(") {
      pos++;
      const value = parseExpression();
      skipSpaces();
      if (text[pos] !== ")") throw new Error("Invalid expression!");
      pos++;
      return value;
    }

    const start = pos;
    let dots = 0;
    let digits = 0;
    while (pos < text.length && /[0-9.]/.test(text[pos])) {
      if (text[pos] === ".") dots++;
      else digits++;
      pos++;
    }
    if (digits === 0 || dots > 1) throw new Error("Invalid expression!");
    return Number(text.slice(start, pos));
  }

  const answer = parseExpression();
  skipSpaces();
  if (pos !== text.length) throw new Error("Invalid expression!");
  if (!Number.isFinite(answer)) throw new Error("Result out of range!");

  if (answer === 0) return "0"; // avoid "-0"
  if (Number.isInteger(answer) && Math.abs(answer) < 1e15) {
    return answer.toFixed(0);
  }
  // Same style as C's %.12g (very big/small numbers use e-notation)
  const abs = Math.abs(answer);
  if (abs >= 1e15 || abs < 1e-4) {
    let [mant, exp] = answer.toExponential(11).split("e");
    mant = mant.replace(/\.?0+$/, "");
    const sign = exp[0] === "-" ? "-" : "+";
    exp = exp.replace(/^[+-]/, "").padStart(2, "0");
    return mant + "e" + sign + exp;
  }
  return String(Number(answer.toPrecision(12)));
}

const expressionDisplay = document.getElementById("expression");
const resultDisplay = document.getElementById("result");
const buttons = document.querySelectorAll(".calculator-buttons button");
const historyList = document.getElementById("history-list");
const toggleHistoryButton = document.getElementById("toggle-history");
const clearHistoryButton = document.getElementById("clear-history");
const copyResultButton = document.getElementById("copy-result");

let expression = "";
let isHistoryExpanded = false;
let lastResult = null; // last successful result (used by Copy)


// Load calculation history from browser localStorage
let calculationHistory = [];

function loadHistory() {
  try {
    const saved = localStorage.getItem("nova-history");
    const parsed = saved ? JSON.parse(saved) : [];
    calculationHistory = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    calculationHistory = [];
  }
  renderHistory();
}

// Keep expression and textarea synchronized
function setExpression(value, cursorPosition = value.length) {
  expression = value;
  expressionDisplay.value = value;
  resultDisplay.textContent = "0";
  lastResult = null;

  expressionDisplay.focus();
  expressionDisplay.setSelectionRange(cursorPosition, cursorPosition);
}

// Expression input sync
expressionDisplay.addEventListener("input", () => {
  // Clean pasted text: map pretty symbols, drop anything the calculator can't use
  const raw = expressionDisplay.value;
  const cleaned = raw
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/[−–—]/g, "-")
    .replace(/[^0-9.+\-*/%()\s]/g, "");

  if (cleaned !== raw) {
    const cursor = Math.max(
      0,
      expressionDisplay.selectionStart - (raw.length - cleaned.length)
    );
    expressionDisplay.value = cleaned;
    expressionDisplay.setSelectionRange(cursor, cursor);
  }

  expression = expressionDisplay.value;
  resultDisplay.textContent = "0";
  lastResult = null;

  expressionDisplay.scrollLeft = expressionDisplay.scrollWidth;
});

// Render calculation history
function renderHistory() {
  if (!historyList) return;

  historyList.replaceChildren();

  if (calculationHistory.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No calculations yet";
    historyList.appendChild(item);
    return;
  }

  const visibleHistory = isHistoryExpanded
    ? calculationHistory
    : calculationHistory.slice(0, 4);

  visibleHistory.forEach((entry) => {
    const item = document.createElement("li");

    const historyExpression =
      typeof entry === "string"
        ? entry.split(" = ")[0]
        : entry?.expression ?? "";

    item.textContent =
      typeof entry === "string"
        ? entry
        : `${entry?.expression ?? ""} = ${entry?.result ?? ""}`;

    item.style.cursor = "pointer";

    item.addEventListener("click", () => {
      setExpression(historyExpression);
    });

    historyList.appendChild(item);
  });
}

// Expand / collapse history
toggleHistoryButton?.addEventListener("click", () => {
  isHistoryExpanded = !isHistoryExpanded;

  toggleHistoryButton.textContent = isHistoryExpanded
    ? "Calculation History ▲"
    : "Calculation History ▼";

  toggleHistoryButton.setAttribute(
    "aria-expanded",
    String(isHistoryExpanded)
  );

  renderHistory();
});

// Save history in browser localStorage (newest first, max 50)
function saveHistory(entry) {
  calculationHistory.unshift(entry);
  calculationHistory = calculationHistory.slice(0, 50);

  try {
    localStorage.setItem("nova-history", JSON.stringify(calculationHistory));
  } catch (error) {
    console.error("Could not save history:", error);
  }

  renderHistory();
}

// Clear history with confirmation

clearHistoryButton?.addEventListener("click", () => {
  const confirmed = confirm(
    "Are you sure you want to clear all calculation history?"
  );

  if (!confirmed) return;

  calculationHistory = [];
  localStorage.removeItem("nova-history");
  renderHistory();
});

// Copy displayed result
copyResultButton?.addEventListener("click", async () => {
  if (lastResult === null) return;

  try {
    await navigator.clipboard.writeText(lastResult);
    copyResultButton.textContent = "Copied!";
  } catch (error) {
    copyResultButton.textContent = "Copy failed";
  }

  setTimeout(() => {
    copyResultButton.textContent = "Copy";
  }, 1200);
});

loadHistory();

// Calculator buttons
buttons.forEach((button) => {
  button.addEventListener("click", async () => {
    const value = button.dataset.value;
    const action = button.dataset.action;

    // AC: clear calculator
    if (action === "clear") {
      setExpression("");
      return;
    }

    // DEL: delete selected or previous character
    if (action === "delete") {
      const start = expressionDisplay.selectionStart;
      const end = expressionDisplay.selectionEnd;

      if (start !== end) {
        const updated =
          expressionDisplay.value.slice(0, start) +
          expressionDisplay.value.slice(end);

        setExpression(updated, start);
      } else if (start > 0) {
        const updated =
          expressionDisplay.value.slice(0, start - 1) +
          expressionDisplay.value.slice(end);

        setExpression(updated, start - 1);
      } else {
        expressionDisplay.focus();
      }

      return;
    }

    // Calculate using JavaScript (live demo)
    if (action === "calculate") {
      expression = expressionDisplay.value;

      if (!expression.trim()) {
        resultDisplay.textContent = "Enter a calculation first";
        return;
      }

      resultDisplay.textContent = "Calculating...";
      lastResult = null;
      button.disabled = true;
      button.textContent = "...";

      try {
        const answer = evaluateExpression(expression);

        resultDisplay.textContent = answer;
        lastResult = answer;
        saveHistory({ expression: expression, result: answer });
      } catch (error) {
        resultDisplay.textContent =
          error.message || "Invalid expression. Please check your input.";
      } finally {
        button.disabled = false;
        button.textContent = "=";
      }

      return;
    }

    // Number and operator buttons
    if (value !== undefined) {
      const start = expressionDisplay.selectionStart;
      const end = expressionDisplay.selectionEnd;

      const updated =
        expressionDisplay.value.slice(0, start) +
        value +
        expressionDisplay.value.slice(end);

      setExpression(updated, start + value.length);
    }
  });
});

// Keyboard support with visual button feedback
document.addEventListener("keydown", (event) => {
  // Let browser shortcuts (Ctrl+C, Ctrl+V, Ctrl+A, Cmd+..., Alt+...) work normally
  if (event.ctrlKey || event.metaKey || event.altKey) return;

  const isExpressionFocused =
    document.activeElement === expressionDisplay;

  // Enter: calculate
  if (event.key === "Enter" && isExpressionFocused) {
    event.preventDefault();

    document
      .querySelector(
        '.calculator-buttons button[data-action="calculate"]'
      )
      ?.click();

    return;
  }

  // Escape: clear calculator
  if (event.key === "Escape") {
    document
      .querySelector(
        '.calculator-buttons button[data-action="clear"]'
      )
      ?.click();

    return;
  }

  // Block invalid typed characters in the expression box
  if (
    isExpressionFocused &&
    event.key.length === 1 &&
    !/^[0-9.+\-*/%()]$/.test(event.key)
  ) {
    event.preventDefault();
    return;
  }

  let matchingButton = null;

  if (/^[0-9.]$/.test(event.key)) {
    matchingButton = [...buttons].find(
      (button) => button.dataset.value === event.key
    );
  } else if (["+", "-", "*", "/", "%", "(", ")"].includes(event.key)) {
    matchingButton = [...buttons].find(
      (button) => button.dataset.value === event.key
    );
  } else if (event.key === "Backspace") {
    matchingButton = [...buttons].find(
      (button) => button.dataset.action === "delete"
    );
  }

  if (!matchingButton) return;

  // Show visual keyboard feedback
  matchingButton.classList.remove("keyboard-pressed");
  void matchingButton.offsetWidth;
  matchingButton.classList.add("keyboard-pressed");

  setTimeout(() => {
    matchingButton.classList.remove("keyboard-pressed");
  }, 300);

  // Allow normal typing while the expression box is focused
  if (isExpressionFocused) return;

  // Otherwise, handle the keyboard input ourselves
  event.preventDefault();

  if (event.key === "Backspace") {
    const start = expressionDisplay.selectionStart;
    const end = expressionDisplay.selectionEnd;

    if (start !== end) {
      const updated =
        expressionDisplay.value.slice(0, start) +
        expressionDisplay.value.slice(end);

      setExpression(updated, start);
    } else if (start > 0) {
      const updated =
        expressionDisplay.value.slice(0, start - 1) +
        expressionDisplay.value.slice(end);

      setExpression(updated, start - 1);
    }
  } else {
    const start = expressionDisplay.selectionStart;
    const end = expressionDisplay.selectionEnd;

    const updated =
      expressionDisplay.value.slice(0, start) +
      event.key +
      expressionDisplay.value.slice(end);

    setExpression(updated, start + event.key.length);
  }
});
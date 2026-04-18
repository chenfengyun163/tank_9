import "dotenv/config";
import OpenAI from "openai";
import { chromium } from "playwright";

const VIEWPORT = { width: 1280, height: 720 };
const DEFAULT_URL = process.env.COMPUTER_USE_START_URL ?? "https://www.bing.com";
const MODEL = process.env.OPENAI_MODEL ?? "gpt-5.4";

const task = process.argv.slice(2).join(" ").trim();

if (!process.env.OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY. Add it to your environment or .env file.");
  process.exit(1);
}

if (!task) {
  console.error('Usage: npm run computer-use -- "Open a page and search for something"');
  process.exit(1);
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const normalizeKey = (key) => {
  switch (String(key).toUpperCase()) {
    case "ENTER":
    case "RETURN":
      return "Enter";
    case "ESC":
    case "ESCAPE":
      return "Escape";
    case "TAB":
      return "Tab";
    case "SPACE":
      return "Space";
    case "BACKSPACE":
      return "Backspace";
    case "DELETE":
    case "DEL":
      return "Delete";
    case "HOME":
      return "Home";
    case "END":
      return "End";
    case "PAGEUP":
      return "PageUp";
    case "PAGEDOWN":
      return "PageDown";
    case "UP":
    case "ARROWUP":
      return "ArrowUp";
    case "DOWN":
    case "ARROWDOWN":
      return "ArrowDown";
    case "LEFT":
    case "ARROWLEFT":
      return "ArrowLeft";
    case "RIGHT":
    case "ARROWRIGHT":
      return "ArrowRight";
    case "CTRL":
    case "CONTROL":
      return "Control";
    case "SHIFT":
      return "Shift";
    case "OPTION":
    case "ALT":
      return "Alt";
    case "META":
    case "CMD":
    case "COMMAND":
      return "Meta";
    default:
      return key;
  }
};

const normalizeDragPath = (path) => {
  if (!Array.isArray(path)) {
    throw new Error("drag action requires a path array");
  }

  return path.map((point) => {
    if (Array.isArray(point) && point.length >= 2) {
      return [point[0], point[1]];
    }

    if (point && typeof point === "object" && "x" in point && "y" in point) {
      return [point.x, point.y];
    }

    throw new Error("drag path entries must be [x, y] or {x, y}");
  });
};

const withModifiers = async (page, keys = [], action) => {
  const normalized = keys.map(normalizeKey);

  for (const key of normalized) {
    await page.keyboard.down(key);
  }

  try {
    await action();
  } finally {
    for (const key of [...normalized].reverse()) {
      await page.keyboard.up(key);
    }
  }
};

const runAction = async (page, action) => {
  switch (action.type) {
    case "screenshot":
      return;
    case "click":
      await withModifiers(page, action.keys, async () => {
        await page.mouse.click(action.x, action.y, {
          button: action.button ?? "left",
        });
      });
      return;
    case "double_click":
      await withModifiers(page, action.keys, async () => {
        await page.mouse.dblclick(action.x, action.y, {
          button: action.button ?? "left",
        });
      });
      return;
    case "move":
      await page.mouse.move(action.x, action.y);
      return;
    case "scroll":
      await page.mouse.move(action.x ?? VIEWPORT.width / 2, action.y ?? VIEWPORT.height / 2);
      await page.mouse.wheel(action.scroll_x ?? 0, action.scroll_y ?? 0);
      return;
    case "type":
      await page.keyboard.type(action.text ?? "", { delay: 20 });
      return;
    case "keypress": {
      const keys = (action.keys ?? []).map(normalizeKey);
      if (keys.length === 0) {
        return;
      }
      for (const key of keys.slice(0, -1)) {
        await page.keyboard.down(key);
      }
      try {
        await page.keyboard.press(keys[keys.length - 1]);
      } finally {
        for (const key of [...keys.slice(0, -1)].reverse()) {
          await page.keyboard.up(key);
        }
      }
      return;
    }
    case "drag": {
      const points = normalizeDragPath(action.path);
      const [[startX, startY], ...rest] = points;
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      for (const [x, y] of rest) {
        await page.mouse.move(x, y, { steps: 8 });
      }
      await page.mouse.up();
      return;
    }
    case "wait":
      await page.waitForTimeout(action.ms ?? 1000);
      return;
    default:
      throw new Error(`Unsupported computer action: ${action.type}`);
  }
};

const getComputerCall = (response) =>
  response.output.find((item) => item.type === "computer_call");

const summarizeActions = (actions = []) =>
  actions.map((action) => action.type).join(", ") || "none";

const main = async () => {
  const browser = await chromium.launch({
    headless: false,
    chromiumSandbox: true,
    env: {},
    args: ["--disable-extensions", "--disable-file-system"],
  });

  try {
    const page = await browser.newPage({ viewport: VIEWPORT });
    await page.goto(DEFAULT_URL, { waitUntil: "domcontentloaded" });

    let response = await client.responses.create({
      model: MODEL,
      tools: [{ type: "computer" }],
      input: `${task}\nUse the computer tool for UI interaction.`,
    });

    while (true) {
      const computerCall = getComputerCall(response);
      if (!computerCall) {
        break;
      }

      if ((computerCall.pending_safety_checks ?? []).length > 0) {
        const messages = computerCall.pending_safety_checks
          .map((check) => `${check.code}: ${check.message}`)
          .join("\n");
        throw new Error(`Safety checks require manual review before continuing:\n${messages}`);
      }

      console.log(`Running actions: ${summarizeActions(computerCall.actions)}`);

      for (const action of computerCall.actions ?? []) {
        await runAction(page, action);
      }

      const screenshotBase64 = (await page.screenshot({ type: "png" })).toString("base64");

      response = await client.responses.create({
        model: MODEL,
        tools: [{ type: "computer" }],
        previous_response_id: response.id,
        input: [
          {
            type: "computer_call_output",
            call_id: computerCall.call_id,
            output: {
              type: "computer_screenshot",
              image_url: `data:image/png;base64,${screenshotBase64}`,
              detail: "original",
            },
          },
        ],
      });
    }

    console.log("\nFinal response:\n");
    console.log(response.output_text || JSON.stringify(response.output, null, 2));
  } finally {
    await browser.close();
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

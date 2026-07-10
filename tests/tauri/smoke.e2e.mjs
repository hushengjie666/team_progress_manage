import assert from "node:assert/strict";

const storageKey = "timemanage.app_state.v4";
const backendUrl = process.env.TM_TAURI_SMOKE_BACKEND_URL ?? "http://127.0.0.1:8787";
const smokeEmail = process.env.TM_TAURI_SMOKE_EMAIL ?? "admin";
const smokePassword = process.env.TM_TAURI_SMOKE_PASSWORD ?? "hu626699";

const textVisible = async (text) => browser.execute((value) => document.body.innerText.includes(value), text);

const waitForText = async (text, timeoutMsg = `Expected text not found: ${text}`) => {
  try {
    await browser.waitUntil(() => textVisible(text), {
      timeout: 15000,
      interval: 250,
      timeoutMsg,
    });
  } catch (error) {
    const body = await browser.execute(() => document.body.innerText.slice(0, 1000));
    throw new Error(`${error instanceof Error ? error.message : String(error)}\nCurrent body:\n${body}`);
  }
};

const clickButton = async (text) => {
  await browser.execute((buttonText) => {
    const button = Array.from(document.querySelectorAll("button"))
      .find((element) => element.textContent?.includes(buttonText));
    if (!button) throw new Error(`Button not found: ${buttonText}`);
    button.click();
  }, text);
};

const setInputByLabel = async (labelText, value) => {
  await browser.execute(({ labelText: targetLabel, value: nextValue }) => {
    const label = Array.from(document.querySelectorAll("label"))
      .find((element) => element.textContent?.includes(targetLabel));
    const input = label?.querySelector("input");
    if (!input) throw new Error(`Input not found for label: ${targetLabel}`);

    const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    valueSetter?.call(input, nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, { labelText, value });
};

const inputValueByLabel = async (labelText) => browser.execute((targetLabel) => {
  const label = Array.from(document.querySelectorAll("label"))
    .find((element) => element.textContent?.includes(targetLabel));
  const input = label?.querySelector("input");
  if (!input) throw new Error(`Input not found for label: ${targetLabel}`);
  return input.value;
}, labelText);

const currentStoredRuntime = async () => browser.execute((key) => {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}, storageKey);

const startFromSignedOutState = async () => {
  await browser.execute(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await browser.refresh();

  await browser.waitUntil(async () => {
    return await textVisible("登录账号") || await textVisible("项目总览");
  }, {
    timeout: 30000,
    interval: 250,
    timeoutMsg: "Tauri app did not render the login or authenticated shell",
  });

  if (await textVisible("项目总览")) {
    await clickButton("退出登录");
    await waitForText("登录账号");
  }
};

describe("TimeManage Tauri desktop smoke", () => {
  it("opens the desktop shell, connects to the local backend, and persists state", async () => {
    await startFromSignedOutState();
    await setInputByLabel("服务地址", backendUrl);
    await setInputByLabel("登录邮箱或手机号", smokeEmail);
    await setInputByLabel("密码", smokePassword);
    await clickButton("登录");

    await waitForText("项目总览", "Tauri app did not reach the authenticated shell");
    await waitForText("我的任务");
    await clickButton("管理中心");
    await clickButton("团队后台");

    await waitForText("服务地址");
    assert.equal(await inputValueByLabel("服务地址"), backendUrl);

    await setInputByLabel("账号", smokeEmail);
    await setInputByLabel("密码", smokePassword);
    await clickButton("检查服务");
    await waitForText("团队后台健康检查通过");

    await clickButton("登录团队后台");
    await waitForText("团队后台已连接");

    await clickButton("刷新在线数据");
    await waitForText("团队在线数据已刷新");

    const stored = await currentStoredRuntime();
    assert.equal(stored?.backend?.serverUrl, backendUrl);
    assert.equal(stored?.auth?.account?.email, smokeEmail);
    assert.equal(typeof stored?.auth?.token, "string");

    await browser.refresh();
    await waitForText("项目总览", "Authenticated state was not restored after reload");
    await waitForText("退出登录");
  });
});

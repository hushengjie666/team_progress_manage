import assert from "node:assert/strict";

const storageKey = "timemanage.app_state.v4";
const backendUrl = process.env.TM_TAURI_FUNCTIONAL_BACKEND_URL ?? "http://127.0.0.1:8787";
const runId = process.env.TM_TAURI_FUNCTIONAL_RUN_ID ?? `manual_${Date.now().toString(36)}`;
const ownerEmail = process.env.TM_TAURI_FUNCTIONAL_OWNER_EMAIL ?? `${runId}_owner@example.com`;
const memberEmail = process.env.TM_TAURI_FUNCTIONAL_MEMBER_EMAIL ?? `${runId}_member@example.com`;
const projectInviteeEmail = process.env.TM_TAURI_FUNCTIONAL_PROJECT_INVITEE_EMAIL ?? `${runId}_project@example.com`;
const password = process.env.TM_TAURI_FUNCTIONAL_PASSWORD ?? "hu626699";

const workspaceName = `自动化协作区 ${runId}`;
const projectName = `自动化项目 ${runId}`;
const renamedProjectName = `自动化项目已保存 ${runId}`;
const taskTitle = `自动化任务 ${runId}`;

const bodyText = () => browser.execute(() => document.body.innerText);

const textVisible = async (text) => browser.execute((value) => document.body.innerText.includes(value), text);

const waitForText = async (text, timeout = 20000) => {
  try {
    await browser.waitUntil(() => textVisible(text), {
      timeout,
      interval: 250,
      timeoutMsg: `Expected text not found: ${text}`,
    });
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\nCurrent body:\n${(await bodyText()).slice(0, 1800)}`);
  }
};

const waitForControlValue = async (expectedValue, timeout = 10000) => {
  try {
    await browser.waitUntil(async () => browser.execute((value) => (
      Array.from(document.querySelectorAll("input, textarea, select"))
        .some((control) => control.value === value)
    ), expectedValue), {
      timeout,
      interval: 250,
      timeoutMsg: `Expected form value not found: ${expectedValue}`,
    });
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\nCurrent body:\n${(await bodyText()).slice(0, 1800)}`);
  }
};

const waitForAnyText = async (texts, timeout = 20000) => {
  try {
    await browser.waitUntil(async () => {
      const text = await bodyText();
      return texts.some((item) => text.includes(item));
    }, {
      timeout,
      interval: 250,
      timeoutMsg: `Expected one of texts not found: ${texts.join(", ")}`,
    });
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\nCurrent body:\n${(await bodyText()).slice(0, 1800)}`);
  }
};

const waitForNoText = async (text, timeout = 10000) => {
  await browser.waitUntil(async () => !(await textVisible(text)), {
    timeout,
    interval: 250,
    timeoutMsg: `Text still visible: ${text}`,
  });
};

const browserWindowSnapshots = async () => {
  const handles = await browser.getWindowHandles().catch(() => []);
  const snapshots = [];
  for (const handle of handles) {
    await browser.switchToWindow(handle).catch(() => undefined);
    const [url, text] = await Promise.all([
      browser.getUrl().catch((error) => `URL unavailable: ${error instanceof Error ? error.message : String(error)}`),
      bodyText().then((value) => value.slice(0, 600)).catch((error) => (
        `Body unavailable: ${error instanceof Error ? error.message : String(error)}`
      )),
    ]);
    snapshots.push({ handle, url, text });
  }
  return snapshots;
};

const switchToTimeManageWindow = async () => {
  await browser.waitUntil(async () => {
    const snapshots = await browserWindowSnapshots();
    for (const snapshot of snapshots) {
      if (
        snapshot.text.includes("正在加载 TimeManage") ||
        snapshot.text.includes("登录账号") ||
        snapshot.text.includes("项目总览")
      ) {
        await browser.switchToWindow(snapshot.handle);
        return true;
      }
    }
    return false;
  }, {
    timeout: 30000,
    interval: 250,
    timeoutMsg: "Tauri app window was not available",
  });
};

const waitForNoDesktopTimerOverlay = async () => {
  await browser.waitUntil(async () => {
    const handles = await browser.getWindowHandles();
    return !handles.includes("timer-overlay");
  }, {
    timeout: 10000,
    interval: 250,
    timeoutMsg: "Desktop timer overlay window should not be created",
  });
};

const currentAppDiagnostics = async () => {
  const [url, text, windows] = await Promise.all([
    browser.getUrl().catch((error) => `URL unavailable: ${error instanceof Error ? error.message : String(error)}`),
    bodyText().then((value) => value.slice(0, 1800)).catch((error) => (
      `Body unavailable: ${error instanceof Error ? error.message : String(error)}`
    )),
    browserWindowSnapshots().catch((error) => (
      `Browser windows unavailable: ${error instanceof Error ? error.message : String(error)}`
    )),
  ]);
  return [
    `Current URL: ${url}`,
    `Browser handles: ${typeof windows === "string" ? windows : JSON.stringify(windows)}`,
    `Current body:\n${text}`,
  ].join("\n");
};

const waitForNoInPageMiniTimer = async () => {
  await browser.waitUntil(() => browser.execute(() => document.querySelector(".mini-timer-panel") === null), {
    timeout: 10000,
    interval: 250,
    timeoutMsg: "In-page mini timer should not render in Tauri mode",
  });
};

const clickButton = async (text, options = {}) => {
  await browser.execute(({ text: targetText, exact = false, index = 0, withinText }) => {
    const normalize = (value) => (value ?? "").replace(/\s+/g, " ").trim();
    const visible = (element) => element.getClientRects().length > 0;
    const isWithinScope = (element) => {
      if (!withinText) return true;
      let current = element;
      while (current) {
        if (normalize(current.textContent).includes(withinText)) return true;
        current = current.parentElement;
      }
      return false;
    };
    const textMatchesButtons = Array.from(document.querySelectorAll("button"))
      .filter((button) => visible(button) && !button.disabled)
      .filter((button) => {
        const buttonText = normalize(button.textContent);
        return exact ? buttonText === targetText : buttonText.includes(targetText);
      });
    const scopedMatches = textMatchesButtons.filter((button) => isWithinScope(button));
    const matches = scopedMatches.length ? scopedMatches : textMatchesButtons;
    const button = matches[index];
    if (!button) {
      throw new Error(`Button not found: ${targetText} within=${withinText ?? ""} index=${index}`);
    }
    button.click();
  }, { text, ...options });
};

const waitForEnabledButton = async (text, options = {}) => {
  try {
    await browser.waitUntil(() => browser.execute(({ text: targetText, exact = false, withinText }) => {
      const normalize = (value) => (value ?? "").replace(/\s+/g, " ").trim();
      const visible = (element) => element.getClientRects().length > 0;
      const isWithinScope = (element) => {
        if (!withinText) return true;
        let current = element;
        while (current) {
          if (normalize(current.textContent).includes(withinText)) return true;
          current = current.parentElement;
        }
        return false;
      };
      return Array.from(document.querySelectorAll("button"))
        .some((button) => {
          const buttonText = normalize(button.textContent);
          return visible(button)
            && !button.disabled
            && isWithinScope(button)
            && (exact ? buttonText === targetText : buttonText.includes(targetText));
        });
    }, { text, ...options }), {
      timeout: 10000,
      interval: 250,
      timeoutMsg: `Enabled button not found: ${text}`,
    });
  } catch (error) {
    const buttons = await browser.execute(() => Array.from(document.querySelectorAll("button")).map((button) => ({
      text: (button.textContent ?? "").replace(/\s+/g, " ").trim(),
      disabled: button.disabled,
      visible: button.getClientRects().length > 0,
    })));
    throw new Error(`${error instanceof Error ? error.message : String(error)}\nButtons: ${JSON.stringify(buttons)}\nCurrent body:\n${(await bodyText()).slice(0, 1800)}`);
  }
};

const enabledButtonVisible = async (text, options = {}) => browser.execute(({ text: targetText, exact = false, withinText }) => {
  const normalize = (value) => (value ?? "").replace(/\s+/g, " ").trim();
  const visible = (element) => element.getClientRects().length > 0;
  const isWithinScope = (element) => {
    if (!withinText) return true;
    let current = element;
    while (current) {
      if (normalize(current.textContent).includes(withinText)) return true;
      current = current.parentElement;
    }
    return false;
  };
  return Array.from(document.querySelectorAll("button"))
    .some((button) => {
      const buttonText = normalize(button.textContent);
      return visible(button)
        && !button.disabled
        && isWithinScope(button)
        && (exact ? buttonText === targetText : buttonText.includes(targetText));
    });
}, { text, ...options });

const clickButtonInArticle = async (articleText, buttonText, options = {}) => {
  await browser.execute(({ articleText: targetArticle, buttonText: targetButton, exact = false }) => {
    const normalize = (value) => (value ?? "").replace(/\s+/g, " ").trim();
    const visible = (element) => element.getClientRects().length > 0;
    const article = Array.from(document.querySelectorAll("article"))
      .find((element) => visible(element) && normalize(element.textContent).includes(targetArticle));
    if (!article) throw new Error(`Article not found: ${targetArticle}`);
    const button = Array.from(article.querySelectorAll("button"))
      .filter((element) => visible(element) && !element.disabled)
      .find((element) => {
        const text = normalize(element.textContent);
        return exact ? text === targetButton : text.includes(targetButton);
      });
    if (!button) throw new Error(`Button not found in article ${targetArticle}: ${targetButton}`);
    button.click();
  }, { articleText, buttonText, ...options });
};

const setFieldByLabel = async (labelText, value, options = {}) => {
  await browser.execute(({ labelText: targetLabel, value: nextValue, withinText }) => {
    const normalize = (input) => (input ?? "").replace(/\s+/g, " ").trim();
    const visible = (element) => element.getClientRects().length > 0;
    const isWithinScope = (element) => {
      if (!withinText) return true;
      let current = element;
      while (current) {
        if (normalize(current.textContent).includes(withinText)) return true;
        current = current.parentElement;
      }
      return false;
    };
    const findControl = (label) => {
      const byChild = label.querySelector("input, textarea, select");
      if (byChild) return byChild;
      const labelFor = label.getAttribute("for");
      if (labelFor) {
        const byId = document.getElementById(labelFor);
        if (byId?.matches("input, textarea, select")) return byId;
      }
      const parentControl = label.parentElement?.querySelector("input, textarea, select");
      if (parentControl) return parentControl;
      return label.nextElementSibling?.matches("input, textarea, select") ? label.nextElementSibling : null;
    };
    const findControlNearText = () => {
      const visibleControls = Array.from(document.querySelectorAll("input, textarea, select"))
        .filter((control) => visible(control));
      const scopedControls = visibleControls.filter((control) => isWithinScope(control));
      const controls = scopedControls.length ? scopedControls : visibleControls;
      const nearby = controls.find((control) => {
        let current = control.parentElement;
        while (current && current !== document.body) {
          if (normalize(current.textContent).includes(targetLabel)) return true;
          current = current.parentElement;
        }
        return false;
      });
      if (nearby) return nearby;
      if (targetLabel === "标题") {
        return controls.find((control) => control instanceof HTMLInputElement && control.placeholder.includes("下一步")) ?? null;
      }
      if (targetLabel === "估算时长（小时）") {
        return controls.find((control) => control instanceof HTMLInputElement && control.type === "number") ?? null;
      }
      return null;
    };
    const allMatchingLabels = Array.from(document.querySelectorAll("label"))
      .filter((label) => normalize(label.textContent).includes(targetLabel));
    const labels = allMatchingLabels.filter((label) => isWithinScope(label));
    const label = labels[0] ?? allMatchingLabels[0];
    const control = label ? (findControl(label) ?? findControlNearText()) : findControlNearText();
    if (control && !visible(control)) throw new Error(`Field is not visible for label: ${targetLabel} within=${withinText ?? ""}`);
    if (!control) {
      throw new Error(`Field not found for label: ${targetLabel} within=${withinText ?? ""}`);
    }
    const prototype = control instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : control instanceof HTMLSelectElement
        ? window.HTMLSelectElement.prototype
        : window.HTMLInputElement.prototype;
    const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    valueSetter?.call(control, nextValue);
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));
  }, { labelText, value, ...options });
};

const clickRadio = async (labelText, options = {}) => {
  await browser.execute(({ labelText: targetLabel, withinText }) => {
    const normalize = (value) => (value ?? "").replace(/\s+/g, " ").trim();
    const visible = (element) => element.getClientRects().length > 0;
    const isWithinScope = (element) => {
      if (!withinText) return true;
      let current = element;
      while (current) {
        if (normalize(current.textContent).includes(withinText)) return true;
        current = current.parentElement;
      }
      return false;
    };
    const visibleRadioButtons = Array.from(document.querySelectorAll("button[role='radio']"))
      .filter((button) => visible(button) && !button.disabled && normalize(button.textContent).includes(targetLabel));
    const radioButton = visibleRadioButtons.find((button) => isWithinScope(button)) ?? visibleRadioButtons[0];
    if (radioButton) {
      radioButton.click();
      return;
    }
    const labels = Array.from(document.querySelectorAll("label"))
      .filter((label) => visible(label) && normalize(label.textContent).includes(targetLabel))
      .filter((label) => isWithinScope(label));
    const input = labels[0]?.querySelector("input[type='radio'], input[type='checkbox']");
    if (!input) throw new Error(`Radio/check not found: ${targetLabel}`);
    input.click();
  }, { labelText, ...options });
};

const login = async (email) => {
  await waitForText("登录账号");
  await waitForControlValue(backendUrl);
  await setFieldByLabel("登录邮箱或手机号", email);
  await waitForControlValue(email);
  await setFieldByLabel("密码", password);
  await waitForControlValue(password);
  await browser.waitUntil(async () => (
    await textVisible("项目总览")
  ) || (
    await enabledButtonVisible("登录", { exact: true })
  ), {
    timeout: 10000,
    interval: 250,
    timeoutMsg: "Login did not auto-complete and the login button did not become enabled",
  });
  if (!(await textVisible("项目总览"))) {
    await clickButton("登录", { exact: true });
  }
  await waitForText("项目总览", 30000);
  await waitForText(`退出登录：`);
};

const logout = async () => {
  await clickButton("退出登录");
  await waitForText("登录账号", 20000);
};

const startFromSignedOutState = async () => {
  await switchToTimeManageWindow();
  await browser.refresh();
  await switchToTimeManageWindow();
  try {
    await browser.waitUntil(async () => (await textVisible("登录账号")) || (await textVisible("项目总览")), {
      timeout: 30000,
      interval: 250,
      timeoutMsg: "Tauri app did not render login or authenticated shell",
    });
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${await currentAppDiagnostics()}`);
  }
  if (await textVisible("项目总览")) await logout();
};

const connectTeamBackend = async () => {
  await clickButton("管理中心");
  await clickButton("团队后台");
  await waitForText("服务地址");
  await setFieldByLabel("账号", ownerEmail, { withinText: "团队后台" });
  await setFieldByLabel("密码", password, { withinText: "团队后台" });
  await clickButton("检查服务");
  await waitForText("团队后台健康检查通过", 20000);
  await clickButton("登录团队后台");
  await waitForAnyText(["团队后台已连接", "团队在线数据已加载"], 20000);
  await clickButton("刷新在线数据");
  await waitForText("团队在线数据已刷新", 20000);
};

const acceptPendingInvitation = async (expectedEntityName) => {
  await waitForText("待处理");
  await clickButton("待处理");
  await waitForText(expectedEntityName);
  await clickButton("同意加入");
  await waitForText("已加入", 20000);
  await waitForNoText("同意加入", 15000);
};

describe("TimeManage Tauri real database functional flow", () => {
  it("simulates core modules with the Tauri shell and an isolated real MySQL backend", async () => {
    await startFromSignedOutState();
    await login(ownerEmail);
    await connectTeamBackend();

    await clickButton("工作区");
    await waitForText("我的工作区");
    await setFieldByLabel("新协作工作区", workspaceName);
    await clickButton("新增工作区");
    await waitForText(workspaceName, 30000);

    await clickButtonInArticle(workspaceName, "成员");
    await waitForText("成员列表");
    await setFieldByLabel("成员登录账号", memberEmail, { withinText: "成员列表" });
    await clickButton("发送邀请", { withinText: "成员列表" });
    await waitForText(`已向 ${memberEmail} 发送工作区邀请`, 20000);

    await clickButtonInArticle(workspaceName, "项目");
    await waitForText("这里只展示当前账号有权限访问的项目");
    await setFieldByLabel("项目名称", projectName, { withinText: "这里只展示当前账号有权限访问的项目" });
    await setFieldByLabel("项目类型", "software", { withinText: "这里只展示当前账号有权限访问的项目" });
    await setFieldByLabel("项目说明", "真实库 Tauri 功能自动化项目。", { withinText: "这里只展示当前账号有权限访问的项目" });
    await clickButton("添加项目", { withinText: "这里只展示当前账号有权限访问的项目" });
    await waitForText(projectName, 20000);
    await clickButtonInArticle(projectName, "进入项目");
    await waitForText("任务阶段总览", 20000);
    await waitForText(`协作工作区 · ${workspaceName}`);

    await clickButton("设置", { exact: true });
    await setFieldByLabel("项目名称", renamedProjectName, { withinText: "项目资料" });
    await setFieldByLabel("项目说明", "设置页点击保存后写入真实库。", { withinText: "项目资料" });
    await clickButton("保存项目资料");
    await waitForText(renamedProjectName, 20000);
    await clickButton("项目总览");
    await waitForText(renamedProjectName, 30000);
    await clickButtonInArticle(renamedProjectName, "进入项目");
    await waitForText("任务阶段总览", 20000);

    await clickButton("概览", { exact: true });
    await clickButton("添加任务");
    await waitForText("PROJECT TASK");
    await setFieldByLabel("标题", taskTitle, { withinText: "PROJECT TASK" });
    await clickRadio("开发", { withinText: "PROJECT TASK" });
    await setFieldByLabel("估算时长（小时）", "1", { withinText: "PROJECT TASK" });
    await clickButton("创建任务", { withinText: "PROJECT TASK" });
    await waitForText(taskTitle, 20000);

    await clickButton("任务", { exact: true });
    await waitForText(taskTitle);
    await clickButtonInArticle(taskTitle, "详情");
    await waitForText("TASK DETAIL");
    await setFieldByLabel("进度百分比", "35", { withinText: "TASK DETAIL" });
    await setFieldByLabel("进展说明", "真实库 Tauri 自动化进度。", { withinText: "TASK DETAIL" });
    await waitForControlValue("真实库 Tauri 自动化进度。");

    await clickButtonInArticle(taskTitle, "开始");
    await waitForText("专注番茄", 20000);
    await waitForText(taskTitle);
    await clickButton("成员状况");
    await waitForText("今日任务总览");
    await waitForNoInPageMiniTimer();
    await waitForNoDesktopTimerOverlay();
    await clickButton("开始工作");
    await waitForText("专注番茄", 20000);
    await waitForText(taskTitle);
    await clickButton("暂停", { exact: true });
    await waitForText("继续");
    await clickButton("继续", { exact: true });
    await waitForText("暂停");
    await clickButton("内部中断");
    await waitForText("已记录内部中断", 20000);
    await clickButton("作废", { exact: true });
    await waitForText("当前番茄已作废", 20000);

    await clickButton("项目总览");
    await waitForText(renamedProjectName);
    await clickButtonInArticle(renamedProjectName, "进入项目");
    await clickButton("成员管理", { exact: true });
    await waitForText("项目成员管理");
    await clickButton("添加成员");
    await waitForText("PROJECT MEMBER");
    await setFieldByLabel("成员登录账号", projectInviteeEmail, { withinText: "PROJECT MEMBER" });
    await clickRadio("项目负责人", { withinText: "PROJECT MEMBER" });
    await clickButton("发送邀请", { withinText: "PROJECT MEMBER" });
    await waitForText(`已向 ${projectInviteeEmail} 发送项目邀请`, 20000);

    await logout();
    await login(memberEmail);
    await acceptPendingInvitation(workspaceName);
    await waitForText(renamedProjectName, 20000);
    await clickButton("成员状况");
    await waitForText("今日任务总览");
    await waitForText("自动化负责人");
    await waitForText(taskTitle);

    await logout();
    await login(projectInviteeEmail);
    await acceptPendingInvitation(renamedProjectName);
    await waitForText(renamedProjectName, 20000);
    assert.equal(await textVisible(taskTitle), true);

    const stored = await browser.execute((key) => {
      const raw = localStorage.getItem(key);
      const value = raw ? JSON.parse(raw) : null;
      return {
        serverUrl: value?.backend?.serverUrl,
        accountEmail: value?.auth?.account?.email,
        hasAuthToken: typeof value?.auth?.token === "string",
      };
    }, storageKey);
    assert.equal(stored?.serverUrl, backendUrl);
    assert.equal(stored?.accountEmail, projectInviteeEmail);
    assert.equal(stored?.hasAuthToken, true);
  });
});

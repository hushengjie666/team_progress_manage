import type { AutoraTurn } from "./autoraTypes";

const errorMessages: Record<string, string> = {
  autora_not_configured: "尚未配置本机 AutoRA 连接，请设置本地开发环境的管理令牌。",
  autora_invalid_config: "AutoRA 本地连接配置无效，请检查本地服务地址。",
  autora_unavailable: "无法连接本机 AutoRA，请确认服务已启动后重试。",
  unauthorized: "AutoRA 管理令牌无效，请检查本地开发环境配置。",
  binding_disabled: "本地目录绑定尚未启用，请在 AutoRA 中启用后刷新。",
  path_unavailable: "本地目录或文件已变化或无法读取，请刷新连接后重试。",
  permissions_unsupported: "AutoRA 尚未通过只读权限验证，真实代码分析未启动。",
  observe: "AutoRA 当前为观察模式：请求已接收，尚未调用模型。",
  turn_in_progress: "当前会话仍有分析进行中，请等待或取消后继续。",
  source_changed: "需求版本已变化，请重新打开弹窗建立新会话。",
  context_changed: "本地目录绑定已变化，请刷新连接后建立新会话。",
  revision_conflict: "会话版本已变化，请重新打开弹窗后重试。",
  recovery_required: "上一轮执行结果尚未确认，请新建需求会话。",
  local_only: "AI 分析入口仅在这台 Mac 的本地测试环境开放。",
};

export function autoraErrorText(code: string) {
  return errorMessages[code] ?? `AutoRA 返回 ${code}，请检查本机服务状态。`;
}

export class AutoraApiError extends Error {
  constructor(public code: string) {
    super(autoraErrorText(code));
  }
}

export async function autoraRequest<T>(path: string, body?: unknown, key?: string): Promise<T> {
  const method = body === undefined ? "GET" : "POST";
  const idempotencyKey = key ?? crypto.randomUUID();
  for (let attempt = 0; ; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`/__autora/api/v1${path}`, {
        method,
        headers: body === undefined ? {} : { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      if (attempt === 0) continue;
      throw new Error(autoraErrorText("autora_unavailable"));
    }
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) throw new AutoraApiError(data?.error?.code ?? "autora_unavailable");
    return data as T;
  }
}

export function autoraTurnIsActive(turn: AutoraTurn) {
  return ["queued", "running", "cancelling"].includes(turn.state);
}

export function autoraTurnLabel(turn: AutoraTurn) {
  if (turn.blockedReason) return autoraErrorText(turn.blockedReason);
  if (turn.reason && ["failed", "interrupted_unknown"].includes(turn.state)) return autoraErrorText(turn.reason);
  return {
    queued: "请求已接收，等待分析。",
    running: "正在结合本地目录和代码分析…",
    cancelling: "正在取消，等待 AutoRA 确认停止…",
    completed: "分析已完成",
    failed: "本轮分析失败，请检查 AutoRA。",
    cancelled: "本轮分析已取消",
    interrupted_unknown: "连接中断，执行结果尚未确认，请在 AutoRA 中检查。",
  }[turn.state];
}

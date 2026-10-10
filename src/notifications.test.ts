import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const soundSettings = { soundEnabled: true, timerEndSound: "bell" as const, timerEndSoundVolume: 50, timerEndSoundRepeats: 3 };

const audioMock = (state = "running") => {
  const oscillators: Array<ReturnType<typeof oscillator>> = [];
  const oscillator = () => ({
    type: "", frequency: { value: 0 }, connect: vi.fn(), disconnect: vi.fn(),
    start: vi.fn(), stop: vi.fn(), onended: null as (() => void) | null,
  });
  const context = {
    state, currentTime: 10, destination: {},
    resume: vi.fn(async () => { context.state = "running"; }), close: vi.fn(),
    createOscillator: vi.fn(() => {
      const node = oscillator();
      oscillators.push(node);
      return node;
    }),
    createGain: vi.fn(() => ({
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(), disconnect: vi.fn(),
    })),
  };
  const ctor = vi.fn(function () { return context; });
  vi.stubGlobal("window", { AudioContext: ctor });
  return { context, ctor, oscillators };
};

beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("timer sound playback", () => {
  it("reuses the context unlocked by a gesture for later automatic reminders", async () => {
    const { context, ctor, oscillators } = audioMock("suspended");
    const { prepareTimerSound, playTimerSound } = await import("./notifications");
    await prepareTimerSound();
    await playTimerSound(soundSettings);
    await playTimerSound(soundSettings);
    expect(ctor).toHaveBeenCalledOnce();
    expect(context.resume).toHaveBeenCalledOnce();
    expect(context.close).not.toHaveBeenCalled();
    expect(oscillators).toHaveLength(6);
    expect(oscillators[0].start).toHaveBeenCalledWith(10);
    expect(oscillators[1].start).toHaveBeenCalledWith(11.05);
    expect(oscillators[2].stop).toHaveBeenCalledWith(12.9);
    oscillators[0].onended?.();
    expect(oscillators[0].disconnect).toHaveBeenCalledOnce();
  });

  it.each(["suspended", "interrupted"])("waits for %s audio to resume before scheduling any nodes", async (state) => {
    const { context } = audioMock(state);
    let resume!: () => void;
    context.resume.mockImplementation(() => new Promise<void>((resolve) => { resume = resolve; }));
    const { playTimerSound } = await import("./notifications");
    const playing = playTimerSound(soundSettings);
    expect(context.createOscillator).not.toHaveBeenCalled();
    resume();
    await playing;
    expect(context.createOscillator).toHaveBeenCalledTimes(3);
  });

  it("keeps audio failures out of timer settlement and React effects", async () => {
    vi.stubGlobal("window", { AudioContext: vi.fn(function () { throw new Error("audio unavailable"); }) });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { playTimerSound, prepareTimerSound } = await import("./notifications");
    await expect(prepareTimerSound()).resolves.toBeUndefined();
    await expect(playTimerSound(soundSettings)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledTimes(2);
  });

  it("does not allocate audio for disabled or muted reminders", async () => {
    const { ctor } = audioMock();
    const { playTimerSound } = await import("./notifications");
    await playTimerSound({ ...soundSettings, soundEnabled: false });
    await playTimerSound({ ...soundSettings, timerEndSoundVolume: 0 });
    expect(ctor).not.toHaveBeenCalled();
  });

  it("unlocks audio on mouse and keyboard interaction and removes its listeners", async () => {
    const { context } = audioMock("suspended");
    const document = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal("document", document);
    const { installTimerSoundUnlock } = await import("./notifications");
    const cleanup = installTimerSoundUnlock();
    const handler = document.addEventListener.mock.calls[0][1];
    handler();
    expect(context.resume).toHaveBeenCalledOnce();
    expect(document.addEventListener).toHaveBeenCalledWith("keydown", handler, true);
    cleanup();
    expect(document.removeEventListener).toHaveBeenCalledWith("pointerdown", handler, true);
    expect(document.removeEventListener).toHaveBeenCalledWith("keydown", handler, true);
  });
});

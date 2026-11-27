import { PET_SETTING } from "../accountSettingKeys";
import { apiUrl, authHeaders, requestJson, TeamHttpError } from "../teamBackendHttp";
import { submitTeamDomainCommand } from "../teamDomainCommands";
import type { ActiveTimer, BackendConnectionState } from "../types";
import { species } from "./catalog";
import { act, condition, credit, emptyPet, type PetAction, type PetState } from "./model";

function readState(raw: unknown): PetState {
  if (raw === undefined) return emptyPet();
  const s = raw as PetState;
  const whole = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
  if (s && whole(s.revision) && whole(s.observedAt) && whole(s.coins) && whole(s.remainder) &&
      s.remainder < 60_000 && whole(s.earned) && whole(s.past) && whole(s.longest) &&
      s.bag && s.wearing && Array.isArray(s.wardrobe) && (!s.pet ||
        (Object.prototype.hasOwnProperty.call(species, s.pet.species) && typeof s.pet.name === "string" &&
          whole(s.pet.born) && Number.isFinite(s.pet.hungryAt)))) return s;
  throw new Error("宠物存档格式异常");
}

export const petCacheKey = (url: string, id: string) => "timemanage.focus-pet.v1:" +
  JSON.stringify([apiUrl(url, ""), id]);

type Observation = { born: number; timer: ActiveTimer; at: number };
type Update = (s: PetState) => PetState;

/** Serializes local intent. A conflicting device revision reloads and applies the intent to fresh state. */
export class PetStore {
  state = emptyPet();
  private key: string;
  private queue = Promise.resolve();
  private observations: Observation[] = [];
  private flushing = false;

  constructor(private backend: BackendConnectionState, private id: string, private token: string,
    private notify: () => void) {
    this.key = petCacheKey(backend.serverUrl, id);
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) this.state = readState(JSON.parse(raw));
      this.observations = JSON.parse(sessionStorage.getItem(this.key) ?? "[]");
      if (!Array.isArray(this.observations)) this.observations = [];
    } catch { this.observations = []; }
  }

  private confirm(next: PetState) {
    if (next.revision < this.state.revision) return;
    this.state = next;
    try { localStorage.setItem(this.key, JSON.stringify(next)); } catch { /* Server holds the confirmed copy. */ }
    this.notify();
  }

  private async load() {
    const data = await requestJson<{ settings: Record<string, unknown> }>(apiUrl(this.backend.serverUrl, "/settings"),
      { headers: authHeaders(this.token) }, { retry: true });
    this.confirm(readState(data.settings[PET_SETTING]));
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work);
    this.queue = next.then(() => {}, () => {});
    return next;
  }

  refresh() { return this.enqueue(() => this.load()); }

  private async update(apply: Update) {
    if (!this.id || !this.token) throw new Error("需要登录账号");
    for (let attempt = 0; ; attempt++) {
      const state = this.state;
      const next = apply(state);
      if (next === state) return false;
      try {
        const result = await submitTeamDomainCommand(this.backend, this.token, { kind: "settings",
          patch: { [PET_SETTING]: { ...next, revision: state.revision + 1 } } });
        if (!result.settings[PET_SETTING]) throw new Error("服务端未确认宠物存档");
        this.confirm(readState(result.settings[PET_SETTING]));
        return true;
      } catch (err) {
        if (!(err instanceof TeamHttpError) || err.status !== 409 || attempt >= 2) throw err;
        await this.load();
      }
    }
  }

  action(action: PetAction, at: number) {
    const born = this.state.pet?.born;
    return this.enqueue(() => this.update(state =>
      state.pet?.born === born ? act(state, action, at) : state));
  }

  private saveObservations() {
    try { sessionStorage.setItem(this.key, JSON.stringify(this.observations)); } catch { /* Continue in memory. */ }
  }

  observe(timer: ActiveTimer | undefined, at: number, force = false) {
    const pet = this.state.pet;
    if (pet && timer && timer.mode === "focus" && !timer.prepared && credit(this.state, timer, at) !== this.state) {
      const last = this.observations[this.observations.length - 1];
      const sample = { born: pet.born, timer, at };
      // Preserve the final sample before each pause, reset or session switch.
      if (last?.born === pet.born && last.timer.sessionId === timer.sessionId &&
          last.timer.startedAt === timer.startedAt && last.timer.plannedEndAt === timer.plannedEndAt &&
          last.timer.isRunning === timer.isRunning) {
        if (at > last.at) this.observations[this.observations.length - 1] = sample;
      } else this.observations.push(sample);
      this.saveObservations();
    }
    const batch = this.observations.slice();
    const apply = (state: PetState) => {
      let next = state;
      for (const obs of batch) {
        if (next.pet?.born === obs.born) next = credit(next, obs.timer, obs.at);
      }
      if (condition(next, at).dead && !condition(next, next.observedAt).dead) next = { ...next, observedAt: at };
      return next;
    };
    if (this.flushing) return;
    const next = apply(this.state);
    if (next === this.state && !batch.length) return;
    if (!force && next.coins === this.state.coins && !condition(next, at).dead && batch.length < 2) return;
    this.flushing = true;
    void this.enqueue(() => this.update(apply)).then(() => {
      this.observations = this.observations.filter(obs => !batch.includes(obs));
      this.saveObservations();
    }).catch(() => { /* Retain observed intervals and replay after connectivity returns. */ })
      .finally(() => { this.flushing = false; });
  }
}
